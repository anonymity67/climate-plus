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