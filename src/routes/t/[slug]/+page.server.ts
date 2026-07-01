import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getTrip } from '$lib/server/gallery';
import { layerByKey, DEFAULT_LAYER, DEEPEST_PUBLIC_ORDER } from '$lib/layers';

export const load: PageServerLoad = ({ locals, params, url }) => {
	const trip = getTrip(locals.session, params.slug);
	if (!trip) throw error(404, 'Trip not found');

	const unlocked = locals.session !== 'anonymous';

	// Precedence (R-L14): explicit URL ?l= -> album default. (Remembered/sticky
	// is applied client-side from localStorage when no URL param is present.)
	const urlKey = url.searchParams.get('l');
	let order = (layerByKey(urlKey ?? '') ?? layerByKey(trip.defaultLayer) ?? layerByKey(DEFAULT_LAYER))!
		.order;

	// Private gating (R-L15): a faces request without unlock silently falls back
	// to the deepest public layer — revealing nothing.
	if (order === 3 && !unlocked) order = DEEPEST_PUBLIC_ORDER;

	// Empty-layer fallback (R-L13): if nothing is visible at this layer, drop to
	// the nearest non-empty public layer.
	if (trip.layerCounts[order] === 0) {
		for (let o = DEEPEST_PUBLIC_ORDER; o >= 0; o--) {
			if (trip.layerCounts[o] > 0) {
				order = o;
				break;
			}
		}
	}

	return { trip, initialLayerOrder: order, unlocked };
};
