<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { mensagemDeErro } from '$lib/client/api';
	import {
		excluirQuestionario,
		listarMeusQuestionarios,
		type QuestionarioResumo
	} from '$lib/client/quiz';
	import { iniciarSessao, type ModoSessao } from '$lib/client/sessao';
	import { authState } from '$lib/client/stores/auth.svelte';

	type Ritmo = ModoSessao;

	let carregando = $state(true);
	let erro = $state('');
	let quizzes = $state<QuestionarioResumo[]>([]);
	let trabalhando = $state('');
	let ritmos = $state<Record<string, Ritmo>>({});

	function ritmoDe(id: string): Ritmo {
		return ritmos[id] ?? 'conduzida';
	}

	$effect(() => {
		const usuario = authState.user;
		if (!usuario) return;

		listarMeusQuestionarios(usuario)
			.then((lista) => {
				quizzes = lista;
				erro = '';
			})
			.catch((falha) => {
				erro = mensagemDeErro(falha);
			})
			.finally(() => {
				carregando = false;
			});
	});

	async function iniciar(quiz: QuestionarioResumo) {
		const usuario = authState.user;
		if (!usuario) return;

		trabalhando = quiz.id;
		erro = '';
		try {
			const sessao = await iniciarSessao(quiz.id, ritmoDe(quiz.id), usuario);
			await goto(`/apresentar/${sessao.codigo}`);
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			trabalhando = '';
		}
	}

	async function excluir(quiz: QuestionarioResumo) {
		const usuario = authState.user;
		if (!usuario) return;

		const confirmado = confirm(
			`Excluir "${quiz.titulo}"? As perguntas e as sessões já feitas deste questionário também saem.`
		);
		if (!confirmado) return;

		trabalhando = quiz.id;
		erro = '';
		try {
			await excluirQuestionario(quiz.id, usuario);
			quizzes = quizzes.filter((item) => item.id !== quiz.id);
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			trabalhando = '';
		}
	}

	function formatarData(valor: string): string {
		const data = new Date(valor);
		return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">Meus questionários</h1>
			<p class="text-muted-foreground text-sm">
				Inicie uma sessão para gerar o código da sala — o código só existe enquanto a rodada está aberta.
			</p>
		</div>
		<Button href="/criar">Criar questionário</Button>
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
				<Card.Title>Faça login para ver seus questionários</Card.Title>
				<Card.Description>Eles ficam vinculados à sua conta.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button href="/login?redirect=/meus-quizzes">Entrar ou criar conta</Button>
			</Card.Content>
		</Card.Root>
	{:else if quizzes.length === 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Você ainda não criou nenhum questionário</Card.Title>
				<Card.Description>
					Crie o primeiro e depois inicie uma sessão para liberar o código da sala.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/criar">Criar questionário</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		{#each quizzes as quiz (quiz.id)}
			<Card.Root>
				<Card.Header>
					<Card.Title>{quiz.titulo}</Card.Title>
					<Card.Description>
						{quiz.totalPerguntas} pergunta{quiz.totalPerguntas === 1 ? '' : 's'} · atualizado em
						{formatarData(quiz.atualizadoEm)}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					<div class="flex flex-wrap items-center gap-2">
						<Button
							disabled={trabalhando === quiz.id}
							onclick={() => iniciar(quiz)}
						>
							{trabalhando === quiz.id ? 'Iniciando…' : 'Iniciar sessão'}
						</Button>

						<select
							class="border-input bg-background h-9 rounded-md border px-2 text-sm"
							value={ritmoDe(quiz.id)}
							onchange={(evento) =>
								(ritmos = {
									...ritmos,
									[quiz.id]: (evento.currentTarget as HTMLSelectElement).value as Ritmo
								})}
							aria-label="Ritmo da sessão"
						>
							<option value="conduzida">Eu conduzo (você controla a pergunta no ar)</option>
							<option value="livre">Cada um no seu ritmo</option>
						</select>

						<Button variant="outline" href={`/criar?editar=${quiz.id}`}>Editar</Button>
						<Button
							variant="ghost"
							disabled={trabalhando === quiz.id}
							onclick={() => excluir(quiz)}
						>
							Excluir
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	{/if}

	{#if erro}
		<p class="text-destructive text-sm" role="alert">{erro}</p>
	{/if}
</div>
