CREATE TABLE `phase_library` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `map_name` text NOT NULL,
  `board_state` text NOT NULL,
  `source` text NOT NULL DEFAULT 'manual',
  `tags` text NOT NULL DEFAULT '[]',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase_library_user` ON `phase_library`(`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_phase_library_map` ON `phase_library`(`map_name`);
