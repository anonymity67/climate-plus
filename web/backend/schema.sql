CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`observation_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cases_owner` ON `cases` (`owner_id`);--> statement-breakpoint
CREATE TABLE `closures` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`edge_ids_json` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`radius_m` real,
	`reason` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_label` text NOT NULL,
	`source_url` text,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `closures_trip_expiry` ON `closures` (`trip_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text,
	`owner_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`type` text NOT NULL,
	`subject_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_trip` ON `events` (`trip_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `events_owner` ON `events` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `fixes` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`role` text NOT NULL,
	`source` text NOT NULL,
	`client_fix_id` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_m` real NOT NULL,
	`speed_mps` real,
	`heading` real,
	`captured_at` text NOT NULL,
	`received_at` text NOT NULL,
	`metadata_json` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixes_client` ON `fixes` (`trip_id`,`role`,`client_fix_id`);--> statement-breakpoint
CREATE INDEX `fixes_trip_time` ON `fixes` (`trip_id`,`role`,`captured_at`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`consumed_at` text,
	`consumed_by` text,
	`accepted_nonce` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_hash_unique` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`trip_id`, `user_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memberships_user` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`data_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observations_owner` ON `observations` (`owner_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`origin_json` text NOT NULL,
	`destination_json` text NOT NULL,
	`speed` real NOT NULL,
	`profile` text NOT NULL,
	`selected_route_id` text,
	`replay_distance` real DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`supplier_fix_at` text,
	`recipient_fix_at` text
);

ALTER TABLE `trips` ADD `region_id` text DEFAULT 'dacope' NOT NULL;
CREATE TABLE `water_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_id` text NOT NULL,
	`client_id` text NOT NULL,
	`status` text NOT NULL,
	`visit_date` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `water_checks_retry` ON `water_checks` (`owner_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `water_checks_owner_source` ON `water_checks` (`owner_id`,`source_id`,`created_at`);
ALTER TABLE `cases` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cases_retry` ON `cases` (`owner_id`,`client_id`);--> statement-breakpoint
ALTER TABLE `observations` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `observations_retry` ON `observations` (`owner_id`,`client_id`);