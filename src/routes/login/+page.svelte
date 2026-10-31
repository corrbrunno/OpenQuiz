<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { firebaseConfigurado } from '$lib/client/firebase';
	import {
		authState,
		criarConta,
		entrar,
		entrarComGoogle,
		redefinirSenha
	} from '$lib/client/stores/auth.svelte';

	let modo = $state<'entrar' | 'criar'>('entrar');
	let email = $state('');
	let senha = $state('');
	let ocupado = $state(false);
	let aviso = $state('');
	let erro = $state('');

	const destino = $derived(page.url.searchParams.get('redirect') ?? '/');

	async function enviar(evento: SubmitEvent) {
		evento.preventDefault();
		erro = '';
		aviso = '';

		if (!email.includes('@')) {
			erro = 'Informe um e-mail válido.';
			return;
		}
		if (senha.length < 6) {
			erro = 'A senha precisa de pelo menos 6 caracteres.';
			return;
		}

		ocupado = true;
		const ok = modo === 'entrar' ? await entrar(email, senha) : await criarConta(email, senha);
		ocupado = false;

		if (ok) await goto(destino);
	}

	async function comGoogle() {
		erro = '';
		aviso = '';

		ocupado = true;
		const ok = await entrarComGoogle();
		ocupado = false;

		if (ok && authState.user) await goto(destino);
	}

	async function esqueci() {
		erro = '';
		aviso = '';

		if (!email.includes('@')) {
			erro = 'Informe o e-mail para receber o link de redefinição.';
			return;
		}

		ocupado = true;
		const ok = await redefinirSenha(email);
		ocupado = false;

		if (ok) aviso = `Enviamos um link de redefinição para ${email}.`;
	}
</script>

<div class="mx-auto max-w-md">
	{#if !firebaseConfigurado()}
		<Card.Root>
			<Card.Header>
				<Card.Title>Firebase não configurado</Card.Title>
				<Card.Description>
					Preencha as variáveis PUBLIC_FIREBASE_* no arquivo .env do projeto (veja .env.example) e
					reinicie o servidor.
				</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else if authState.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Você já está conectado</Card.Title>
				<Card.Description>{authState.user.email}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button href="/criar">Criar questionário</Button>
				<Button variant="outline" href="/">Voltar ao início</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</Card.Title>
				<Card.Description>
					O login é obrigatório para entrar nas salas e criar questionários.
				</Card.Description>
			</Card.Header>

			<Card.Content class="flex flex-col gap-4">
				<Button variant="outline" disabled={ocupado} onclick={comGoogle}>
					<LogInIcon class="size-4" />
					Continuar com Google
				</Button>

				<div class="flex items-center gap-3">
					<span class="bg-border h-px flex-1"></span>
					<span class="text-muted-foreground text-xs">ou com e-mail</span>
					<span class="bg-border h-px flex-1"></span>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<Button
						variant={modo === 'entrar' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (modo = 'entrar')}
					>
						Entrar
					</Button>
					<Button
						variant={modo === 'criar' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (modo = 'criar')}
					>
						Criar conta
					</Button>
				</div>

				<form class="flex flex-col gap-3" onsubmit={enviar}>
					<label class="flex flex-col gap-1 text-sm font-medium">
						E-mail
						<Input
							type="email"
							autocomplete="email"
							placeholder="voce@exemplo.com"
							bind:value={email}
						/>
					</label>

					<label class="flex flex-col gap-1 text-sm font-medium">
						Senha
						<Input
							type="password"
							autocomplete={modo === 'entrar' ? 'current-password' : 'new-password'}
							placeholder="mínimo de 6 caracteres"
							bind:value={senha}
						/>
					</label>

					<Button type="submit" disabled={ocupado}>
						{ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
					</Button>
				</form>

				{#if modo === 'entrar'}
					<Button variant="ghost" size="sm" disabled={ocupado} onclick={esqueci}>
						Esqueci a senha
					</Button>
				{/if}

				{#if erro || authState.erro}
					<p class="text-destructive text-sm" role="alert">{erro || authState.erro}</p>
				{/if}
				{#if authState.aviso}
					<p class="text-muted-foreground text-sm" role="status">{authState.aviso}</p>
				{/if}
				{#if aviso}
					<p class="text-muted-foreground text-sm" role="status">{aviso}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
