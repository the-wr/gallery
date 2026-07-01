import type { Handle } from '@sveltejs/kit';
import { ensureMigrated } from '$lib/server/db/migrate';
import { resolveSession } from '$lib/server/session';

ensureMigrated();

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = resolveSession(event.cookies);

	const response = await resolve(event);

	// Public pages are cacheable; unlocked/owner responses must never be shared.
	if (event.locals.session === 'anonymous') {
		response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
	} else {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
