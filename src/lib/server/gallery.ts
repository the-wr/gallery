/**
 * Read API. Privacy is enforced HERE, server-side, at query time (TDD §6):
 * private photos (min_layer_order = 3) are genuinely absent from the payload
 * for non-unlocked sessions — never hidden by CSS. Index aggregates (counts,
 * tiles, pins) are computed from the same filtered set, so private content
 * never influences a number or thumbnail shown to anonymous visitors.
 */
import { eq, asc, desc } from 'drizzle-orm';
import { db } from './db';
import { country, trip, section, block, photo } from './db/schema';
import { DEEPEST_PUBLIC_ORDER } from '$lib/layers';
import type { SessionKind, TripVM, SectionVM, BlockVM, WorldVM, CountryVM, TileVM, PinVM } from '$lib/types';

/** Deepest layer order this session may see. Anonymous stops before faces (3). */
export function maxLayerOrder(session: SessionKind): number {
	return session === 'anonymous' ? DEEPEST_PUBLIC_ORDER : 3;
}

/** Map of tripId -> visible photo count, computed in one pass. */
function visibleCounts(max: number): Map<string, number> {
	const rows = db
		.select({ tripId: block.tripId, min: photo.minLayerOrder })
		.from(photo)
		.innerJoin(block, eq(photo.blockId, block.id))
		.all();
	const m = new Map<string, number>();
	for (const r of rows) {
		if (r.min <= max) m.set(r.tripId, (m.get(r.tripId) ?? 0) + 1);
	}
	return m;
}

export function getWorld(session: SessionKind, granularity: 'countries' | 'trips'): WorldVM {
	const max = maxLayerOrder(session);
	const counts = visibleCounts(max);
	const countries = db.select().from(country).all();
	const trips = db.select().from(trip).orderBy(asc(trip.countryCode), asc(trip.position)).all();

	// trips visible to this session (>=1 visible photo)
	const visibleTrips = trips.filter((t) => (counts.get(t.id) ?? 0) > 0);
	const tripsByCountry = new Map<string, typeof trips>();
	for (const t of visibleTrips) {
		const arr = tripsByCountry.get(t.countryCode) ?? [];
		arr.push(t);
		tripsByCountry.set(t.countryCode, arr);
	}

	// only countries that still have a visible trip
	const visibleCountries = countries.filter((c) => (tripsByCountry.get(c.code)?.length ?? 0) > 0);

	const pins: PinVM[] = visibleCountries.map((c) => {
		const n = tripsByCountry.get(c.code)!.length;
		return {
			id: c.code,
			x: c.worldPinX,
			y: c.worldPinY,
			count: String(n),
			name: c.name,
			sub: `${n} albums · ${c.years}`,
			thumb: c.coverLabel,
			nav: 'country:' + c.code
		};
	});

	let tiles: TileVM[];
	let catSub: string;
	if (granularity === 'countries') {
		catSub = `${visibleCountries.length} countries · one tile each`;
		tiles = visibleCountries.map((c) => ({
			nav: 'country:' + c.code,
			cover: c.coverLabel,
			primary: c.name,
			secondary: `${c.years} · ${tripsByCountry.get(c.code)!.length} albums`
		}));
	} else {
		catSub = `${visibleTrips.length} trips · every album, most recent first`;
		const nameOf = new Map(countries.map((c) => [c.code, c.name]));
		const byDateDesc = [...visibleTrips].sort((a, b) =>
			(b.dateStart ?? '').localeCompare(a.dateStart ?? '')
		);
		tiles = byDateDesc.map((t) => ({
			nav: 'trip:' + t.slug,
			cover: t.coverLabel,
			primary: nameOf.get(t.countryCode) ?? t.countryCode,
			secondary: t.datesLabel
		}));
	}

	return { pins, tiles, catSub, granularity };
}

export function getCountry(session: SessionKind, code: string): CountryVM | null {
	const max = maxLayerOrder(session);
	const c = db.select().from(country).where(eq(country.code, code)).get();
	if (!c) return null;
	const counts = visibleCounts(max);
	const trips = db
		.select()
		.from(trip)
		.where(eq(trip.countryCode, code))
		.orderBy(desc(trip.dateStart))
		.all()
		.filter((t) => (counts.get(t.id) ?? 0) > 0);

	// a country with no visible trips does not exist publicly
	if (trips.length === 0) return null;

	const pins: PinVM[] = trips.map((t) => ({
		id: t.id,
		x: t.countryPinX,
		y: t.countryPinY,
		count: null,
		name: t.title,
		sub: t.datesLabel,
		thumb: t.coverLabel,
		nav: 'trip:' + t.slug
	}));
	const tiles: TileVM[] = trips.map((t) => ({
		nav: 'trip:' + t.slug,
		cover: t.coverLabel,
		primary: t.title,
		secondary: t.datesLabel
	}));

	return {
		code: c.code,
		name: c.name,
		sub: `${trips.length} albums · ${c.years}`,
		tripsLabel: `Trips in ${c.name}`,
		pins,
		tiles
	};
}

export function getTrip(session: SessionKind, slug: string): TripVM | null {
	const max = maxLayerOrder(session);
	const t = db.select().from(trip).where(eq(trip.slug, slug)).get();
	if (!t) return null;
	const c = db.select().from(country).where(eq(country.code, t.countryCode)).get();

	const sections = db
		.select()
		.from(section)
		.where(eq(section.tripId, t.id))
		.orderBy(asc(section.position))
		.all();
	const blocks = db
		.select()
		.from(block)
		.where(eq(block.tripId, t.id))
		.orderBy(asc(block.position))
		.all();
	const blockIds = new Set(blocks.map((b) => b.id));
	const photos = db
		.select()
		.from(photo)
		.all()
		.filter((p) => blockIds.has(p.blockId));
	const photosByBlock = new Map<string, typeof photos>();
	for (const p of photos) {
		const arr = photosByBlock.get(p.blockId) ?? [];
		arr.push(p);
		photosByBlock.set(p.blockId, arr);
	}

	// layer counts: cumulative visible-photo count at each layer order (0..3),
	// over the session-permitted set. Faces (3) only meaningful when unlocked.
	const layerCounts = [0, 0, 0, 0];
	for (const p of photos) {
		if (p.minLayerOrder <= max) {
			for (let li = p.minLayerOrder; li <= 3; li++) layerCounts[li]++;
		}
	}

	const blocksBySection = new Map<string | null, typeof blocks>();
	for (const b of blocks) {
		const key = b.sectionId ?? null;
		const arr = blocksBySection.get(key) ?? [];
		arr.push(b);
		blocksBySection.set(key, arr);
	}

	function buildBlock(b: (typeof blocks)[number]): BlockVM | null {
		if (b.kind === 'text') {
			return { id: b.id, kind: 'text', minLayerOrder: b.minLayerOrder, text: b.textMd ?? '' };
		}
		if (b.kind === 'map') {
			return {
				id: b.id,
				kind: 'map',
				minLayerOrder: b.minLayerOrder,
				label: b.mapLabel ?? '',
				note: b.mapNote ?? ''
			};
		}
		// photo_group: privacy-filter photos out of the payload entirely
		const groupPhotos = (photosByBlock.get(b.id) ?? [])
			.sort((a, b2) => a.position - b2.position)
			.filter((p) => p.minLayerOrder <= max)
			.map((p) => ({
				id: p.id,
				label: p.label,
				caption: p.caption,
				hasCaption: !!p.caption,
				minLayerOrder: p.minLayerOrder
			}));
		if (groupPhotos.length === 0) return null; // all-private group: omit
		return {
			id: b.id,
			kind: 'photo_group',
			layout: (b.layout as 'hero' | 'row') ?? 'row',
			minLayerOrder: Math.min(...groupPhotos.map((p) => p.minLayerOrder)),
			photos: groupPhotos
		};
	}

	const sectionVMs: SectionVM[] = [];
	for (const sec of sections) {
		const secBlocks = (blocksBySection.get(sec.id) ?? [])
			.map(buildBlock)
			.filter((b): b is BlockVM => b !== null);
		// a section with no visible photo group is absent entirely (privacy + R-L11)
		const hasPhoto = secBlocks.some((b) => b.kind === 'photo_group');
		if (!hasPhoto) continue;
		sectionVMs.push({
			id: sec.id,
			heading: sec.heading,
			datesLabel: sec.datesLabel,
			blocks: secBlocks
		});
	}

	return {
		id: t.id,
		slug: t.slug,
		title: t.title,
		intro: t.intro,
		datesLabel: t.datesLabel,
		country: { code: c!.code, name: c!.name },
		defaultLayer: t.defaultLayer,
		sections: sectionVMs,
		layerCounts
	};
}
