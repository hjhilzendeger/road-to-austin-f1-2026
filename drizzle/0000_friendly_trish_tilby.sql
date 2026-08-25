CREATE TABLE `challenge_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_groups_invite_code` ON `challenge_groups` (`invite_code`);--> statement-breakpoint
CREATE TABLE `challenge_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`race_round` integer NOT NULL,
	`p1` text,
	`p2` text,
	`p3` text,
	`team` text,
	`pole` text,
	`fastest_lap` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_predictions_user_round` ON `challenge_predictions` (`user_id`,`race_round`);--> statement-breakpoint
CREATE INDEX `challenge_predictions_round` ON `challenge_predictions` (`race_round`);--> statement-breakpoint
CREATE TABLE `challenge_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`nickname` text NOT NULL,
	`group_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `challenge_profiles_group_id` ON `challenge_profiles` (`group_id`);