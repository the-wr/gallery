import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Schema follows TECHNICAL_DESIGN.md §4. IDs are app-generated (nanoid) for
// export-stability. Layers are a fixed v1 enum (0..3), not rows.

export const country = sqliteTable('country', {
	code: text('code').primaryKey(), // ISO-3166 alpha-2 (R-W3)
	name: text('name').notNull(),
	worldPinX: real('world_pin_x').notNull(), // normalized 0..1 over static world image (R-I4)
	worldPinY: real('world_pin_y').notNull(),
	mapImageId: text('map_image_id'), // FK -> asset (static country base map, R-I3)
	visited: integer('visited', { mode: 'boolean' }).notNull().default(true), // (R-I7)
	years: text('years').notNull(), // display string e.g. "2016–2024"
	coverLabel: text('cover_label').notNull() // representative cover (world tile + pin thumb)
});

export const trip = sqliteTable('trip', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(), // URL (R-A4)
	title: text('title').notNull(),
	intro: text('intro'),
	countryCode: text('country_code')
		.notNull()
		.references(() => country.code),
	dateStart: text('date_start'), // derived from capture times (R-W4)
	dateEnd: text('date_end'),
	datesLabel: text('dates_label').notNull(), // display e.g. "Nov 2022"
	coverPhotoId: text('cover_photo_id'),
	coverLabel: text('cover_label').notNull(), // synthetic placeholder text for the cover
	coverFocalX: real('cover_focal_x').notNull().default(0.5), // crop focal point (R-I12)
	coverFocalY: real('cover_focal_y').notNull().default(0.5),
	defaultLayer: text('default_layer').notNull().default('highlights'), // (R-L4)
	tripMapImageId: text('trip_map_image_id'), // optional overview map (R-C3)
	countryPinX: real('country_pin_x').notNull(), // on the country map (R-I4)
	countryPinY: real('country_pin_y').notNull(),
	position: integer('position').notNull().default(0)
});

export const section = sqliteTable('section', {
	id: text('id').primaryKey(),
	tripId: text('trip_id')
		.notNull()
		.references(() => trip.id),
	parentId: text('parent_id'), // reserved for nested sub-sections; UNUSED in v1 (R-A2)
	heading: text('heading').notNull(),
	dateStart: text('date_start'), // override (R-A5)
	dateEnd: text('date_end'),
	datesLabel: text('dates_label'), // display override
	position: integer('position').notNull().default(0)
});

export const block = sqliteTable('block', {
	id: text('id').primaryKey(),
	tripId: text('trip_id')
		.notNull()
		.references(() => trip.id),
	sectionId: text('section_id'), // null = trip-level (before first section)
	position: integer('position').notNull().default(0),
	kind: text('kind').notNull(), // 'photo_group' | 'text' | 'map'
	layout: text('layout'), // photo_group: 'row' | 'hero'
	// text:
	textMd: text('text_md'),
	headingLevel: integer('heading_level'),
	// map (frozen overview/section map placeholder for v1):
	mapLabel: text('map_label'),
	mapNote: text('map_note'),
	// DERIVED on save: min over the block's photos; cache for collapse (R-L11).
	minLayerOrder: integer('min_layer_order').notNull().default(2)
});

export const photo = sqliteTable('photo', {
	id: text('id').primaryKey(),
	blockId: text('block_id')
		.notNull()
		.references(() => block.id),
	assetId: text('asset_id'), // FK -> asset (original)
	position: integer('position').notNull().default(0),
	caption: text('caption'), // one caption, all layers (R-C6)
	label: text('label').notNull(), // synthetic placeholder description (no real bytes yet)
	// THE superset key (R-L2): appears in this layer and all inner layers.
	minLayerOrder: integer('min_layer_order').notNull().default(2),
	// extracted metadata (all overridable, R-W7/R-W8):
	takenAt: text('taken_at'), // (R-W4)
	gpsLat: real('gps_lat'), // (R-W2)
	gpsLng: real('gps_lng'),
	rating: integer('rating'), // stars (R-W5 -> min_layer)
	width: integer('width'),
	height: integer('height'),
	lqip: text('lqip') // inline blur placeholder (base64/blurhash)
});

export const asset = sqliteTable('asset', {
	id: text('id').primaryKey(),
	kind: text('kind').notNull(), // 'photo' | 'static_map'
	originalPath: text('original_path'),
	derivatives: text('derivatives', { mode: 'json' }), // {width: {avif,jpeg}}
	checksum: text('checksum')
});

export const shareToken = sqliteTable('share_token', {
	id: text('id').primaryKey(),
	tokenHash: text('token_hash').notNull(), // store only a hash (§14)
	createdAt: text('created_at').notNull(),
	revokedAt: text('revoked_at'), // rotation/revocation (open Q1)
	label: text('label')
});

export type Country = typeof country.$inferSelect;
export type Trip = typeof trip.$inferSelect;
export type Section = typeof section.$inferSelect;
export type Block = typeof block.$inferSelect;
export type Photo = typeof photo.$inferSelect;
export type ShareToken = typeof shareToken.$inferSelect;
