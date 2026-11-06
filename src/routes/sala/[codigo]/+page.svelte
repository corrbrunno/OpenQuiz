<script module lang="ts">
	function textoDoRitmo(conduzida: boolean, status: string): string {
		if (status === 'encerrada') return 'Sessão encerrada.';
		return conduzida
			? 'Ritmo: o apresentador controla a pergunta no ar.'
			: 'Ritmo: livre, no seu tempo.';
	}
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import ResponderPergunta from '$lib/components/quiz/ResponderPergunta.svelte';
	import TabelaRanking from '$lib/components/quiz/TabelaRanking.svelte';
	import ChatSala from '$lib/components/quiz/ChatSala.svelte';
	import { mensagemDeErro } from '$lib/client/api';
	import { assinarSala, entrarNaSala, estadoDaSala, responderPergunta, type EstadoDaSala } from '$lib/client/sessao';
	import { tocarSom } from '$lib/client/sons.svelte';
	import { authState } from '$lib/client/stores/auth.svelte';
	import { acompanharPresenca } from '$lib/client/presenca';
	import type { RespostaComum } from '$lib/quiz/tipos';

	const codigo = $derived((page.params.codigo ?? '').toUpperCase());

	// avisa o servidor quando o app sai da frente: é isso que dispara a notificação
	$effect(() => {
		const usuario = authState.user;
		if (!usuario) return;
		return acompanharPresenca(codigo, usuario);
	});

	let carregando = $state(true);
	let erro = $state('');
	let erroResposta = $state('');
	let estado = $state<EstadoDaSala | null>(null);
	let indice = $state(0);
	let pendentes = $state<Record<string, RespostaComum>>({});
	let resultados = $state<Record<string, { acertos: number; total: number }>>({});
	let enviando = $state(false);

	const perguntas = $derived(estado?.perguntas ?? []);
	const pergunta = $derived(perguntas[Math.min(indice, Math.max(perguntas.length - 1, 0))] ?? null);
	const totalPerguntas = $derived(estado?.quiz.totalPerguntas ?? 0);
	const gravada = $derived(
		pergunta
			? ((estado?.minhasRespostas ?? []).find((item) => item.perguntaId === pergunta.id) ?? null)
			: null
	);
	const resultado = $derived(
		pergunta
			? (resultados[pergunta.id] ??
				(gravada ? { acertos: gravada.acertos, total: gravada.total } : null))
			: null
	);
	const respondida = $derived(Boolean(pergunta && resultado));
	const pendente = $derived(pergunta ? (pendentes[pergunta.id] ?? null) : null);
	const ultima = $derived(indice >= perguntas.length - 1);
	const conduzida = $derived(estado?.sessao.modo === 'conduzida');
	const encerrada = $derived(estado?.sessao.status === 'encerrada');

	async function carregar() {
		const usuario = authState.user;
		if (!usuario || !codigo) {
			carregando = false;
			return;
		}

		try {
			let atual = await estadoDaSala(codigo, usuario);

			// Entra sozinho na sala (idempotente) para o jogador não ter um passo extra.
			if (!atual.souDono && !atual.participei && atual.sessao.status === 'aberta') {
				await entrarNaSala(codigo, usuario);
				atual = await estadoDaSala(codigo, usuario);
			}

			estado = atual;
			indice = 0;
			erro = '';
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			carregando = false;
		}
	}

	/**
	 * Assinatura de eventos (SSE): o servidor empurra o estado da sala; o cliente reconecta
	 * sozinho quando a conexão cai. Substitui o polling de 4 s.
	 */
	$effect(() => {
		const usuario = authState.user;
		const alvo = codigo;

		if (!usuario || !alvo) return;

		return assinarSala(alvo, usuario, (dados) => {
			const proximo = dados as EstadoDaSala;
			if (!proximo?.sessao) return;

			const perguntaAnterior = estado?.perguntas[0]?.id ?? '';
			const perguntaNova = proximo.perguntas[0]?.id ?? '';

			if (perguntaNova && perguntaNova !== perguntaAnterior) tocarSom('nova-pergunta');
			if (proximo.sessao.status === 'encerrada' && estado?.sessao.status !== 'encerrada') {
				tocarSom('fim');
			}

			estado = proximo;
		});
	});

	$effect(() => {
		const usuario = authState.user;
		const alvo = codigo;

		if (!usuario || !alvo) {
			carregando = false;
			return;
		}

		void carregar();
	});


	function guardarPendente(resposta: RespostaComum) {
		pendentes = { ...pendentes, [resposta.perguntaId]: resposta };
	}

	async function enviar() {
		const usuario = authState.user;
		const alvo = pergunta;
		if (!usuario || !alvo || !pendente) return;

		enviando = true;
		erroResposta = '';
		try {
			const salva = await responderPergunta(codigo, alvo.id, pendente.atribuicoes, usuario);
			resultados = {
				...resultados,
				[alvo.id]: { acertos: salva.acertos, total: salva.total }
			};
		} catch (falha) {
			erroResposta = mensagemDeErro(falha);
		} finally {
			enviando = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-bold tracking-tight">
			{estado?.quiz.titulo ?? `Sala ${codigo}`}
		</h1>
		<p class="text-muted-foreground text-sm">
			{#if estado}
				{#if pergunta && !encerrada}
					Pergunta {pergunta.ordem} de {totalPerguntas} ·
				{/if}
				{textoDoRitmo(conduzida, estado.sessao.status)}
			{:else}
				Sala {codigo}
			{/if}
		</p>
	</header>

	{#if authState.carregando || carregando}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Carregando a sala…</p>
			</Card.Content>
		</Card.Root>
	{:else if !authState.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Login obrigatório</Card.Title>
				<Card.Description>Você precisa de uma conta para entrar nesta sala.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button href={`/login?redirect=/sala/${codigo}`}>Entrar ou criar conta</Button>
				<Button variant="outline" href="/">Voltar ao início</Button>
			</Card.Content>
		</Card.Root>
	{:else if erro && !estado}
		<Card.Root>
			<Card.Header>
				<Card.Title>Não foi possível abrir a sala</Card.Title>
				<Card.Description>{erro}</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/entrar">Tentar outro código</Button>
			</Card.Content>
		</Card.Root>
	{:else if estado?.souDono}
		<Card.Root>
			<Card.Header>
				<Card.Title>Você é quem conduz esta sessão</Card.Title>
				<Card.Description>
					O painel do apresentador tem o código para compartilhar e o controle das perguntas.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href={`/apresentar/${codigo}`}>Abrir painel do apresentador</Button>
			</Card.Content>
		</Card.Root>
	{:else if estado && encerrada}
		<Card.Root>
			<Card.Header>
				<Card.Title>Fim da sessão</Card.Title>
				<Card.Description>Quem acertou mais questões:</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<TabelaRanking
					ranking={estado.ranking ?? []}
					destaqueId={estado.participanteId}
					titulo="Resumo final"
				/>
				{#if resultado}
					<p class="text-sm">
						Seu placar: <strong>{resultado.acertos} de {resultado.total}</strong>
						na última pergunta respondida.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if estado}
		{#if estado.participanteId === null}
			<Card.Root>
				<Card.Content class="pt-6">
					<p class="text-muted-foreground text-sm">Entrando na sala…</p>
				</Card.Content>
			</Card.Root>
		{/if}

		{#if pergunta}
			{#key pergunta.id}
				<ResponderPergunta
					{pergunta}
					responder={guardarPendente}
					atribuicoesIniciais={gravada?.atribuicoes ?? null}
					{resultado}
					desabilitado={respondida || enviando}
				/>
			{/key}

			<div class="flex flex-wrap items-center gap-3">
				{#if !respondida}
					<Button disabled={!pendente || enviando} onclick={enviar}>
						{enviando ? 'Enviando…' : 'Enviar resposta'}
					</Button>
					<span class="text-muted-foreground text-sm">
						{pendente ? 'Confira e envie: só vale uma resposta por pergunta.' : 'Escolha sua resposta.'}
					</span>
				{:else if conduzida}
					<span class="text-muted-foreground text-sm">
						Resposta enviada. Aguardando o apresentador liberar a próxima pergunta…
					</span>
				{:else if !ultima}
					<Button onclick={() => (indice += 1)}>Próxima pergunta</Button>
					<span class="text-muted-foreground text-sm">{resultado ? `${resultado.acertos} de ${resultado.total} corretos.` : ''}</span>
				{:else}
					<span class="text-muted-foreground text-sm">
						Você respondeu todas. Aguardando o apresentador encerrar para ver o resultado final.
					</span>
				{/if}
			</div>

			{#if erroResposta}
				<p class="text-destructive text-sm" role="alert">{erroResposta}</p>
			{/if}
		{:else}
			<Card.Root>
				<Card.Content class="pt-6">
					<p class="text-muted-foreground text-sm">
						{textoDoRitmo(conduzida, estado.sessao.status)} Nada para responder agora.
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}

	{#if estado && authState.user}
		<ChatSala
			{codigo}
			usuario={authState.user}
			souDono={estado.souDono ?? false}
			meuUid={authState.user.uid}
		/>
	{/if}
</div>
