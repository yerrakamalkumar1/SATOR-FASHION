CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_conversation` ON `chat_messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`designer_id` text NOT NULL,
	`bid_id` text NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'terms_agreed' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commissions_request_id_unique` ON `commissions` (`request_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`designer_id` text NOT NULL,
	`context` text NOT NULL,
	`item_id` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversation_buyer` ON `conversations` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `conversation_designer` ON `conversations` (`designer_id`);--> statement-breakpoint
CREATE TABLE `design_bids` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`designer_id` text NOT NULL,
	`quote` integer NOT NULL,
	`days` integer NOT NULL,
	`message` text NOT NULL,
	`sketch` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bid_request` ON `design_bids` (`request_id`);--> statement-breakpoint
CREATE TABLE `design_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`budget` integer NOT NULL,
	`styles` text NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_buyer` ON `design_requests` (`buyer_id`);--> statement-breakpoint
CREATE TABLE `drop_pledges` (
	`drop_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`drop_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `item_specs` (
	`item_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`styles` text NOT NULL,
	`fabric` text NOT NULL,
	`gsm` integer,
	`stitch` text NOT NULL,
	`care` text NOT NULL,
	`texture_media` text DEFAULT '' NOT NULL,
	`certificate` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lookbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lookbook_owner` ON `lookbooks` (`user_id`);--> statement-breakpoint
CREATE TABLE `measurement_vault` (
	`user_id` text PRIMARY KEY NOT NULL,
	`details` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preorder_drops` (
	`id` text PRIMARY KEY NOT NULL,
	`designer_id` text NOT NULL,
	`item_id` text NOT NULL,
	`title` text NOT NULL,
	`target` integer NOT NULL,
	`price` integer NOT NULL,
	`deadline` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quality_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`designer_id` text NOT NULL,
	`stage` text NOT NULL,
	`asset` text NOT NULL,
	`note` text NOT NULL,
	`review` text DEFAULT 'submitted' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_commission` ON `quality_evidence` (`commission_id`);--> statement-breakpoint
CREATE TABLE `style_profiles` (
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`weights` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`portfolio` text DEFAULT '' NOT NULL,
	`sell_ready_made` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `mode`)
);
