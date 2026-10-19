CREATE TABLE `design_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`collaborator_id` text,
	`reviewer_id` text NOT NULL,
	`commission_id` text,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_revision_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_owner` ON `design_projects` (`owner_id`);--> statement-breakpoint
CREATE INDEX `project_collaborator` ON `design_projects` (`collaborator_id`);--> statement-breakpoint
CREATE TABLE `inspiration_pins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lookbook_id` text NOT NULL,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspiration_owner_board` ON `inspiration_pins` (`user_id`,`lookbook_id`);--> statement-breakpoint
CREATE TABLE `project_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_event_history` ON `project_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author_id` text NOT NULL,
	`version` integer NOT NULL,
	`config` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_version` ON `project_revisions` (`project_id`,`version`);--> statement-breakpoint
CREATE TABLE `wardrobe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`color` text NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`occasions` text DEFAULT '[]' NOT NULL,
	`season` text DEFAULT 'all' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_owner` ON `wardrobe_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `wardrobe_outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`occasion` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outfit_owner` ON `wardrobe_outfits` (`user_id`);
--> statement-breakpoint
CREATE TRIGGER lookbook_remove_inspiration AFTER DELETE ON lookbooks BEGIN DELETE FROM inspiration_pins WHERE lookbook_id=OLD.id AND user_id=OLD.user_id; END;
