import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getCountry } from '$lib/server/gallery';

export const load: PageServerLoad = ({ locals, params }) => {
	const country = getCountry(locals.session, params.code);
	if (!country) throw error(404, 'Country not found');
	return { country };
};
