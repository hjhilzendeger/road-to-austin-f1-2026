import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { challengeGroups, challengePredictions, challengeProfiles } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import seasonData from "@/public/f1-2026-data.json";

type Body = Record<string, unknown>;

function text(value: unknown, max = 60) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function raceIsLocked(round: number) {
  const event = seasonData.calendar.find((race) => race.round === round);
  if (!event) return true;
  if (seasonData.raceResults[String(round) as keyof typeof seasonData.raceResults]) return true;
  const lastDate = event.date.split("/").at(-1) || "";
  const yearMonth = event.date.slice(0, 7);
  const end = lastDate.length === 2 ? `${yearMonth}-${lastDate}` : event.date.slice(0, 10);
  return Date.now() >= new Date(`${end}T12:00:00Z`).getTime();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ signedIn: false }, { status: 401 });
  const db = getDb();
  const profile = (await db.select().from(challengeProfiles).where(eq(challengeProfiles.userId, user.id)).limit(1))[0] ?? null;
  if (!profile?.groupId) return Response.json({ signedIn: true, user, profile });

  const group = (await db.select().from(challengeGroups).where(eq(challengeGroups.id, profile.groupId)).limit(1))[0] ?? null;
  const members = await db.select().from(challengeProfiles).where(eq(challengeProfiles.groupId, profile.groupId));
  const memberIds = members.map((member) => member.userId);
  const allPredictions = memberIds.length
    ? await db.select().from(challengePredictions).where(inArray(challengePredictions.userId, memberIds))
    : [];
  const predictions = allPredictions.filter((pick) => pick.userId === user.id || raceIsLocked(pick.raceRound));
  return Response.json({ signedIn: true, user, profile, group, members, predictions });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const body = await request.json() as Body;
  const action = text(body.action, 30);
  const db = getDb();
  const now = new Date();

  if (action === "create_group") {
    const name = text(body.name) || "Our F1 Family";
    const nickname = text(body.nickname, 30) || user.displayName.split(" ")[0];
    const id = crypto.randomUUID();
    const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
    await db.insert(challengeGroups).values({ id, name, inviteCode, createdBy: user.id, createdAt: now });
    await db.insert(challengeProfiles).values({ userId: user.id, displayName: user.displayName, nickname, groupId: id, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: challengeProfiles.userId, set: { displayName: user.displayName, nickname, groupId: id, updatedAt: now } });
    return Response.json({ ok: true });
  }

  if (action === "join_group") {
    const inviteCode = text(body.inviteCode, 12).toUpperCase();
    const nickname = text(body.nickname, 30) || user.displayName.split(" ")[0];
    const group = (await db.select().from(challengeGroups).where(eq(challengeGroups.inviteCode, inviteCode)).limit(1))[0];
    if (!group) return Response.json({ error: "That family code was not found." }, { status: 404 });
    await db.insert(challengeProfiles).values({ userId: user.id, displayName: user.displayName, nickname, groupId: group.id, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: challengeProfiles.userId, set: { displayName: user.displayName, nickname, groupId: group.id, updatedAt: now } });
    return Response.json({ ok: true });
  }

  if (action === "save_prediction") {
    const profile = (await db.select().from(challengeProfiles).where(eq(challengeProfiles.userId, user.id)).limit(1))[0];
    if (!profile?.groupId) return Response.json({ error: "Join a family first." }, { status: 400 });
    const raceRound = Number(body.raceRound);
    if (!Number.isInteger(raceRound) || raceIsLocked(raceRound)) return Response.json({ error: "Picks for this race are locked." }, { status: 400 });
    const driverIds = new Set(seasonData.drivers.map((driver) => driver.id));
    const teamIds = new Set(seasonData.teams.map((team) => team.id));
    const driver = (key: string) => { const value = text(body[key], 20); return value && driverIds.has(value) ? value : null; };
    const team = text(body.team, 30);
    const values = { p1: driver("p1"), p2: driver("p2"), p3: driver("p3"), team: teamIds.has(team) ? team : null, pole: driver("pole"), fastestLap: driver("fastestLap"), updatedAt: now };
    if (!values.p1) return Response.json({ error: "Choose a race winner." }, { status: 400 });
    await db.insert(challengePredictions).values({ id: crypto.randomUUID(), userId: user.id, raceRound, ...values, createdAt: now })
      .onConflictDoUpdate({ target: [challengePredictions.userId, challengePredictions.raceRound], set: values });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
