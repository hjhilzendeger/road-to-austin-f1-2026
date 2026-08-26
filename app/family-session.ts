import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "f1_family_player";
const MAX_AGE = 60 * 60 * 24 * 365;
export type FamilyPlayer = { id: string; nickname: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}
function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export async function getFamilyPlayer(): Promise<FamilyPlayer | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const player = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as FamilyPlayer & { exp: number };
    return player.exp > Date.now() && player.id && player.nickname ? { id: player.id, nickname: player.nickname } : null;
  } catch { return null; }
}

export async function setFamilyPlayer(player: FamilyPlayer) {
  const payload = Buffer.from(JSON.stringify({ ...player, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}
export async function clearFamilyPlayer() { (await cookies()).delete(COOKIE_NAME); }
