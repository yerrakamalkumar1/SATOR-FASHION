CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`board` text DEFAULT 'My inspiration' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `cart` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`config` text NOT NULL,
	`size` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cart_owner` ON `cart` (`user_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comment_product` ON `comments` (`product_id`);--> statement-breakpoint
CREATE TABLE `designs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`config` text NOT NULL,
	`category` text DEFAULT 'Graphic' NOT NULL,
	`kind` text DEFAULT 'creator' NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `design_owner` ON `designs` (`user_id`);--> statement-breakpoint
CREATE INDEX `design_public` ON `designs` (`published`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiry_owner` ON `inquiries` (`user_id`);--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`items` text NOT NULL,
	`amount` integer NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`note` text NOT NULL,
	`status` text DEFAULT 'quote_requested' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request_key_unique` ON `orders` (`request_key`);--> statement-breakpoint
CREATE INDEX `order_owner` ON `orders` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`created_at` text NOT NULL
);
