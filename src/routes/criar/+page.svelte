<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import EditorPergunta from '$lib/components/quiz/EditorPergunta.svelte';
	import { mensagemDeErro } from '$lib/client/api';
	import { atualizarQuestionario, carregarQuestionario, criarQuestionario } from '$lib/client/quiz';
	import { authState } from '$lib/client/stores/auth.svelte';
	import {
		novaPergunta,
		rascunhoDePerguntaSalva,
		validarPergunta,
		type RascunhoPergunta
	} from '$lib/quiz/rascunhos';

	const editandoId = $derived(page.url.searchParams.get('editar') ?? '');

	let titulo = $state('');
	let perguntas = $state<RascunhoPergunta[]>([novaPergunta()]);
	let salvando = $state(false);
	let erro = $state('');
	let carregando = $state(false);

	$effect(() => {
		const usuario = authState.user;
		const id = editandoId;

		if (!browser || !usuario || !id) return;

		carregando = true;
		carregarQuestionario(id, usuario)
			.then((dados) => {
				titulo = dados.quiz.titulo;
				perguntas = dados.perguntas.map((pergunta) =>
					rascunhoDePerguntaSalva(
						{
							id: pergunta.id,
							ordem: pergunta.ordem,
							enunciado: pergunta.enunciado,
							imagemUrl: pergunta.imagemUrl,
							tipo: pergunta.tipo,
							conteudo: pergunta.conteudo
						},
						pergunta.gabarito
					)
				);
			})
			.catch((falha) => {
				erro = mensagemDeErro(falha);
			})
			.finally(() => {
				carregando = false;
			});
	});

	function adicionarPergunta() {
		perguntas.push(novaPergunta());
	}

	function removerPergunta(indice: number) {
		const [removida] = perguntas.splice(indice, 1);
		if (removida?.previa) URL.revokeObjectURL(removida.previa);
	}

	async function salvar() {
		erro = '';

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
			if (editandoId) await atualizarQuestionario(editandoId, titulo, perguntas, usuario);
			else await criarQuestionario(titulo, perguntas, usuario);

			await goto('/meus-quizzes');
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			salvando = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight">
			{editandoId ? 'Editar questionário' : 'Criar questionário'}
		</h1>
		<p class="text-muted-foreground text-sm">
			Escolha o tipo de cada pergunta: múltipla escolha, verdadeiro ou falso, categorizar, reordenar ou
			tabela de correspondência. Cada pergunta aceita uma imagem.
		</p>
	</header>

	{#if authState.carregando || carregando}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Carregando…</p>
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
				{salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Salvar questionário'}
			</Button>
			<Button variant="ghost" href="/meus-quizzes">Meus questionários</Button>
		</div>

		{#if erro}
			<p class="text-destructive text-sm" role="alert">{erro}</p>
		{/if}
	{/if}
</div>
