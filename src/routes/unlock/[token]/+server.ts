import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { isValidShareToken, hashToken, UNLOCK_COOKIE } from '$lib/server/session';

const isLocalHttp = (process.env.BASE_URL ?? 'http://localhost:5173').startsWith('http://localhost');

/**
 * Share-link unlock (TDD §6 / PRD §4). Validate the token, set an httpOnly
 * cookie carrying its hash, then 302 to a clean destination so the raw token
 * leaves the address bar (no history entry, no shoulder-surf leak).
 */
export const GET: RequestHandler = ({ params, cookies, url }) => {
	const raw = params.token;
	if (isValidShareToken(raw)) {
		cookies.set(UNLOCK_COOKIE, hashToken(raw), {
			path: '/',
			httpOnly: true,
			secure: !isLocalHttp, // relaxed on http://localhost so it's testable without TLS
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	// Redirect to the clean destination whether or not the token was valid —
	// an invalid token reveals nothing (just lands on the public home).
	const dest = url.searchParams.get('to') ?? '/';
	throw redirect(303, dest.startsWith('/') ? dest : '/');
};
