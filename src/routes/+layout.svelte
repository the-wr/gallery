<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';
	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
</script>

{#if data.session === 'unlocked'}
	<!-- In-flow within the content column: scrolls with the page, right-aligned
	     to the content edge at the title band (height:0 so it doesn't push content). -->
	<div class="chip-band">
		<div class="chip">
			<form method="POST" action="/lock">
				<button type="submit">
					<span class="dot"></span>Private layers unlocked
				</button>
			</form>
		</div>
	</div>
{/if}

{@render children()}

<style>
	.chip-band {
		max-width: 1180px;
		margin: 0 auto;
		position: relative;
		height: 0;
		z-index: 60;
	}
	.chip {
		position: absolute;
		top: 46px;
		right: 26px;
	}
	.chip button {
		display: flex;
		align-items: center;
		gap: 7px;
		background: var(--ink);
		border: none;
		color: #f4f1ea;
		font-size: 12px;
		padding: 7px 13px;
		border-radius: 20px;
		box-shadow: 0 8px 20px -10px rgba(40, 34, 24, 0.5);
		cursor: pointer;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-green);
		display: inline-block;
	}
</style>
