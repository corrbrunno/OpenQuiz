<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import PreviaPergunta from '$lib/components/quiz/PreviaPergunta.svelte';
	import TabelaRanking from '$lib/components/quiz/TabelaRanking.svelte';
	import { mensagemDeErro } from '$lib/client/api';
	import { assinarSala, controlarSessao, painelDoApresentador, type PainelDoApresentador } from '$lib/client/sessao';
	import { tocarSom } from '$lib/client/sons.svelte';
	import { authState } from '$lib/client/stores/auth.svelte';

	const codigo = $derived((page.params.codigo ?? '').toUpperCase());

	let carregando = $state(true);
	let erro = $state('');
	let painel = $state<PainelDoApresentador | null>(null);
	let acaoEmCurso = $state('');
	let copiado = $state(false);

	const aberta = $derived(painel?.sessao.status === 'aberta');
	const totalPerguntas = $derived(painel?.quiz.totalPerguntas ?? 0);
	const perguntaAtual = $derived(painel?.perguntaAtual ?? null);

	async function atualizar() {
		const usuario = authState.user;
		if (!usuario || !codigo) return;

		try {
			painel = await painelDoApresentador(codigo, usuario);
			erro = '';
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			carregando = false;
		}
	}

	$effect(() => {
		const usuario = authState.user;
		const alvo = codigo;

		if (!usuario || !alvo) {
			carregando = false;
			return;
		}

		void atualizar();
	});

	// Assinatura de eventos (SSE): cada resposta de participante chega sem recarregar a página.
	$effect(() => {
		const usuario = authState.user;
		const alvo = codigo;

		if (!usuario || !alvo) return;

		return assinarSala(alvo, usuario, (dados) => {
			const proximo = dados as PainelDoApresentador;
			if (!proximo?.sessao) return;

			const antes = painel?.responderamAtual ?? 0;
			if (proximo.responderamAtual > antes) tocarSom('resposta');
			if (proximo.sessao.status === 'encerrada' && painel?.sessao.status !== 'encerrada') {
				tocarSom('fim');
			}

			painel = proximo;
		});
	});

	async function acao(nome: 'avancar' | 'voltar' | 'encerrar') {
		const usuario = authState.user;
		if (!usuario) return;

		acaoEmCurso = nome;
		try {
			await controlarSessao(codigo, nome, usuario);
			await atualizar();
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			acaoEmCurso = '';
		}
	}

	async function copiarLink() {
		const link = `${window.location.origin}/sala/${codigo}`;
		try {
			await navigator.clipboard.writeText(link);
			copiado = true;
			setTimeout(() => (copiado = false), 2000);
		} catch {
			copiado = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-bold tracking-tight">Apresentação</h1>
		<p class="text-muted-foreground text-sm">
			{painel?.quiz.titulo ?? 'Carregando…'}
		</p>
	</header>

	{#if authState.carregando || carregando}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Carregando o painel…</p>
			</Card.Content>
		</Card.Root>
	{:else if !authState.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Faça login para conduzir a sessão</Card.Title>
			</Card.Header>
			<Card.Content>
				<Button href={`/login?redirect=/apresentar/${codigo}`}>Entrar ou criar conta</Button>
			</Card.Content>
		</Card.Root>
	{:else if erro && !painel}
		<Card.Root>
			<Card.Header>
				<Card.Title>Não foi possível abrir o painel</Card.Title>
				<Card.Description>{erro}</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/meus-quizzes">Meus questionários</Button>
			</Card.Content>
		</Card.Root>
	{:else if painel}
		<Card.Root>
			<Card.Header>
				<Card.Title>Código da sala</Card.Title>
				<Card.Description>
					Mostre este código para a turma entrar em
					<code>/sala/{codigo}</code> — ele só existe enquanto a sessão estiver aberta.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap items-center gap-4">
				<p class="text-5xl font-black tracking-[0.3em]">{codigo}</p>
				<Button variant="outline" size="sm" onclick={copiarLink}>
					{copiado ? 'Link copiado' : 'Copiar link da sala'}
				</Button>
				<span class="text-muted-foreground text-sm">
					{painel.sessao.modo === 'conduzida'
						? 'Ritmo: você conduz a pergunta no ar'
						: 'Ritmo: cada um responde no seu tempo'}
					· {painel.sessao.status === 'aberta' ? 'aberta' : 'encerrada'}
				</span>
			</Card.Content>
		</Card.Root>

		{#if painel.sessao.status === 'encerrada'}
			<Card.Root>
				<Card.Header>
					<Card.Title>Sessão encerrada</Card.Title>
					<Card.Description>Resumo final: quem acertou mais questões.</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					<TabelaRanking ranking={painel.ranking} titulo="Resultado final" />
					<div class="flex flex-wrap gap-2">
						<Button href={`/apresentar/${codigo}`} variant="outline" onclick={atualizar}>
							Atualizar
						</Button>
						<Button href="/meus-quizzes">Meus questionários</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Header>
					<Card.Title>
						Pergunta {painel.sessao.perguntaAtual} de {totalPerguntas}
					</Card.Title>
					<Card.Description>
						{painel.responderamAtual} de {painel.participantes.length}
						{painel.participantes.length === 1 ? 'participante respondeu' : 'participantes responderam'}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					{#if perguntaAtual}
						{#if perguntaAtual.imagemUrl}
							<img
								src={perguntaAtual.imagemUrl}
								alt="Imagem da pergunta"
								class="max-h-64 w-fit rounded-md border object-contain"
							/>
						{/if}
						<p class="text-lg font-medium">{perguntaAtual.enunciado}</p>
						<PreviaPergunta conteudo={perguntaAtual.conteudo} gabarito={painel.gabaritoAtual} />
					{:else}
						<p class="text-muted-foreground text-sm">Nenhuma pergunta nesta posição.</p>
					{/if}

					<div class="flex flex-wrap gap-2 border-t pt-4">
						<Button
							variant="outline"
							disabled={acaoEmCurso !== '' || painel.sessao.perguntaAtual <= 1}
							onclick={() => acao('voltar')}
						>
							Pergunta anterior
						</Button>
						<Button
							disabled={acaoEmCurso !== '' || painel.sessao.perguntaAtual >= totalPerguntas}
							onclick={() => acao('avancar')}
						>
							Próxima pergunta
						</Button>
						<Button variant="ghost" disabled={acaoEmCurso !== ''} onclick={() => acao('encerrar')}>
							Encerrar sessão
						</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Participantes</Card.Title>
					<Card.Description>
						A bolinha mostra quem já respondeu a pergunta que está no ar.
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					<TabelaRanking ranking={painel.ranking} titulo="Placar parcial" />

					{#if painel.participantes.length > 0}
						<ul class="flex flex-wrap gap-2 text-sm">
							{#each painel.participantes as participante (participante.participanteId)}
								<li class="bg-muted flex items-center gap-2 rounded-md px-2 py-1">
									<span
										class="size-2 rounded-full"
										class:bg-emerald-500={participante.respondeuAtual}
										class:bg-muted-foreground={!participante.respondeuAtual}
									></span>
									{participante.nome}
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}

		{#if erro}
			<p class="text-destructive text-sm" role="alert">{erro}</p>
		{/if}
	{/if}
</div>
