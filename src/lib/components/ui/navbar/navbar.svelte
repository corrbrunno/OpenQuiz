<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authState, sair } from '$lib/client/stores/auth.svelte';
	import FontSizeToggle from './navbar-font-size-toggle.svelte';
	import LibrasToggle from './navbar-libras-toggle.svelte';
	import ThemeToggle from './navbar-theme-toggle.svelte';
</script>

<header class="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
	<div class="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
		<a href="/" class="flex items-center gap-2 text-base font-semibold">
			<span class="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-sm">
				Q
			</span>
			<span class="hidden sm:inline">Online Quiz</span>
		</a>

		<nav class="flex items-center gap-1">
			<Button variant="ghost" size="sm" href="/meus-quizzes">Meus questionários</Button>
			<Button variant="ghost" size="sm" href="/criar">Criar quiz</Button>
			<Button variant="ghost" size="sm" href="/entrar">Entrar em sala</Button>
		</nav>

		<div class="flex items-center gap-2">
			<FontSizeToggle />
			<LibrasToggle />
			<ThemeToggle />
			{#if authState.user}
				<span class="text-muted-foreground hidden max-w-40 truncate text-sm md:inline">
					{authState.user.email}
				</span>
				<Button variant="outline" size="sm" onclick={sair}>Sair</Button>
			{:else}
				<Button size="sm" href="/login">Entrar</Button>
			{/if}
		</div>
	</div>
</header>
