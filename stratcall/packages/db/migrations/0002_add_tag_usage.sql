CREATE TABLE IF NOT EXISTS `tag_usage` (
	`tag` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL DEFAULT 0
);
