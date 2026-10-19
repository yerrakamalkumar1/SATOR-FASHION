CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`follower_id`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`shipping` integer DEFAULT 0 NOT NULL,
	`stock` integer NOT NULL,
	`sizes` text NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listing_owner` ON `listings` (`user_id`);--> statement-breakpoint
CREATE TABLE `monetization` (
	`user_id` text PRIMARY KEY NOT NULL,
	`interest` text NOT NULL,
	`portfolio` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portal_accounts` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `role`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`caption` text NOT NULL,
	`media_url` text NOT NULL,
	`media_type` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_owner` ON `posts` (`user_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`title` text NOT NULL,
	`image` text NOT NULL,
	`size` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount` integer NOT NULL,
	`shipping` integer NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`address` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`mode` text DEFAULT 'test' NOT NULL,
	`provider_order_id` text,
	`provider_payment_id` text,
	`tracking` text DEFAULT '' NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_request_key_unique` ON `purchases` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_provider_order_id_unique` ON `purchases` (`provider_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_provider_payment_id_unique` ON `purchases` (`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `purchase_buyer` ON `purchases` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `purchase_seller` ON `purchases` (`seller_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
