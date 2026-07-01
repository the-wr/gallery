<script lang="ts">
	import { onMount } from 'svelte';
	import type { PhotoVM } from '$lib/types';

	let {
		photos,
		index,
		onclose,
		oneject,
		onindex
	}: {
		photos: PhotoVM[];
		index: number;
		onclose: () => void;
		oneject: (dir: 1 | -1) => void;
		onindex: (i: number) => void;
	} = $props();

	let zoom = $state(1);
	let current = $derived(photos[index]);

	function step(dir: 1 | -1) {
		const ni = index + dir;
		if (ni >= 0 && ni < photos.length) {
			zoom = 1;
			onindex(ni);
		} else {
			// past a group boundary -> eject into the page (R-C8)
			oneject(dir);
		}
	}

	function toggleZoom() {
		zoom = zoom > 1 ? 1 : 2.2;
	}
	function onWheel(e: WheelEvent) {
		zoom = Math.max(1, Math.min(4, zoom - (e.deltaY > 0 ? 0.2 : -0.2)));
	}

	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onclose();
			else if (e.key === 'ArrowRight') step(1);
			else if (e.key === 'ArrowLeft') step(-1);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<!-- backdrop: click closes; inner stops propagation (R-C11 return-in-place via parent) -->
<div class="backdrop" onclick={onclose} role="presentation">
	<div class="bar">
		<span class="counter">{index + 1} / {photos.length}</span>
		<button class="close" onclick={onclose} aria-label="Close">&times;</button>
	</div>

	<div class="stage" onclick={(e) => e.stopPropagation()} role="presentation">
		<button class="navbtn left" onclick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">&lsaquo;</button>
		<div
			class="frame"
			style="transform:scale({zoom});cursor:{zoom > 1 ? 'zoom-out' : 'zoom-in'}"
			onclick={toggleZoom}
			onwheel={onWheel}
			role="presentation"
		>
			<div class="hatch"><span>{current?.label}</span></div>
		</div>
		<button class="navbtn right" onclick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">&rsaquo;</button>
	</div>

	<div class="cap" onclick={(e) => e.stopPropagation()} role="presentation">
		{#if current?.hasCaption}
			<span class="caption">{current.caption}</span>
		{:else}
			<span class="hint">no caption · esc to close, arrows to step</span>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(20, 18, 15, 0.95);
		display: flex;
		flex-direction: column;
		animation: tglb 0.2s ease;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 22px;
		color: #cfc8bb;
	}
	.counter {
		font-family: var(--mono);
		font-size: 12px;
	}
	.close {
		background: none;
		border: none;
		color: #cfc8bb;
		font-size: 22px;
		line-height: 1;
		padding: 6px;
	}
	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		padding: 0 14px;
	}
	.navbtn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.16);
		color: #fff;
		font-size: 20px;
	}
	.navbtn.left {
		left: 18px;
	}
	.navbtn.right {
		right: 18px;
	}
	.frame {
		position: relative;
		width: min(86vw, 1180px);
		aspect-ratio: 3 / 2;
		transition: transform 0.18s ease;
	}
	.hatch {
		position: absolute;
		inset: 0;
		background: #3a352d;
		background-image: repeating-linear-gradient(135deg, #34302a 0 16px, #3d382f 16px 32px);
		display: grid;
		place-items: center;
		border-radius: 4px;
	}
	.hatch span {
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.6;
		color: var(--muted-3);
		text-align: center;
		padding: 24px;
		max-width: 70%;
	}
	.cap {
		min-height: 54px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px 22px 22px;
	}
	.caption {
		font-family: var(--serif);
		font-style: italic;
		font-size: 15px;
		color: #cfc8bb;
		text-align: center;
	}
	.hint {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--muted);
	}
</style>
