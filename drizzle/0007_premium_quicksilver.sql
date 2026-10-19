CREATE TABLE `member_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`discoverable` integer DEFAULT 1 NOT NULL,
	`show_sales` integer DEFAULT 1 NOT NULL,
	`notify_likes` integer DEFAULT 1 NOT NULL,
	`notify_comments` integer DEFAULT 1 NOT NULL,
	`notify_follows` integer DEFAULT 1 NOT NULL,
	`notify_messages` integer DEFAULT 1 NOT NULL,
	`notify_orders` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
