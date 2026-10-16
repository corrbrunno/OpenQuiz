<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { authState } from '$lib/client/stores/auth.svelte';

	let codigo = $state('');

	function entrarNaSala() {
		const limpo = codigo.trim().toUpperCase();
		if (limpo) void goto(`/sala/${limpo}`);
	}
</script>

<section class="flex flex-col gap-8">
	<header class="flex flex-col gap-3">
		<Badge variant="secondary" class="w-fit">SvelteKit 5 · Firebase · Drizzle · shadcn-svelte</Badge>
		<h1 class="text-4xl font-bold tracking-tight">Online Quiz</h1>
		<p class="text-muted-foreground max-w-2xl">
			Crie questionários com perguntas objetivas e imagens, e entre na sala pelo código compartilhado.
		</p>
	</header>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Entrar em uma sala</Card.Title>
				<Card.Description>O login é obrigatório para participar.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Input placeholder="Código da sala" bind:value={codigo} maxlength={6} class="uppercase" />
				<Button disabled={codigo.trim().length === 0} onclick={entrarNaSala}>Entrar</Button>
				{#if !authState.user && !authState.carregando}
					<p class="text-muted-foreground text-xs">
						Sem conta ainda? O acesso à sala vai pedir para você entrar.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Criar questionário</Card.Title>
				<Card.Description>Perguntas objetivas com imagem opcional.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button variant="outline" href="/criar" disabled={!authState.user}>
					{authState.user ? 'Abrir o criador' : 'Entre para criar'}
				</Button>
				<p class="text-muted-foreground text-xs">
					Ao salvar, o sistema gera um código de 6 caracteres para os participantes.
				</p>
			</Card.Content>
		</Card.Root>
	</div>
</section>
