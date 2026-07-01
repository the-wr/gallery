import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// better-sqlite3 is a native module; keep it external to the SSR bundle.
	ssr: {
		external: ['better-sqlite3']
	}
});
