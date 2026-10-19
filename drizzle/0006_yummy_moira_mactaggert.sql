CREATE TABLE `auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_attempt_expiry` ON `auth_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `email_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`auth_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_accounts_email_unique` ON `email_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `email_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`auth_version` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_session_account` ON `email_sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `email_session_expiry` ON `email_sessions` (`expires_at`);