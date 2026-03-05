-- Drop old comments table and recreate with polymorphic target columns
-- SQLite doesn't support ALTER TABLE ADD COLUMN with NOT NULL without defaults well,
-- so we recreate the table. No production data to migrate yet.

DROP TABLE IF EXISTS `comments`;

CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`strategy_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`strategy_id`) REFERENCES `strategies`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
