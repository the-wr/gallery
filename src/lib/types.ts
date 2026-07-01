// Serializable view-model types shared between server (privacy-filtered) and client.

export type SessionKind = 'anonymous' | 'unlocked' | 'owner';

export interface PhotoVM {
	id: string;
	label: string; // placeholder description standing in for image bytes
	caption: string | null;
	hasCaption: boolean;
	minLayerOrder: number; // density key; client filters by current layer
}

export type BlockVM =
	| { id: string; kind: 'text'; minLayerOrder: number; text: string }
	| { id: string; kind: 'map'; minLayerOrder: number; label: string; note: string }
	| {
			id: string;
			kind: 'photo_group';
			layout: 'hero' | 'row';
			minLayerOrder: number;
			photos: PhotoVM[];
	  };

export interface SectionVM {
	id: string;
	heading: string;
	datesLabel: string | null;
	blocks: BlockVM[];
}

export interface TripVM {
	id: string;
	slug: string;
	title: string;
	intro: string | null;
	datesLabel: string;
	country: { code: string; name: string };
	defaultLayer: string;
	sections: SectionVM[];
	/** cumulative visible-photo count per layer order, session-permitted set */
	layerCounts: number[];
}

export interface TileVM {
	nav: string; // 'country:<code>' | 'trip:<slug>'
	cover: string;
	primary: string;
	secondary: string;
}

export interface PinVM {
	id: string;
	x: number; // 0..1 over the static image
	y: number;
	count: string | null; // badge text (world pins) or null
	name: string;
	sub: string; // preview second line
	thumb: string;
	nav: string;
}

export interface WorldVM {
	pins: PinVM[];
	tiles: TileVM[];
	catSub: string;
	granularity: 'countries' | 'trips';
}

export interface CountryVM {
	code: string;
	name: string;
	sub: string;
	tripsLabel: string;
	pins: PinVM[];
	tiles: TileVM[];
}
