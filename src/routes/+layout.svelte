<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import Navbar from '$lib/components/ui/navbar/navbar.svelte';
	import { closeLibras, openLibras } from '$lib/client/libras';
	import {
		acessibilidadePronta,
		accessibility,
		aplicarFonte
	} from '$lib/client/stores/accessibility.svelte';
	import { authState, iniciarAuth } from '$lib/client/stores/auth.svelte';
	import {
		acompanharAtividade,
		garantirSessao,
		limparSessao,
		limparAviso,
		sessaoUsuario
	} from '$lib/client/stores/sessao-usuario.svelte';

	let { children }: { children: Snippet } = $props();

	$effect(() => {
		void iniciarAuth();
	});

	// aplica a escala de fonte guardada já no boot (antes só era aplicada ao clicar)
	$effect(() => {
		if (!browser || !acessibilidadePronta()) return;
		aplicarFonte(accessibility.fontScale);
	});

	$effect(() => {
		if (!browser) return;

		if (accessibility.libras) void openLibras();
		else closeLibras();
	});

	// sessão do app: abre no login, renova na atividade e expira por inatividade
	$effect(() => {
		const usuario = authState.user;
		if (!browser) return;

		if (!usuario) {
			limparSessao();
			return;
		}

		void garantirSessao(usuario);
		return acompanharAtividade(usuario);
	});
</script>

<ModeWatcher />
<Navbar />

{#if sessaoUsuario.aviso}
	<div class="mx-auto mt-3 w-full max-w-5xl px-4">
		<div
			class="border-destructive/40 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
			role="alert"
		>
			<span>{sessaoUsuario.aviso}</span>
			<button class="font-medium underline" onclick={limparAviso}>fechar</button>
		</div>
	</div>
{/if}

<main class="mx-auto w-full max-w-5xl px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
	{@render children()}
</main>
