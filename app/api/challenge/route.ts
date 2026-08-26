import { neon } from "@neondatabase/serverless";
import { clearFamilyPlayer, getFamilyPlayer, setFamilyPlayer } from "@/app/family-session";
import seasonData from "@/public/f1-2026-data.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Body = Record<string, unknown>;
type Row = Record<string, unknown>;
const clean = (value: unknown, max = 60) => typeof value === "string" ? value.trim().slice(0, max) : "";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function schema(sql: ReturnType<typeof db>) {
  await sql.query("CREATE TABLE IF NOT EXISTS challenge_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await sql.query("CREATE TABLE IF NOT EXISTS challenge_profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, nickname TEXT NOT NULL, group_id TEXT REFERENCES challenge_groups(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await sql.query("CREATE INDEX IF NOT EXISTS challenge_profiles_group_id ON challenge_profiles(group_id)");
  await sql.query("CREATE TABLE IF NOT EXISTS challenge_predictions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES challenge_profiles(user_id), race_round INTEGER NOT NULL, p1 TEXT, p2 TEXT, p3 TEXT, team TEXT, pole TEXT, fastest_lap TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, race_round))");
}
function locked(round: number) {
  const event = seasonData.calendar.find((race) => race.round === round);
  if (!event || seasonData.raceResults[String(round) as keyof typeof seasonData.raceResults]) return true;
  const last = event.date.split("/").at(-1) || "";
  const end = last.length === 2 ? `${event.date.slice(0, 7)}-${last}` : event.date.slice(0, 10);
  return Date.now() >= new Date(`${end}T12:00:00Z`).getTime();
}
const pickShape = (row: Row) => ({ userId: row.user_id, raceRound: row.race_round, p1: row.p1, p2: row.p2, p3: row.p3, team: row.team, pole: row.pole, fastestLap: row.fastest_lap });

export async function GET() {
  try {
    const player = await getFamilyPlayer();
    if (!player) return Response.json({ signedIn: false }, { status: 401 });
    const sql = db(); await schema(sql);
    const profiles = await sql.query("SELECT * FROM challenge_profiles WHERE user_id=$1 LIMIT 1", [player.id]);
    const profile = profiles[0] as Row | undefined;
    if (!profile?.group_id) return Response.json({ signedIn: true, user: { id: player.id, displayName: player.nickname }, profile: null });
    const groups = await sql.query("SELECT * FROM challenge_groups WHERE id=$1 LIMIT 1", [profile.group_id]);
    const members = await sql.query("SELECT user_id,nickname FROM challenge_profiles WHERE group_id=$1 ORDER BY created_at", [profile.group_id]);
    const rows = await sql.query("SELECT p.* FROM challenge_predictions p JOIN challenge_profiles m ON m.user_id=p.user_id WHERE m.group_id=$1", [profile.group_id]);
    const predictions = rows.map((row) => pickShape(row as Row)).filter((pick) => pick.userId === player.id || locked(Number(pick.raceRound)));
    return Response.json({ signedIn: true, user: { id: player.id, displayName: player.nickname }, profile: { nickname: profile.nickname, groupId: profile.group_id }, group: groups[0] ? { name: groups[0].name, inviteCode: groups[0].invite_code } : null, members: members.map((row) => ({ userId: row.user_id, nickname: row.nickname })), predictions });
  } catch (error) { console.error(error); return Response.json({ error: "The family database is not configured yet." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Body;
    const action = clean(body.action, 30);
    if (action === "sign_out") { await clearFamilyPlayer(); return Response.json({ ok: true }); }
    const sql = db(); await schema(sql);
    let player = await getFamilyPlayer();
    if (action === "create_group" || action === "join_group") {
      const nickname = clean(body.nickname, 30);
      if (!nickname) return Response.json({ error: "Choose a family nickname." }, { status: 400 });
      player = { id: player?.id || crypto.randomUUID(), nickname };
      let groupId: string;
      if (action === "create_group") {
        groupId = crypto.randomUUID();
        const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        await sql.query("INSERT INTO challenge_groups(id,name,invite_code,created_by) VALUES($1,$2,$3,$4)", [groupId, clean(body.name) || "Our F1 Family", inviteCode, player.id]);
      } else {
        const groups = await sql.query("SELECT id FROM challenge_groups WHERE invite_code=$1 LIMIT 1", [clean(body.inviteCode, 12).toUpperCase()]);
        if (!groups[0]) return Response.json({ error: "That family code was not found." }, { status: 404 });
        groupId = String(groups[0].id);
      }
      await sql.query("INSERT INTO challenge_profiles(user_id,display_name,nickname,group_id) VALUES($1,$2,$2,$3) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,nickname=EXCLUDED.nickname,group_id=EXCLUDED.group_id,updated_at=NOW()", [player.id, nickname, groupId]);
      await setFamilyPlayer(player);
      return Response.json({ ok: true });
    }
    if (!player) return Response.json({ error: "Create or join a family first." }, { status: 401 });
    if (action === "save_prediction") {
      const profiles = await sql.query("SELECT group_id FROM challenge_profiles WHERE user_id=$1 LIMIT 1", [player.id]);
      if (!profiles[0]?.group_id) return Response.json({ error: "Join a family first." }, { status: 400 });
      const raceRound = Number(body.raceRound);
      if (!Number.isInteger(raceRound) || locked(raceRound)) return Response.json({ error: "Picks for this race are locked." }, { status: 400 });
      const driverIds = new Set(seasonData.drivers.map((driver) => driver.id));
      const teamIds = new Set(seasonData.teams.map((team) => team.id));
      const driver = (key: string) => { const value = clean(body[key], 20); return value && driverIds.has(value) ? value : null; };
      const team = clean(body.team, 30);
      const values = [driver("p1"), driver("p2"), driver("p3"), teamIds.has(team) ? team : null, driver("pole"), driver("fastestLap")];
      if (!values[0]) return Response.json({ error: "Choose a race winner." }, { status: 400 });
      await sql.query("INSERT INTO challenge_predictions(id,user_id,race_round,p1,p2,p3,team,pole,fastest_lap) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,race_round) DO UPDATE SET p1=EXCLUDED.p1,p2=EXCLUDED.p2,p3=EXCLUDED.p3,team=EXCLUDED.team,pole=EXCLUDED.pole,fastest_lap=EXCLUDED.fastest_lap,updated_at=NOW()", [crypto.randomUUID(), player.id, raceRound, ...values]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) { console.error(error); return Response.json({ error: "The family database is not configured yet." }, { status: 503 }); }
}
