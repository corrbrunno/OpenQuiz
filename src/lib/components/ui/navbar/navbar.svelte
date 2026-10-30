<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authState, sair } from '$lib/client/stores/auth.svelte';
	import FontSizeToggle from './navbar-font-size-toggle.svelte';
	import LibrasToggle from './navbar-libras-toggle.svelte';
	import ThemeToggle from './navbar-theme-toggle.svelte';
</script>

<!--
	No celular a barra ocupa duas linhas: marca + controles na primeira e a navegação
	(rolável na horizontal) na segunda. Em uma linha só o conteúdo passava de 650 px numa
	tela de 390 px, o que estourava a largura do documento e fazia o WebView tirar o zoom.
-->
<header
	class="bg-background/80 sticky top-0 z-40 border-b backdrop-blur"
	style="padding-top: env(safe-area-inset-top, 0px)"
>
	<div
		class="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:h-16 sm:flex-nowrap sm:gap-x-3 sm:px-4 sm:py-0"
	>
		<a href="/" class="flex min-w-0 shrink-0 items-center gap-2 text-base font-semibold">
			<span class="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-md text-sm">
				Q
			</span>
			<span class="hidden sm:inline">Online Quiz</span>
		</a>

		<nav
			class="-mx-3 order-last flex w-full items-center gap-1 overflow-x-auto px-3 pb-0.5 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0"
			aria-label="Navegação principal"
		>
			<Button variant="ghost" size="sm" href="/meus-quizzes" class="shrink-0 px-2 text-[13px] sm:px-3 sm:text-sm">
				Meus questionários
			</Button>
			<Button variant="ghost" size="sm" href="/criar" class="shrink-0 px-2 text-[13px] sm:px-3 sm:text-sm">
				Criar quiz
			</Button>
			<Button variant="ghost" size="sm" href="/entrar" class="shrink-0 px-2 text-[13px] sm:px-3 sm:text-sm">
				Entrar em sala
			</Button>
		</nav>

		<div class="ml-auto flex items-center gap-1 sm:gap-2">
			<FontSizeToggle />
			<LibrasToggle />
			<ThemeToggle />
			{#if authState.user}
				<Button variant="ghost" size="sm" href="/perfil" class="px-2 sm:px-3">Perfil</Button>
				<span class="text-muted-foreground hidden max-w-40 truncate text-sm md:inline">
					{authState.user.email}
				</span>
				<Button variant="outline" size="sm" onclick={sair} class="px-2 sm:px-3">Sair</Button>
			{:else}
				<Button size="sm" href="/login">Entrar</Button>
			{/if}
		</div>
	</div>
</header>
