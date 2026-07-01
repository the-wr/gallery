CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`original_path` text,
	`derivatives` text,
	`checksum` text
);
--> statement-breakpoint
CREATE TABLE `block` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`section_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`layout` text,
	`text_md` text,
	`heading_level` integer,
	`map_label` text,
	`map_note` text,
	`min_layer_order` integer DEFAULT 2 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `country` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`world_pin_x` real NOT NULL,
	`world_pin_y` real NOT NULL,
	`map_image_id` text,
	`visited` integer DEFAULT true NOT NULL,
	`years` text NOT NULL,
	`cover_label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photo` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`asset_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`caption` text,
	`label` text NOT NULL,
	`min_layer_order` integer DEFAULT 2 NOT NULL,
	`taken_at` text,
	`gps_lat` real,
	`gps_lng` real,
	`rating` integer,
	`width` integer,
	`height` integer,
	`lqip` text,
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `section` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`parent_id` text,
	`heading` text NOT NULL,
	`date_start` text,
	`date_end` text,
	`dates_label` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `share_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	`label` text
);
--> statement-breakpoint
CREATE TABLE `trip` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`intro` text,
	`country_code` text NOT NULL,
	`date_start` text,
	`date_end` text,
	`dates_label` text NOT NULL,
	`cover_photo_id` text,
	`cover_label` text NOT NULL,
	`cover_focal_x` real DEFAULT 0.5 NOT NULL,
	`cover_focal_y` real DEFAULT 0.5 NOT NULL,
	`default_layer` text DEFAULT 'highlights' NOT NULL,
	`trip_map_image_id` text,
	`country_pin_x` real NOT NULL,
	`country_pin_y` real NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `country`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_slug_unique` ON `trip` (`slug`);