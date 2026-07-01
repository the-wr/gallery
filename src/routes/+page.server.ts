import type { PageServerLoad } from './$types';
import { getWorld } from '$lib/server/gallery';

export const load: PageServerLoad = ({ locals, url }) => {
	const granularity = url.searchParams.get('g') === 'trips' ? 'trips' : 'countries';
	return { world: getWorld(locals.session, granularity) };
};
