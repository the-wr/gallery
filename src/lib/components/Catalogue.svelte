<script lang="ts">
	import { goto } from '$app/navigation';
	import type { TileVM } from '$lib/types';

	let { tiles }: { tiles: TileVM[] } = $props();

	function nav(target: string) {
		const [kind, id] = target.split(':');
		if (kind === 'country') goto('/c/' + id);
		else if (kind === 'trip') goto('/t/' + id);
	}
</script>

<div class="grid">
	{#each tiles as tile (tile.nav + tile.primary)}
		<button class="tg-tile tile" onclick={() => nav(tile.nav)}>
			<div class="tg-cover cover"><span>{tile.cover}</span></div>
			<div class="caption">
				<span class="primary">{tile.primary}</span>
				<span class="dot">·</span>
				<span class="secondary">{tile.secondary}</span>
			</div>
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(228px, 1fr));
		gap: 22px 20px;
	}
	.tile {
		text-align: left;
		background: none;
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 11px;
		cursor: pointer;
	}
	.cover {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 2;
		border-radius: 9px;
		overflow: hidden;
		border: 1px solid var(--card-line);
		background: var(--paper-2);
		background-image: repeating-linear-gradient(135deg, #e1dac9 0 11px, #e9e3d5 11px 22px);
		display: grid;
		place-items: center;
	}
	.cover span {
		font-family: var(--mono);
		font-size: 10px;
		line-height: 1.5;
		color: var(--muted-3);
		text-align: center;
		padding: 14px;
	}
	.caption {
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}
	.primary {
		font-family: var(--serif);
		font-size: 16.5px;
		line-height: 1.25;
		letter-spacing: -0.005em;
	}
	.dot {
		color: #c7c0ae;
		font-size: 12px;
	}
	.secondary {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--muted-2);
		line-height: 1.6;
	}
</style>
