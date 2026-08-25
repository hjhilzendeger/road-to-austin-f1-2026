import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const challengeGroups = sqliteTable("challenge_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("challenge_groups_invite_code").on(table.inviteCode)]);

export const challengeProfiles = sqliteTable("challenge_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  nickname: text("nickname").notNull(),
  groupId: text("group_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("challenge_profiles_group_id").on(table.groupId)]);

export const challengePredictions = sqliteTable("challenge_predictions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  raceRound: integer("race_round").notNull(),
  p1: text("p1"),
  p2: text("p2"),
  p3: text("p3"),
  team: text("team"),
  pole: text("pole"),
  fastestLap: text("fastest_lap"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("challenge_predictions_user_round").on(table.userId, table.raceRound),
  index("challenge_predictions_round").on(table.raceRound),
]);
