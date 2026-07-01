<script lang="ts">
	import { goto } from '$app/navigation';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import Catalogue from '$lib/components/Catalogue.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let c = $derived(data.country);
</script>

<main>
	<div class="head">
		<button class="up" onclick={() => goto('/')}>
			<span class="arrow">&larr;</span><span>World</span>
		</button>
		<h1>{c.name}</h1>
		<p class="sub">{c.sub}</p>
	</div>

	<MapPanel pins={c.pins} caption={'frozen ' + c.name + ' map · one pin per trip'} />
	<div style="margin-bottom:30px"></div>

	<h2>{c.tripsLabel}</h2>
	<Catalogue tiles={c.tiles} />
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 40px 26px 120px;
	}
	.head {
		margin-bottom: 26px;
	}
	.up {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: none;
		border: none;
		padding: 0;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 10px;
		cursor: pointer;
	}
	.up:hover {
		opacity: 0.6;
	}
	.arrow {
		font-size: 14px;
	}
	h1 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: clamp(32px, 4.6vw, 52px);
		line-height: 1.03;
		margin: 0 0 8px;
	}
	.sub {
		font-size: 14px;
		color: var(--muted);
		margin: 0;
	}
	h2 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: 24px;
		margin: 0 0 20px;
	}
</style>
