import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isNull } from 'drizzle-orm';
import { db } from './db';
import { shareToken } from './db/schema';
import type { SessionKind } from '$lib/types';

export const UNLOCK_COOKIE = 'tg_unlock';
export const OWNER_COOKIE = 'tg_owner';

export function hashToken(raw: string): string {
	return createHash('sha256').update(raw).digest('hex');
}

/** Generate a new high-entropy share token (raw, URL-safe). Store only its hash. */
export function generateToken(): { raw: string; hash: string } {
	const raw = randomBytes(32).toString('base64url'); // 256-bit
	return { raw, hash: hashToken(raw) };
}

function constantTimeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	try {
		return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
	} catch {
		return false;
	}
}

/** Hashes of all currently non-revoked share tokens. */
function activeTokenHashes(): string[] {
	return db.select().from(shareToken).where(isNull(shareToken.revokedAt)).all().map((t) => t.tokenHash);
}

/** True if the raw token matches a non-revoked share token (constant-time). */
export function isValidShareToken(raw: string): boolean {
	const h = hashToken(raw);
	return activeTokenHashes().some((th) => constantTimeEqualHex(th, h));
}

/**
 * Resolve session kind from request cookies. Owner > unlocked > anonymous.
 * The unlock cookie carries a token hash and is RE-VALIDATED against active
 * tokens on every request, so revoking a token immediately drops the session
 * back to anonymous (rotate-to-revoke, TDD §6).
 */
export function resolveSession(cookies: {
	get: (name: string) => string | undefined;
}): SessionKind {
	if (cookies.get(OWNER_COOKIE)) return 'owner';
	const cookieHash = cookies.get(UNLOCK_COOKIE);
	if (cookieHash && activeTokenHashes().some((th) => constantTimeEqualHex(th, cookieHash))) {
		return 'unlocked';
	}
	return 'anonymous';
}
