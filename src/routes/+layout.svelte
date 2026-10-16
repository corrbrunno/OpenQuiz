<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import Navbar from '$lib/components/ui/navbar/navbar.svelte';
	import { closeLibras, openLibras } from '$lib/client/libras';
	import { accessibility } from '$lib/client/stores/accessibility.svelte';
	import { iniciarAuth } from '$lib/client/stores/auth.svelte';

	let { children }: { children: Snippet } = $props();

	$effect(() => {
		void iniciarAuth();
	});

	$effect(() => {
		if (!browser) return;

		if (accessibility.libras) void openLibras();
		else closeLibras();
	});
</script>

<ModeWatcher />
<Navbar />

<main class="mx-auto w-full max-w-5xl px-4 py-8">
	{@render children()}
</main>
