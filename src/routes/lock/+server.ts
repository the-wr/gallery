import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { UNLOCK_COOKIE } from '$lib/server/session';

/** Re-lock: clear the unlock cookie and return to the public home. */
export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(UNLOCK_COOKIE, { path: '/' });
	throw redirect(303, '/');
};
