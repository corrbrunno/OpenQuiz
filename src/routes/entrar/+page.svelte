<script lang="ts">
	import { goto } from '$app/navigation';
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

<div class="mx-auto max-w-md">
	<Card.Root>
		<Card.Header>
			<Card.Title>Entrar em uma sala</Card.Title>
			<Card.Description>
				Use o código que quem criou o quiz mostrou ao iniciar a sessão.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			{#if authState.carregando}
				<p class="text-muted-foreground text-sm">Verificando sua sessão…</p>
			{:else if !authState.user}
				<div class="flex flex-col gap-3">
					<p class="text-sm">
						O acesso às salas exige login. Entre com sua conta para continuar.
					</p>
					<Button href="/login?redirect=/entrar">Entrar ou criar conta</Button>
				</div>
			{:else}
				<Input placeholder="Código da sala" bind:value={codigo} maxlength={6} class="uppercase" />
				<Button disabled={codigo.trim().length === 0} onclick={entrarNaSala}>Entrar na sala</Button>
				<p class="text-muted-foreground text-xs">Conectado como {authState.user.email}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
