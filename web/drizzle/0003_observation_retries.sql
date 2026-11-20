ALTER TABLE `cases` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cases_retry` ON `cases` (`owner_id`,`client_id`);--> statement-breakpoint
ALTER TABLE `observations` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `observations_retry` ON `observations` (`owner_id`,`client_id`);