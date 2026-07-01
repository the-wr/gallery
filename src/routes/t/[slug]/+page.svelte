<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import LayerSwitcher, { type SwitcherLayer } from '$lib/components/LayerSwitcher.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { LAYERS } from '$lib/layers';
	import type { PageData } from './$types';
	import type { BlockVM, PhotoVM } from '$lib/types';

	let { data }: { data: PageData } = $props();
	let trip = $derived(data.trip);

	let layerOrder = $state(data.initialLayerOrder);
	let collapsed = $state<Record<string, boolean>>({});
	let lightbox = $state<{ blockId: string; index: number } | null>(null);
	let scrollAtOpen = 0;

	// Switcher segments: public layers always; faces only once unlocked (R-L8).
	let switcherLayers = $derived<SwitcherLayer[]>(
		LAYERS.filter((l) => l.order < 3 || data.unlocked).map((l) => ({
			key: l.key,
			label: l.label,
			icon: l.icon,
			order: l.order,
			count: trip.layerCounts[l.order]
		}))
	);

	// Apply remembered layer (R-L13) when the URL didn't pin one.
	onMount(() => {
		const url = new URL(location.href);
		if (!url.searchParams.has('l')) {
			let pref: string | null = null;
			try {
				pref = localStorage.getItem('tg_layer');
			} catch {
				/* ignore */
			}
			const found = LAYERS.find((l) => l.key === pref);
			if (found && (found.order < 3 || data.unlocked) && trip.layerCounts[found.order] > 0) {
				layerOrder = found.order;
			}
		}
	});

	const photoVisible = (p: PhotoVM) => p.minLayerOrder <= layerOrder;
	const blockHasVisiblePhoto = (b: BlockVM) =>
		b.kind === 'photo_group' && b.photos.some(photoVisible);

	// document-order block ids (for anchoring + lightbox eject)
	let flatOrder = $derived(trip.sections.flatMap((s) => s.blocks.map((b) => b.id)));

	function sectionVisible(sectionId: string): boolean {
		const s = trip.sections.find((x) => x.id === sectionId);
		return !!s && s.blocks.some(blockHasVisiblePhoto);
	}

	/** Block ids currently rendered & visible (section visible, not collapsed, block shown). */
	function shownBlockIds(): string[] {
		const out: string[] = [];
		for (const s of trip.sections) {
			if (!s.blocks.some(blockHasVisiblePhoto)) continue;
			if (collapsed[s.id]) continue;
			for (const b of s.blocks) {
				if (b.kind === 'photo_group' ? blockHasVisiblePhoto(b) : true) out.push(b.id);
			}
		}
		return out;
	}

	// ---- layer switch with in-place anchoring (R-L9/R-L10) ----
	async function switchLayer(order: number) {
		if (order === layerOrder) return;

		// 1. anchor: shown block nearest the viewport top
		const shownBefore = shownBlockIds();
		let anchorId: string | null = null;
		let anchorTop = 1e9;
		for (const id of shownBefore) {
			const el = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
			if (!el) continue;
			const top = el.getBoundingClientRect().top;
			if (top > -40 && top < anchorTop) {
				anchorTop = top;
				anchorId = id;
			}
		}

		layerOrder = order;
		try {
			localStorage.setItem('tg_layer', LAYERS[order].key);
		} catch {
			/* ignore */
		}
		// reflect layer in URL (R-L14) without a navigation
		const u = new URL(location.href);
		u.searchParams.set('l', LAYERS[order].key);
		history.replaceState(history.state, '', u);

		await tick();

		// 2/3. restore scroll around the anchor (or nearest surviving neighbour)
		if (anchorId) {
			const shownAfter = new Set(shownBlockIds());
			let targetId = anchorId;
			if (!shownAfter.has(anchorId)) {
				const idx = flatOrder.indexOf(anchorId);
				for (let d = 1; d < flatOrder.length; d++) {
					const a = flatOrder[idx + d];
					const b = flatOrder[idx - d];
					if (a && shownAfter.has(a)) {
						targetId = a;
						break;
					}
					if (b && shownAfter.has(b)) {
						targetId = b;
						break;
					}
				}
			}
			const el = document.querySelector<HTMLElement>(`[data-block-id="${targetId}"]`);
			if (el) window.scrollBy(0, el.getBoundingClientRect().top - anchorTop);
		}
	}

	function toggleSection(id: string) {
		collapsed = { ...collapsed, [id]: !collapsed[id] };
	}

	function jumpTo(id: string) {
		const el = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
		if (el) {
			const y = el.getBoundingClientRect().top + window.scrollY - 66;
			window.scrollTo({ top: y, behavior: 'smooth' });
		}
	}

	function goUp() {
		goto('/c/' + trip.country.code);
	}

	// ---- lightbox ----
	function visiblePhotosOf(blockId: string): PhotoVM[] {
		for (const s of trip.sections)
			for (const b of s.blocks)
				if (b.id === blockId && b.kind === 'photo_group') return b.photos.filter(photoVisible);
		return [];
	}
	function openPhoto(blockId: string, index: number) {
		scrollAtOpen = window.scrollY;
		lightbox = { blockId, index };
	}
	function closeLightbox() {
		lightbox = null;
		window.scrollTo(0, scrollAtOpen);
	}
	/** Eject past a group boundary: close and scroll to the adjacent block (R-C8). */
	function ejectLightbox(dir: 1 | -1) {
		const lb = lightbox;
		if (!lb) return;
		const idx = flatOrder.indexOf(lb.blockId);
		const targetId = flatOrder[idx + dir];
		lightbox = null;
		if (targetId) {
			const el = document.querySelector<HTMLElement>(`[data-block-id="${targetId}"]`);
			if (el) {
				window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
				return;
			}
		}
		window.scrollTo(0, scrollAtOpen);
	}

	// ---- per-photo visible index within its group (for lightbox + click) ----
	function visIdx(b: BlockVM, p: PhotoVM): number {
		if (b.kind !== 'photo_group') return -1;
		return b.photos.filter(photoVisible).indexOf(p);
	}

	// style helpers (keep-mounted collapse animations, ported from the mockup)
	const heroWrap = (vis: boolean) =>
		vis
			? 'margin:0 0 30px;max-height:1600px;opacity:1;transition:all .45s ease'
			: 'margin:0;max-height:0;opacity:0;overflow:hidden;transition:all .4s ease';
	const rowWrap = (vis: boolean) =>
		'display:flex;align-items:flex-start;' +
		(vis
			? 'margin:0 0 30px;max-height:1600px;opacity:1;transition:opacity .4s ease'
			: 'margin:0;max-height:0;opacity:0;overflow:hidden;transition:all .4s ease');
	// Gap lives on the cell (margin-left) not the row, so collapsed cells add no
	// trailing space — visible photos always span the full block width.
	const cellStyle = (vis: boolean, firstVisible: boolean) =>
		vis
			? `flex:1 1 0;min-width:0;aspect-ratio:3/2;align-self:flex-start;opacity:1;margin-left:${firstVisible ? '0' : '12px'};transition:flex .5s cubic-bezier(.2,.7,.2,1),opacity .35s ease,margin .3s ease`
			: 'flex:0 0 0;min-width:0;width:0;margin-left:0;aspect-ratio:3/2;align-self:flex-start;opacity:0;overflow:hidden;transition:flex .5s cubic-bezier(.2,.7,.2,1),opacity .3s ease';
	const contentStyle = (open: boolean) =>
		open
			? 'max-height:8000px;opacity:1;transition:all .4s ease'
			: 'max-height:0;opacity:0;overflow:hidden;transition:all .35s ease';
</script>

<article>
	<button class="up" onclick={goUp}><span class="arrow">&larr;</span><span>{trip.country.name}</span></button>
	<div class="meta">{trip.datesLabel} · {trip.country.name}</div>
	<h1>{trip.title}</h1>
	{#if trip.intro}<p class="intro">{trip.intro}</p>{/if}

	<div class="jumps">
		{#each trip.sections as s (s.id)}
			{#if sectionVisible(s.id)}
				<button class="jump" onclick={() => jumpTo(s.id)}>{s.heading}</button>
			{/if}
		{/each}
	</div>

	<LayerSwitcher layers={switcherLayers} current={layerOrder} select={switchLayer} />

	{#each trip.sections as section (section.id)}
		{#if sectionVisible(section.id)}
			<section data-section-id={section.id}>
				<div class="sec-head">
					<button class="sec-toggle" onclick={() => toggleSection(section.id)}>
						<span class="chev" class:open={!collapsed[section.id]}>&rsaquo;</span>
						<h2>{section.heading}</h2>
					</button>
					{#if section.datesLabel}<span class="sec-dates">{section.datesLabel}</span>{/if}
				</div>

				<div style={contentStyle(!collapsed[section.id])}>
					{#each section.blocks as block (block.id)}
						{#if block.kind === 'text'}
							<div data-block-id={block.id} class="text-block"><p>{block.text}</p></div>
						{:else if block.kind === 'map'}
							<figure data-block-id={block.id} class="map-block">
								<div class="map-inner">
									<div class="map-label">{block.label}</div>
									<div class="map-note">{block.note}</div>
								</div>
							</figure>
						{:else if block.layout === 'hero'}
							{@const p = block.photos[0]}
							{@const vis = photoVisible(p)}
							<figure data-block-id={block.id} style={heroWrap(vis)}>
								<button
									class="hero-img"
									data-block={block.id}
									onclick={() => openPhoto(block.id, visIdx(block, p))}
								>
									<span>{p.label}</span>
								</button>
								{#if p.hasCaption}<figcaption>{p.caption}</figcaption>{/if}
							</figure>
						{:else}
							{@const firstVisibleId = block.photos.find(photoVisible)?.id}
							<div data-block-id={block.id} style={rowWrap(block.photos.some(photoVisible))}>
								{#each block.photos as cell (cell.id)}
									<div style={cellStyle(photoVisible(cell), cell.id === firstVisibleId)}>
										<button class="cell-img" onclick={() => openPhoto(block.id, visIdx(block, cell))}>
											<span>{cell.label}</span>
										</button>
									</div>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}
	{/each}

	<div class="end">End of trip · <button onclick={goUp}>back to {trip.country.name}</button></div>
</article>

{#if lightbox}
	{@const group = visiblePhotosOf(lightbox.blockId)}
	<Lightbox
		photos={group}
		index={lightbox.index}
		onclose={closeLightbox}
		oneject={ejectLightbox}
		onindex={(i) => (lightbox = lightbox ? { ...lightbox, index: i } : null)}
	/>
{/if}

<style>
	article {
		max-width: 1180px;
		margin: 0 auto;
		padding: 40px 26px 160px;
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
		margin-bottom: 12px;
		cursor: pointer;
	}
	.up:hover {
		opacity: 0.6;
	}
	.arrow {
		font-size: 14px;
	}
	.meta {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted-2);
		margin-bottom: 14px;
	}
	h1 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: clamp(36px, 5.6vw, 62px);
		line-height: 1.02;
		letter-spacing: -0.015em;
		margin: 0 0 16px;
		max-width: 16ch;
	}
	.intro {
		font-size: 17px;
		line-height: 1.62;
		color: var(--ink-soft);
		margin: 0 0 26px;
		font-family: var(--serif);
	}
	.jumps {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 30px;
	}
	.jump {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--muted);
		background: var(--paper-3);
		border: none;
		padding: 6px 11px;
		border-radius: 14px;
		transition: all 0.2s;
	}
	.jump:hover {
		background: var(--ink);
		color: #f4f1ea;
	}
	section {
		margin-bottom: 8px;
		scroll-margin-top: 72px;
	}
	.sec-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 18px 0 16px;
		border-top: 1px solid var(--rule);
	}
	.sec-toggle {
		display: flex;
		align-items: baseline;
		gap: 12px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}
	.sec-toggle:hover {
		opacity: 0.62;
	}
	.chev {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		color: var(--accent);
		font-size: 20px;
		line-height: 1;
		transform: rotate(0deg);
		transition: transform 0.25s;
	}
	.chev.open {
		transform: rotate(90deg);
	}
	.sec-head h2 {
		font-family: var(--serif);
		font-weight: 500;
		font-size: 27px;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.sec-dates {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--muted-3);
	}
	.text-block {
		margin: 0 0 26px;
	}
	.text-block p {
		font-family: var(--serif);
		font-size: 16px;
		line-height: 1.7;
		color: var(--ink-soft);
		margin: 0;
	}
	.hero-img,
	.cell-img {
		position: relative;
		width: 100%;
		overflow: hidden;
		cursor: zoom-in;
		border-radius: 6px;
		background: var(--paper-2);
		background-image: repeating-linear-gradient(135deg, #e1dac9 0 12px, #e9e3d5 12px 24px);
		border: 1px solid var(--card-line);
		display: grid;
		place-items: center;
		padding: 0;
	}
	.hero-img {
		aspect-ratio: 16 / 9;
	}
	.cell-img {
		height: 100%;
		background-image: repeating-linear-gradient(135deg, #e1dac9 0 11px, #e9e3d5 11px 22px);
	}
	.hero-img:hover,
	.cell-img:hover {
		filter: brightness(0.965);
	}
	.hero-img span {
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.5;
		letter-spacing: 0.02em;
		color: var(--muted-3);
		text-align: center;
		padding: 16px;
		max-width: 78%;
	}
	.cell-img span {
		font-family: var(--mono);
		font-size: 10px;
		line-height: 1.5;
		color: var(--muted-3);
		text-align: center;
		padding: 12px;
	}
	figcaption {
		font-size: 12.5px;
		color: var(--muted-2);
		margin: 9px 2px 0;
		font-style: italic;
		font-family: var(--serif);
	}
	.map-block {
		margin: 0 0 30px;
	}
	.map-inner {
		position: relative;
		width: 100%;
		aspect-ratio: 2 / 1;
		overflow: hidden;
		border-radius: 8px;
		background: #e4ded0;
		background-image: repeating-linear-gradient(45deg, #ded7c6 0 14px, #e6e0d2 14px 28px);
		border: 1px solid var(--card-line);
		display: grid;
		place-items: center;
		text-align: center;
	}
	.map-label {
		font-family: var(--serif);
		font-size: 18px;
		color: var(--muted);
	}
	.map-note {
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--muted-3);
		margin-top: 6px;
	}
	.end {
		border-top: 1px solid var(--rule);
		margin-top: 24px;
		padding-top: 22px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--muted-3);
	}
	.end button {
		background: none;
		border: none;
		color: var(--accent);
		font-family: inherit;
		font-size: 11px;
		padding: 0;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
