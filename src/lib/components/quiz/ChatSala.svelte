<script lang="ts">
	import { onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { Button } from '$lib/components/ui/button';
	import { criarChat } from '$lib/client/chat.svelte';

	let {
		codigo,
		usuario,
		souDono = false,
		meuUid = ''
	}: { codigo: string; usuario: User; souDono?: boolean; meuUid?: string } = $props();

	const chat = criarChat();
	let texto = $state('');
	let enviando = $state(false);
	let fim = $state<HTMLDivElement>();

	onMount(() => chat.assinar(codigo, usuario));

	// rola para a última mensagem quando chega alguma
	$effect(() => {
		void chat.mensagens.length;
		fim?.scrollIntoView({ block: 'end' });
	});

	async function enviar() {
		const conteudo = texto;
		if (!conteudo.trim() || enviando) return;

		enviando = true;
		const ok = await chat.enviar(conteudo, usuario, codigo);
		enviando = false;

		// o campo só é limpo quando o servidor confirma (nada de "enviado" fictício)
		if (ok) texto = '';
	}

	function aoTeclar(evento: KeyboardEvent) {
		if (evento.key === 'Enter' && !evento.shiftKey) {
			evento.preventDefault();
			void enviar();
		}
	}
</script>

<section class="mt-6 flex h-80 flex-col rounded-lg border" aria-label="Chat da sala">
	<header class="flex items-center justify-between gap-2 border-b px-3 py-2">
		<div class="flex items-center gap-2">
			<h2 class="text-sm font-semibold">Chat da sala</h2>
			{#if chat.encerrada}
				<span class="text-muted-foreground text-xs">sala encerrada</span>
			{:else if !chat.ativo}
				<span class="text-muted-foreground text-xs">pausado</span>
			{:else if chat.conexao === 'caindo'}
				<span class="text-destructive text-xs">reconectando…</span>
			{:else if chat.conexao === 'aberta'}
				<span class="text-muted-foreground text-xs">ao vivo</span>
			{:else}
				<span class="text-muted-foreground text-xs">conectando…</span>
			{/if}
		</div>

		{#if souDono && !chat.encerrada}
			<Button
				variant="outline"
				size="sm"
				onclick={() => void chat.alternarChat(usuario, codigo, !chat.ativo)}
			>
				{chat.ativo ? 'Pausar chat' : 'Retomar chat'}
			</Button>
		{/if}
	</header>

	<div class="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm" role="log" aria-live="polite">
		{#if chat.carregando}
			<p class="text-muted-foreground">Carregando mensagens…</p>
		{:else if chat.mensagens.length === 0}
			<p class="text-muted-foreground">Nenhuma mensagem ainda.</p>
		{/if}

		{#each chat.mensagens as mensagem (mensagem.id)}
			<div class:justify-end={mensagem.autorUid === meuUid} class="flex">
				<div
					class="max-w-[85%] rounded-lg px-3 py-1.5"
					class:bg-primary={mensagem.autorUid === meuUid}
					class:text-primary-foreground={mensagem.autorUid === meuUid}
					class:bg-muted={mensagem.autorUid !== meuUid}
				>
					{#if mensagem.autorUid !== meuUid}
						<p class="text-muted-foreground text-xs">{mensagem.autorNome}</p>
					{/if}
					<p class="whitespace-pre-wrap break-words">{mensagem.texto}</p>
				</div>
			</div>
		{/each}
		<div bind:this={fim}></div>
	</div>

	{#if chat.erro}
		<p class="text-destructive border-t px-3 py-2 text-xs" role="alert">{chat.erro}</p>
	{/if}

	{#if chat.encerrada}
		<p class="text-muted-foreground border-t px-3 py-2 text-xs">
			O chat acompanha a sala: encerrada a rodada, o histórico é apagado.
		</p>
	{:else if !chat.ativo}
		<p class="text-muted-foreground border-t px-3 py-2 text-xs">
			O apresentador pausou o chat. Você continua na sala.
		</p>
	{:else}
		<div class="flex gap-2 border-t p-2">
			<input
				class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
				placeholder="Escreva uma mensagem…"
				bind:value={texto}
				onkeydown={aoTeclar}
				maxlength={500}
				aria-label="Mensagem"
			/>
			<Button size="sm" disabled={enviando || !texto.trim()} onclick={() => void enviar()}>
				{enviando ? 'Enviando…' : 'Enviar'}
			</Button>
		</div>
	{/if}
</section>
