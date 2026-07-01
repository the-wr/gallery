/**
 * Synthetic seed (TDD §13.2). Ports the mockup's data generator
 * (mockups/project/Travel Gallery.dc.html) into the SQLite DB so the viewer,
 * layers, lightbox, and the anonymous-vs-unlocked privacy boundary can be
 * exercised without a real upload. No real photo bytes — placeholder labels
 * stand in for images, exactly as the mockup does.
 */
import { createHash } from 'node:crypto';
import { db } from '../src/lib/server/db/index';
import { ensureMigrated } from '../src/lib/server/db/migrate';
import { country, trip, section, block, photo, shareToken } from '../src/lib/server/db/schema';
import { ratingToLayerOrder } from '../src/lib/layers';

// A fixed dev share token so the unlock flow is testable without an admin UI.
// In production tokens are 256-bit random; this is dev-seed convenience only.
const DEV_TOKEN = 'family-demo';

// ---- source data (verbatim from the mockup) ----------------------------------

interface CountrySrc {
	id: string;
	name: string;
	x: number;
	y: number;
	years: string;
}
const countries: CountrySrc[] = [
	{ id: 'jp', name: 'Japan', x: 84, y: 43, years: '2016–2024' },
	{ id: 'is', name: 'Iceland', x: 42, y: 24, years: '2019' },
	{ id: 'it', name: 'Italy', x: 51, y: 42, years: '2017–2023' },
	{ id: 'ma', name: 'Morocco', x: 46, y: 49, years: '2018' },
	{ id: 'no', name: 'Norway', x: 52, y: 23, years: '2021' },
	{ id: 'vn', name: 'Vietnam', x: 78, y: 54, years: '2019' },
	{ id: 'pe', name: 'Peru', x: 28, y: 66, years: '2022' },
	{ id: 'pt', name: 'Portugal', x: 43, y: 42, years: '2023' },
	{ id: 'gr', name: 'Greece', x: 56, y: 44, years: '2022' },
	{ id: 'th', name: 'Thailand', x: 76, y: 55, years: '2020' },
	{ id: 'nz', name: 'New Zealand', x: 94, y: 84, years: '2018–2023' }
];

const titles: Record<string, string[]> = {
	jp: ['Kyoto in Autumn', 'Tokyo Nights', 'Hokkaido in Snow', 'Setouchi Islands', 'Koyasan Pilgrimage'],
	is: ['The Ring Road', 'Highland Summer', 'South Coast Falls', 'Westfjords Detour'],
	it: ['Cinque Terre Slow', 'Roman Stones', 'Dolomites Traverse', 'Amalfi Coast Drive', 'Sicily End to End', 'Venice in Fog', 'Tuscan Backroads', 'Lake Como', 'Puglia Whitewash'],
	ma: ['Atlas & Sahara', 'Fes Medina', 'Chefchaouen Blue', 'Coastal Essaouira', 'Desert Nights', 'Marrakech Souks'],
	no: ['Lofoten Lights', 'Fjord Country', 'Senja Detour', 'Bergen Rain', 'Arctic Road'],
	vn: ['Ha Long Bay', 'Mekong Delta', 'Sapa Terraces', 'Hoi An Lanterns', 'Hanoi Old Quarter', 'Da Lat Highlands', 'Phong Nha Caves'],
	pe: ['Andes Traverse', 'Cusco & Beyond', 'Sacred Valley'],
	pt: ['Lisbon & the Coast'],
	gr: ['Cyclades by Ferry'],
	th: ['Bangkok & the North'],
	nz: ['Southern Alps', 'West Coast Wild', 'Fiordland Sounds', 'Coromandel Days']
};

const themes: Record<string, string[]> = {
	jp: ['Temple gate', 'Garden detail', 'Lantern-lit lane', 'Mountain shrine'],
	is: ['Glacier lagoon', 'Black-sand beach', 'Waterfall in mist', 'Highland road'],
	it: ['Hilltown rooftops', 'Harbour at dusk', 'Cathedral facade', 'Coast road'],
	ma: ['Medina alley', 'Desert dune', 'Riad courtyard', 'Mountain pass'],
	no: ['Fjord wall', 'Fishing village', 'Aurora over water', 'Switchback road'],
	vn: ['Limestone bay', 'River market', 'Rice terrace', 'Old-quarter street'],
	pe: ['Andean ridge', 'Stone ruins', 'Market colour', 'High pass'],
	pt: ['Tiled facade', 'Atlantic cliff', 'Tram in Alfama', 'Coastal road'],
	gr: ['Whitewashed lane', 'Aegean blue', 'Harbour at dusk', 'Island terrace'],
	th: ['Temple spire', 'Street market', 'Jungle river', 'Night-market glow'],
	nz: ['Alpine lake', 'Coast cliff', 'Glowworm valley', 'Mountain road']
};

const dateBase: Record<string, string[]> = {
	jp: ['Nov 2022', 'Mar 2024', 'Feb 2019', 'May 2021', 'Apr 2018'],
	is: ['Jul 2019', 'Aug 2019', 'Jul 2019', 'Jun 2019'],
	it: ['Sep 2019', 'Jun 2017', 'Sep 2021', 'Jun 2018', 'May 2023', 'Nov 2020', 'Sep 2019', 'Jul 2022', 'Jun 2023'],
	ma: ['Mar 2018', 'Mar 2018', 'Apr 2018', 'Apr 2018', 'Mar 2018', 'Apr 2018'],
	no: ['Sep 2021', 'Aug 2021', 'Sep 2021', 'Aug 2021', 'Sep 2021'],
	vn: ['Feb 2019', 'Feb 2019', 'Mar 2019', 'Mar 2019', 'Feb 2019', 'Mar 2019', 'Mar 2019'],
	pe: ['Aug 2022', 'Aug 2022', 'Sep 2022'],
	pt: ['May 2023'],
	gr: ['Jun 2022'],
	th: ['Jan 2020'],
	nz: ['Jan 2018', 'Dec 2019', 'Jan 2023', 'Feb 2023']
};
function dateOf(cid: string, i: number): string {
	return dateBase[cid]?.[i] ?? countries.find((c) => c.id === cid)!.years;
}

// Parse a "Mon YYYY" display label into a sortable "YYYY-MM" key (R-W4).
const MONTHS: Record<string, string> = {
	jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
	jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};
function sortableDate(label: string): string {
	const m = label.match(/([A-Za-z]{3})\s+(\d{4})/);
	if (m) return `${m[2]}-${MONTHS[m[1].toLowerCase()] ?? '01'}`;
	const y = label.match(/(\d{4})/);
	return y ? `${y[1]}-01` : '0000-01';
}

// ---- block authoring helpers -------------------------------------------------

type PhotoSrc = { label: string; star?: number; caption?: string; face?: boolean };
const P = (label: string, star?: number, caption?: string): PhotoSrc => ({ label, star, caption });
const F = (label: string, caption?: string): PhotoSrc => ({ label, face: true, caption });

type BlockSrc =
	| { type: 'text'; text: string }
	| { type: 'hero'; photo: PhotoSrc }
	| { type: 'row'; photos: PhotoSrc[] }
	| { type: 'map'; label: string; hasRoute?: boolean; hasHeat?: boolean };
type SectionSrc = { title: string; dates?: string; blocks: BlockSrc[] };
type TripSrc = {
	title: string;
	dates: string;
	cover: string;
	intro: string;
	sections: SectionSrc[];
};

// authored showcase: Kyoto (jp-0), verbatim from the mockup
const kyoto: TripSrc = {
	title: 'Kyoto in Autumn',
	dates: 'Nov 2022',
	cover: 'Maple-framed pagoda at blue hour',
	intro:
		'Eight slow days as the maples turned. We walked more than we planned and photographed more than that — here is the trip at whatever depth you want it.',
	sections: [
		{
			title: 'Arrival in Higashiyama',
			dates: '12–13 Nov',
			blocks: [
				{ type: 'text', text: 'We landed to low grey light and dropped our bags in a machiya off Yasaka-dōri. The first evening is always just walking — letting the place set the pace before the camera comes out.' },
				{ type: 'hero', photo: P('Yōhōkan-ji pagoda above the rooftops, lanterns just lit, blue hour', 5, 'Hōkan-ji from Yasaka-dōri — the postcard, earned by waiting for the light') },
				{ type: 'row', photos: [P('Wet cobbles of Ninen-zaka, shopfronts closing', 4), P('Indigo noren curtains, hand on the door', 3), P('First red maple over a grey tiled roof', 4, 'First real colour of the trip')] },
				{ type: 'map', label: 'Higashiyama, on foot', hasRoute: true }
			]
		},
		{
			title: 'Temples & Gardens',
			blocks: [
				{ type: 'text', text: 'Mornings belonged to the gardens — in before the gates filled, out before the tour groups. The light does the work; you just have to be standing in the right place at 7am.' },
				{ type: 'row', photos: [P('Raked gravel meeting a wall of moss', 4), P('Tofuku-ji bridge over a sea of maples', 5, 'The view everyone comes for — ours at seven in the morning'), P('Vermilion gate, paint cracking', 3), P('A monk crossing an empty courtyard', 3)] },
				{ type: 'hero', photo: P('Full mirror of red and gold in a still pond, framed by a round window', 5, 'Genkō-an — the window of enlightenment') }
			]
		},
		{
			title: 'Arashiyama',
			dates: '15 Nov',
			blocks: [
				{ type: 'hero', photo: P('Bamboo grove, light shafts cutting through the canopy', 4) },
				{ type: 'row', photos: [P('Togetsukyō bridge, river and autumn hills behind', 4), P('Tea-house lantern against dark timber', 3), P('Hillside maples seen from the river boat', 3, 'Shot one-handed from the boat')] },
				{ type: 'map', label: 'The Arashiyama loop', hasRoute: true, hasHeat: true }
			]
		},
		{
			title: 'Evenings & Faces',
			blocks: [
				{ type: 'text', text: 'And then the parts that are really just for us — the counter seats, the second beer, the friends who flew in for the back half.' },
				{ type: 'row', photos: [P('Izakaya counter, steam rising into warm light', 3), F('The two of us at the counter, two beers in'), F('M. laughing under the red lanterns')] },
				{ type: 'hero', photo: F('Last night — the whole group on the bridge, someone’s arm in the frame') }
			]
		}
	]
};

function genTrip(cid: string, name: string, title: string, i: number): TripSrc {
	const th = themes[cid];
	return {
		title,
		dates: dateOf(cid, i),
		cover: th[0] + ', wide',
		intro: 'A short run through ' + name + ' — ' + th[1].toLowerCase() + ', ' + th[2].toLowerCase() + ', and the long roads between.',
		sections: [
			{
				title: th[0],
				blocks: [
					{ type: 'text', text: 'Notes from the first days. The kind of place that rewards getting up early and staying out late.' },
					{ type: 'hero', photo: P(th[0] + ', golden light', 5, th[0]) },
					{ type: 'row', photos: [P(th[1] + ', close detail', 4), P(th[2] + ', wide', 3), P(th[1] + ', in passing', 3)] },
					{ type: 'map', label: name + ' route', hasRoute: true }
				]
			},
			{
				title: th[3],
				blocks: [
					{ type: 'row', photos: [P(th[3] + ', early morning', 4), P(th[2] + ', last light', 3), F('Us on the road — ' + name)] },
					{ type: 'hero', photo: P(th[2] + ', the big view', 5, th[2]) }
				]
			}
		]
	};
}

// country pin placement (mockup countryVM formula), normalized to 0..1
function countryPin(i: number, n: number): { x: number; y: number } {
	const ang = (i / Math.max(n, 1)) * Math.PI * 2;
	const x = 50 + Math.cos(ang) * 30 + ((i % 3) - 1) * 4;
	const y = 50 + Math.sin(ang) * 26;
	return { x: x / 100, y: y / 100 };
}

function minLayerOf(p: PhotoSrc): number {
	return p.face ? 3 : ratingToLayerOrder(p.star);
}

// ---- write -------------------------------------------------------------------

function run() {
	ensureMigrated();

	// idempotent: clear in FK-safe order
	db.delete(photo).run();
	db.delete(block).run();
	db.delete(section).run();
	db.delete(trip).run();
	db.delete(country).run();
	db.delete(shareToken).run();

	db.insert(shareToken)
		.values({
			id: 'dev-token',
			tokenHash: createHash('sha256').update(DEV_TOKEN).digest('hex'),
			createdAt: new Date().toISOString(),
			label: 'dev family link'
		})
		.run();

	for (const c of countries) {
		const tripCount = titles[c.id].length;
		db.insert(country)
			.values({
				code: c.id,
				name: c.name,
				worldPinX: c.x / 100,
				worldPinY: c.y / 100,
				visited: true,
				years: c.years,
				coverLabel: 'cover · ' + themes[c.id][0].toLowerCase() + ', wide'
			})
			.run();

		titles[c.id].forEach((title, i) => {
			const src = c.id === 'jp' && i === 0 ? kyoto : genTrip(c.id, c.name, title, i);
			const tripId = c.id + '-' + i;
			const pin = countryPin(i, tripCount);

			db.insert(trip)
				.values({
					id: tripId,
					slug: tripId,
					title: src.title,
					intro: src.intro,
					countryCode: c.id,
					dateStart: sortableDate(src.dates),
					dateEnd: sortableDate(src.dates),
					datesLabel: src.dates,
					coverLabel: 'cover · ' + src.cover.toLowerCase(),
					defaultLayer: 'highlights',
					countryPinX: pin.x,
					countryPinY: pin.y,
					position: i
				})
				.run();

			src.sections.forEach((sec, si) => {
				const sectionId = `${tripId}-s${si}`;
				db.insert(section)
					.values({
						id: sectionId,
						tripId,
						heading: sec.title,
						datesLabel: sec.dates ?? null,
						position: si
					})
					.run();

				sec.blocks.forEach((b, bi) => {
					const blockId = `${sectionId}-b${bi}`;
					const photos: PhotoSrc[] =
						b.type === 'hero' ? [b.photo] : b.type === 'row' ? b.photos : [];
					// block min layer: min over its photos; text/map default to outermost public (0)
					const blockMin = photos.length ? Math.min(...photos.map(minLayerOf)) : 0;

					db.insert(block)
						.values({
							id: blockId,
							tripId,
							sectionId,
							position: bi,
							kind: b.type === 'text' ? 'text' : b.type === 'map' ? 'map' : 'photo_group',
							layout: b.type === 'hero' ? 'hero' : b.type === 'row' ? 'row' : null,
							textMd: b.type === 'text' ? b.text : null,
							mapLabel: b.type === 'map' ? b.label : null,
							mapNote:
								b.type === 'map'
									? (b.hasRoute ? 'frozen map · route baked' : 'frozen map · pins baked') +
										(b.hasHeat ? ' · heatmap' : '') +
										' to image'
									: null,
							minLayerOrder: blockMin
						})
						.run();

					photos.forEach((p, pi) => {
						db.insert(photo)
							.values({
								id: `${blockId}-p${pi}`,
								blockId,
								position: pi,
								caption: p.caption ?? null,
								label: p.label,
								minLayerOrder: minLayerOf(p),
								rating: p.star ?? null
							})
							.run();
					});
				});
			});
		});
	}

	const counts = {
		countries: db.select().from(country).all().length,
		trips: db.select().from(trip).all().length,
		sections: db.select().from(section).all().length,
		blocks: db.select().from(block).all().length,
		photos: db.select().from(photo).all().length,
		privatePhotos: db.select().from(photo).all().filter((p) => p.minLayerOrder === 3).length
	};
	console.log('Seeded:', counts);
}

run();
