CREATE TABLE `content_views` (
	`viewer_id` text NOT NULL,
	`item_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`viewer_id`, `item_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX `views_owner_day` ON `content_views` (`owner_id`,`day`);--> statement-breakpoint
CREATE TABLE `conversation_reads` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` text NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `member_blocks` (
	`user_id` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_owner` ON `support_tickets` (`user_id`);