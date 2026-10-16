<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';

	let code = $state('');
</script>

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 p-6">
	<header class="flex flex-col gap-3">
		<Badge variant="secondary" class="w-fit">SvelteKit 5 · Drizzle · shadcn-svelte · Tailwind 4</Badge>
		<h1 class="text-4xl font-bold tracking-tight">Online Quiz</h1>
		<p class="text-muted-foreground">
			Base do projeto configurada: rotas, tema, componentes e banco prontos para o quiz.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Entrar em uma sala</Card.Title>
			<Card.Description>Use o código informado por quem criou o quiz.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col gap-3 sm:flex-row">
				<Input placeholder="Código da sala" bind:value={code} />
				<Button disabled={code.trim().length === 0}>Entrar</Button>
			</div>
		</Card.Content>
		<Card.Footer>
			<Button variant="outline" class="w-full sm:w-auto">Criar quiz</Button>
		</Card.Footer>
	</Card.Root>
</main>
