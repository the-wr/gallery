<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PinVM } from '$lib/types';

	let {
		pins,
		caption,
		showBadge = false
	}: { pins: PinVM[]; caption: string; showBadge?: boolean } = $props();

	let hovered = $state<string | null>(null);

	function nav(target: string) {
		const [kind, id] = target.split(':');
		if (kind === 'country') goto('/c/' + id);
		else if (kind === 'trip') goto('/t/' + id);
	}
</script>

<div class="map">
	<div class="map-cap">{caption}</div>
	{#each pins as pin (pin.id)}
		<div
			class="pin-wrap"
			style="left:{pin.x * 100}%;top:{pin.y * 100}%;z-index:{hovered === pin.id ? 60 : 2}"
		>
			<button
				class="pin-dot"
				class:hot={hovered === pin.id}
				onmouseenter={() => (hovered = pin.id)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = pin.id)}
				onblur={() => (hovered = null)}
				onclick={() => nav(pin.nav)}
				aria-label={pin.name}
			>
				{#if showBadge && pin.count}<span class="pin-badge">{pin.count}</span>{/if}
			</button>
			{#if hovered === pin.id}
				<div class="preview" style="bottom:{showBadge ? 30 : 26}px">
					<div class="preview-thumb"><span>{pin.thumb}</span></div>
					<div class="preview-body">
						<div class="preview-name">{pin.name}</div>
						<div class="preview-sub">{pin.sub}</div>
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		aspect-ratio: 21 / 9;
		border-radius: 14px;
		border: 1px solid var(--card-line);
		background: var(--paper-2);
		background-image: var(--hatch);
	}
	.map-cap {
		position: absolute;
		left: 16px;
		bottom: 13px;
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.04em;
		color: var(--muted-3);
		background: rgba(244, 241, 234, 0.7);
		padding: 5px 9px;
		border-radius: 6px;
	}
	.pin-wrap {
		position: absolute;
		transform: translate(-50%, -50%);
	}
	.pin-dot {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--ink);
		border: 2px solid #f4f1ea;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			background 0.18s ease;
		box-shadow: 0 3px 8px -2px rgba(0, 0, 0, 0.45);
		padding: 0;
	}
	.pin-dot.hot {
		transform: scale(1.14);
		background: var(--accent);
	}
	.pin-badge {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 500;
		color: #fff;
	}
	.preview {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: 178px;
		background: var(--ink);
		color: #f4f1ea;
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.5);
		z-index: 40;
		pointer-events: none;
	}
	.preview-thumb {
		height: 84px;
		background: #3a352d;
		background-image: repeating-linear-gradient(135deg, #34302a 0 10px, #3a352d 10px 20px);
		display: grid;
		place-items: center;
	}
	.preview-thumb span {
		font-family: var(--mono);
		font-size: 9.5px;
		color: var(--muted-3);
		padding: 0 10px;
		text-align: center;
	}
	.preview-body {
		padding: 9px 11px;
	}
	.preview-name {
		font-family: var(--serif);
		font-size: 15px;
	}
	.preview-sub {
		font-size: 11.5px;
		color: #b8b0a2;
		margin-top: 1px;
	}
</style>
