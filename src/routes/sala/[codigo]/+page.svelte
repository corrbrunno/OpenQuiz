<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { buscarPorCodigo, mensagemDeErro, type SalaCarregada } from '$lib/client/quiz';
	import { authState } from '$lib/client/stores/auth.svelte';

	const codigo = $derived(page.params.codigo ?? '');

	let carregando = $state(true);
	let erro = $state('');
	let sala = $state<SalaCarregada | null>(null);

	$effect(() => {
		const autenticado = Boolean(authState.user);
		const alvo = codigo;

		if (!autenticado) {
			carregando = false;
			return;
		}

		carregando = true;
		erro = '';

		buscarPorCodigo(alvo)
			.then((resultado) => {
				sala = resultado;
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
				<Card.Description>
					Você precisa de uma conta para entrar nesta sala.
				</Card.Description>
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
					Jogando como {authState.user.email}
				</Card.Description>
			</Card.Header>
		</Card.Root>

		{#each sala.perguntas as pergunta (pergunta.id)}
			<Card.Root>
				<Card.Header>
					<Card.Title>Pergunta {pergunta.ordem}</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					{#if pergunta.imagemUrl}
						<img
							src={pergunta.imagemUrl}
							alt={`Imagem da pergunta ${pergunta.ordem}`}
							class="max-h-64 w-fit rounded-md border object-contain"
						/>
					{/if}
					<p>{pergunta.enunciado}</p>
					<ul class="text-muted-foreground flex flex-col gap-1 text-sm">
						{#each pergunta.alternativas as alternativa, indice}
							<li>{['A', 'B', 'C', 'D', 'E', 'F'][indice]}) {alternativa}</li>
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>
		{/each}

		<p class="text-muted-foreground text-sm">
			Pré-visualização do questionário carregada do Firebase. A rodada ao vivo (pergunta na tela,
			respostas e placar) entra na próxima etapa.
		</p>
	{/if}
</div>
