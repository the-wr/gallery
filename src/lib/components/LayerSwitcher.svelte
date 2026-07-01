<script lang="ts">
	import { onMount } from 'svelte';

	export interface SwitcherLayer {
		key: string;
		label: string;
		icon: string;
		count: number;
		order: number;
	}

	let {
		layers,
		current,
		select
	}: { layers: SwitcherLayer[]; current: number; select: (order: number) => void } = $props();

	let dock = $state<HTMLDivElement | null>(null);
	let floating = $state(false);

	// Float when the in-flow dock scrolls out of view; re-dock when it returns.
	// (TDD §5: IntersectionObserver on the dock acting as its own sentinel.)
	onMount(() => {
		if (!dock) return;
		const io = new IntersectionObserver(
			([entry]) => {
				floating = !entry.isIntersecting;
			},
			{ rootMargin: '-56px 0px 0px 0px', threshold: 0 }
		);
		io.observe(dock);
		return () => io.disconnect();
	});
</script>

<!-- DOCK: large, pinned in-flow below the title -->
<div bind:this={dock} class="dock-wrap">
	<div class="dock">
		{#each layers as L (L.key)}
			<button class="dock-btn" class:active={L.order === current} onclick={() => select(L.order)}>
				<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={L.icon}></path></svg>
				<span class="lbl">{L.label}</span>
				<span class="cnt">{L.count}</span>
			</button>
		{/each}
	</div>
</div>

<!-- FLOAT A: compact icons-only pill, top-right corner -->
{#if floating}
	<div class="floatA">
		<div class="pill">
			{#each layers as L (L.key)}
				<button class="floatA-btn" class:active={L.order === current} title={L.label} onclick={() => select(L.order)} aria-label={L.label}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={L.icon}></path></svg>
				</button>
			{/each}
		</div>
		<div class="tag">layers</div>
	</div>
{/if}

<style>
	.dock-wrap {
		margin-bottom: 34px;
	}
	.dock {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
		background: var(--paper-2);
		border: 1px solid var(--card-line);
		border-radius: 14px;
		padding: 5px;
	}
	.dock-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		border: none;
		border-radius: 10px;
		padding: 9px 14px;
		background: transparent;
		color: var(--ink-soft);
		transition: all 0.2s;
	}
	.dock-btn.active {
		background: var(--accent);
		color: #fff;
	}
	.dock-btn .lbl {
		font-size: 13.5px;
		font-weight: 500;
	}
	.dock-btn .cnt {
		font-family: var(--mono);
		font-size: 11px;
		opacity: 0.62;
	}

	.floatA {
		position: fixed;
		top: 26px;
		right: 26px;
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		animation: tgfade 0.25s ease;
	}
	.pill {
		display: flex;
		gap: 4px;
		background: rgba(27, 25, 22, 0.92);
		backdrop-filter: blur(8px);
		border-radius: 13px;
		padding: 5px;
		box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.5);
	}
	.floatA-btn {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 9px;
		border: none;
		background: transparent;
		color: var(--faint);
		transition: all 0.2s;
	}
	.floatA-btn.active {
		background: var(--accent);
		color: #fff;
	}
	.tag {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		color: var(--muted-3);
		text-transform: uppercase;
		background: rgba(244, 241, 234, 0.85);
		padding: 2px 6px;
		border-radius: 5px;
	}
</style>
