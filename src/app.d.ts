import type { SessionKind } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			session: SessionKind;
		}
	}
}

export {};
