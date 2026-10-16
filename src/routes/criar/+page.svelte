<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import EditorPergunta from '$lib/components/quiz/EditorPergunta.svelte';
	import { mensagemDeErro, salvarQuestionario } from '$lib/client/quiz';
	import { authState } from '$lib/client/stores/auth.svelte';
	import { novaPergunta, validarPergunta, type RascunhoPergunta } from '$lib/quiz/rascunhos';

	let titulo = $state('');
	let perguntas = $state<RascunhoPergunta[]>([novaPergunta()]);
	let salvando = $state(false);
	let erro = $state('');
	let sucesso = $state('');

	function adicionarPergunta() {
		perguntas.push(novaPergunta());
	}

	function removerPergunta(indice: number) {
		const [removida] = perguntas.splice(indice, 1);
		if (removida?.previa) URL.revokeObjectURL(removida.previa);
	}

	async function salvar() {
		erro = '';
		sucesso = '';

		if (!titulo.trim()) {
			erro = 'Dê um título ao questionário.';
			return;
		}
		if (perguntas.length === 0) {
			erro = 'Adicione pelo menos uma pergunta.';
			return;
		}

		for (const [indice, rascunho] of perguntas.entries()) {
			const problema = validarPergunta(rascunho);
			if (problema) {
				erro = `Pergunta ${indice + 1}: ${problema}`;
				return;
			}
		}

		const usuario = authState.user;
		if (!usuario) {
			erro = 'Sua sessão expirou. Entre novamente para salvar.';
			return;
		}

		salvando = true;
		try {
			const resultado = await salvarQuestionario(titulo, perguntas, usuario);
			sucesso = `Questionário salvo. Código da sala: ${resultado.codigo}`;
			titulo = '';
			perguntas = [novaPergunta()];
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			salvando = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight">Criar questionário</h1>
		<p class="text-muted-foreground text-sm">
			Escolha o tipo de cada pergunta: múltipla escolha, verdadeiro ou falso, categorizar, reordenar ou
			tabela de correspondência. Cada pergunta aceita uma imagem.
		</p>
	</header>

	{#if authState.carregando}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Verificando sua sessão…</p>
			</Card.Content>
		</Card.Root>
	{:else if !authState.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Faça login para criar questionários</Card.Title>
				<Card.Description>O criador do quiz fica vinculado à sua conta.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button href="/login?redirect=/criar">Entrar ou criar conta</Button>
				<Button variant="outline" href="/">Voltar ao início</Button>
			</Card.Content>
		</Card.Root>
	{:else if !browser}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Carregando o editor…</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Identificação</Card.Title>
				<Card.Description>Criando como {authState.user.email}</Card.Description>
			</Card.Header>
			<Card.Content>
				<label class="flex flex-col gap-1 text-sm font-medium">
					Título do questionário
					<Input placeholder="Ex.: Revisão de História — 2º bimestre" bind:value={titulo} />
				</label>
			</Card.Content>
		</Card.Root>

		{#each perguntas as rascunho, indice (rascunho.id)}
			<EditorPergunta
				{rascunho}
				{indice}
				total={perguntas.length}
				onRemover={() => removerPergunta(indice)}
			/>
		{/each}

		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={adicionarPergunta}>Adicionar pergunta</Button>
			<Button disabled={salvando} onclick={salvar}>
				{salvando ? 'Salvando…' : 'Salvar questionário'}
			</Button>
		</div>

		{#if erro}
			<p class="text-destructive text-sm" role="alert">{erro}</p>
		{/if}
		{#if sucesso}
			<p class="text-sm font-medium" role="status">{sucesso}</p>
		{/if}
	{/if}
</div>
