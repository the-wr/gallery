import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';

let done = false;

/** Apply pending migrations once. Safe to call on every app startup. */
export function ensureMigrated() {
	if (done) return;
	migrate(db, { migrationsFolder: './drizzle' });
	done = true;
}
