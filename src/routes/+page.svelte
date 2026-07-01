<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import Catalogue from '$lib/components/Catalogue.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let gran = $derived(data.world.granularity);

	function setGran(g: 'countries' | 'trips') {
		try {
			localStorage.setItem('tg_gran', g);
		} catch {
			/* ignore */
		}
		goto(g === 'countries' ? '/' : '/?g=trips', { noScroll: true });
	}

	// Apply remembered granularity preference when the URL doesn't specify one.
	onMount(() => {
		const url = new URL(location.href);
		if (!url.searchParams.has('g')) {
			let pref: string | null = null;
			try {
				pref = localStorage.getItem('tg_gran');
			} catch {
				/* ignore */
			}
			if (pref === 'trips') goto('/?g=trips', { noScroll: true, replaceState: true });
		}
	});
</script>

<main>
	<div class="head">
		<div class="kicker">The front door</div>
		<h1>Where I&rsquo;ve pointed a camera.</h1>
	</div>

	<MapPanel pins={data.world.pins} showBadge caption="frozen world map · baked image · clickable pin overlay" />
	<div style="margin-bottom:34px"></div>

	<div class="cat-head">
		<div>
			<h2>The catalogue</h2>
			<p>{data.world.catSub}</p>
		</div>
		<div class="toggle">
			<button class:active={gran === 'countries'} onclick={() => setGran('countries')}>Countries</button>
			<button class:active={gran === 'trips'} onclick={() => setGran('trips')}>Trips</button>
		</div>
	</div>

	<Catalogue tiles={data.world.tiles} />
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 46px 26px 120px;
	}
	.head {
		margin-bottom: 30px;
	}
	.kicker {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 12px;
	}
	h1 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: clamp(34px, 5vw, 58px);
		line-height: 1.04;
		letter-spacing: -0.01em;
		margin: 0;
		white-space: nowrap;
	}
	.cat-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 22px;
	}
	.cat-head h2 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: 26px;
		margin: 0;
	}
	.cat-head p {
		font-size: 13px;
		color: var(--muted);
		margin: 4px 0 0;
	}
	.toggle {
		display: inline-flex;
		background: var(--paper-2);
		border: 1px solid var(--card-line);
		border-radius: 22px;
		padding: 3px;
	}
	.toggle button {
		border: none;
		border-radius: 18px;
		padding: 7px 16px;
		font-size: 13px;
		font-weight: 500;
		background: transparent;
		color: var(--muted);
		transition: all 0.2s;
	}
	.toggle button.active {
		font-weight: 600;
		background: var(--ink);
		color: #f4f1ea;
	}
</style>
