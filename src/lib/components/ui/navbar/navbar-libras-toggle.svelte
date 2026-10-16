<script lang="ts">
	import HandIcon from '@lucide/svelte/icons/hand';
	import { Button } from '$lib/components/ui/button';
	import { accessibility, setLibras } from '$lib/client/stores/accessibility.svelte';

	const { class: className }: { class?: string } = $props();
</script>

<Button
	class={className}
	variant={accessibility.libras ? 'default' : 'outline'}
	size="icon"
	aria-pressed={accessibility.libras}
	aria-label="Ativar tradução em Libras"
	onclick={() => setLibras(!accessibility.libras)}
>
	<HandIcon class="size-5" />
</Button>
