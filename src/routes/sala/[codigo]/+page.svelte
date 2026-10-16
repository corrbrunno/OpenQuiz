<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import ResponderPergunta from '$lib/components/quiz/ResponderPergunta.svelte';
	import {
		buscarPorCodigo,
		carregarGabaritos,
		mensagemDeErro,
		type SalaCarregada
	} from '$lib/client/quiz';
	import { authState } from '$lib/client/stores/auth.svelte';
	import type { RespostaComum } from '$lib/quiz/tipos';

	const codigo = $derived(page.params.codigo ?? '');

	let carregando = $state(true);
	let erro = $state('');
	let sala = $state<SalaCarregada | null>(null);
	let gabaritos = $state<Map<string, RespostaComum> | null>(null);

	$effect(() => {
		const usuario = authState.user;
		const alvo = codigo;

		if (!usuario) {
			carregando = false;
			return;
		}

		carregando = true;
		erro = '';

		buscarPorCodigo(alvo, usuario)
			.then(async (resultado) => {
				sala = resultado;
				if (!resultado) return;

				gabaritos = await carregarGabaritos(alvo, usuario);
			})
			.catch((falha) => {
				erro = mensagemDeErro(falha);
			})
			.finally(() => {
				carregando = false;
			});
	});
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-bold tracking-tight">Sala {codigo.toUpperCase()}</h1>
		<p class="text-muted-foreground text-sm">Entrar na sala exige login.</p>
	</header>

	{#if authState.carregando || (authState.user && carregando)}
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
	{:else if erro}
		<Card.Root>
			<Card.Header>
				<Card.Title>Não foi possível abrir a sala</Card.Title>
				<Card.Description>{erro}</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/entrar">Tentar outro código</Button>
			</Card.Content>
		</Card.Root>
	{:else if !sala}
		<Card.Root>
			<Card.Header>
				<Card.Title>Sala não encontrada</Card.Title>
				<Card.Description>Confira o código com quem criou o questionário.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/entrar">Tentar outro código</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{sala.titulo}</Card.Title>
				<Card.Description>
					{sala.totalPerguntas} pergunta{sala.totalPerguntas === 1 ? '' : 's'} ·
					Respondendo como {authState.user.email}
				</Card.Description>
			</Card.Header>
		</Card.Root>

		{#each sala.perguntas as pergunta (pergunta.id)}
			<ResponderPergunta {pergunta} gabarito={gabaritos?.get(pergunta.id) ?? null} />
		{/each}

		{#if !gabaritos}
			<p class="text-muted-foreground text-sm">
				Você está respondendo como participante: o gabarito fica no servidor e só é liberado para o dono
				do questionário, então a correção aparece apenas na conta que criou o quiz.
			</p>
		{/if}
	{/if}
</div>
