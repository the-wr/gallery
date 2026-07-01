// Fixed v1 layer set (PRD §5, TDD §4). Layers are a global enum, not rows.
// order: 0 postcards (outermost) -> 3 faces (innermost, private).
// A photo with min_layer_order = k appears whenever requested layer order >= k.

export interface LayerDef {
	key: LayerKey;
	label: string;
	/** single SVG path drawn in a 24x24 viewBox, stroke=currentColor */
	icon: string;
	/** order index; also the value compared against photo.minLayerOrder */
	order: number;
	private: boolean;
}

export type LayerKey = 'postcards' | 'highlights' | 'chronology' | 'faces';

export const LAYERS: LayerDef[] = [
	{ key: 'postcards', label: 'Postcards', order: 0, private: false, icon: 'M7 7h10v10H7z' },
	{
		key: 'highlights',
		label: 'Highlights',
		order: 1,
		private: false,
		icon: 'M5 9h7v7h-7zM11 6h7v7h-7z'
	},
	{
		key: 'chronology',
		label: 'Chronology',
		order: 2,
		private: false,
		icon: 'M4 12h16M8 9v6M12 9v6M16 9v6'
	},
	{
		key: 'faces',
		label: 'Faces',
		order: 3,
		private: true,
		icon: 'M12 5a7 7 0 110 14 7 7 0 010-14M9.6 11v.5M14.4 11v.5M9.4 14.4c1.7 1.5 3.9 1.5 5.6 0'
	}
];

/** The deepest layer order that is public (used for private-gating fallback). */
export const DEEPEST_PUBLIC_ORDER = 2;
/** Layers visible to a non-unlocked session. */
export const PUBLIC_LAYERS = LAYERS.filter((l) => !l.private);

export const DEFAULT_LAYER: LayerKey = 'highlights';

export function layerByKey(key: string): LayerDef | undefined {
	return LAYERS.find((l) => l.key === key);
}

/**
 * Rating -> minimum layer order (PRD R-L3 / TDD §9 fixed v1 map):
 * 5★ -> postcards(0), 4★ -> highlights(1), else -> chronology(2).
 * Private (faces) is never auto-assigned from rating.
 */
export function ratingToLayerOrder(rating: number | null | undefined): number {
	if (rating === 5) return 0;
	if (rating === 4) return 1;
	return 2;
}
