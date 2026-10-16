<script lang="ts">
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';

	const { class: className }: { class?: string } = $props();
</script>

<Button
	class={className}
	onclick={toggleMode}
	variant="outline"
	size="icon"
	aria-label="Alternar tema claro e escuro"
>
	<SunIcon
		class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 !transition-all dark:-rotate-90 dark:scale-0"
	/>
	<MoonIcon
		class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 !transition-all dark:rotate-0 dark:scale-100"
	/>
</Button>
