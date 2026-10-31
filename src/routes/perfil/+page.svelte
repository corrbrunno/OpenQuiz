<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { mensagemDeErro } from '$lib/client/api';
	import { alternarSom, som } from '$lib/client/sons.svelte';
	import {
		confirmarBiometria,
		definirPreferenciaNativa,
		ehNativo,
		mensagemDaConfirmacao,
		preferenciaNativaAtiva,
		situacaoBiometria
	} from '$lib/client/nativo';
	import { authState, sair } from '$lib/client/stores/auth.svelte';
	import {
		encerrarSessao,
		LIMITE_INATIVIDADE_MS,
		sessaoUsuario
	} from '$lib/client/stores/sessao-usuario.svelte';

	let restante = $state(0);
	let erro = $state('');
	let nativo = $state({
		plataforma: false,
		biometria: false,
		aparelhoProtegido: false,
		podeConfirmar: false,
		tipo: '',
		motivo: '',
		ativa: false
	});
	let avisoNativo = $state('');
	let ocupadoNativo = $state(false);

	$effect(() => {
		const usuario = authState.user;
		if (!usuario) return;

		nativo.plataforma = ehNativo();
		nativo.ativa = preferenciaNativaAtiva(usuario.uid);
		void situacaoBiometria().then((situacao) => {
			nativo.biometria = situacao.biometria;
			nativo.aparelhoProtegido = situacao.aparelhoProtegido;
			nativo.podeConfirmar = situacao.podeConfirmar;
			nativo.tipo = situacao.tipo;
			nativo.motivo = situacao.motivo;
		});
	});

	async function alternarNativo() {
		const usuario = authState.user;
		if (!usuario) return;

		ocupadoNativo = true;
		avisoNativo = '';
		try {
			if (nativo.ativa) {
				definirPreferenciaNativa(usuario.uid, false);
				nativo.ativa = false;
				avisoNativo = 'Entrada nativa desativada: a próxima entrada usa só a senha.';
			} else {
				if (!nativo.podeConfirmar) {
					avisoNativo =
						'Recurso indisponível: cadastre biometria ou PIN/padrão nas configurações do aparelho.';
					return;
				}

				const confirmacao = await confirmarBiometria('Ativar entrada nativa');
				if (!confirmacao.ok) {
					avisoNativo = mensagemDaConfirmacao(confirmacao);
					return;
				}

				definirPreferenciaNativa(usuario.uid, true);
				nativo.ativa = true;
				avisoNativo = 'Entrada nativa ativada para esta conta neste aparelho.';
			}
		} finally {
			ocupadoNativo = false;
		}
	}

	$effect(() => {
		const calcular = () => {
			restante = Math.max(0, Math.round((sessaoUsuario.expiraEm - Date.now()) / 1000));
		};

		calcular();
		const timer = setInterval(calcular, 1000);
		return () => clearInterval(timer);
	});

	async function sairDaConta() {
		erro = '';
		try {
			await encerrarSessao(authState.user);
			await sair();
		} catch (falha) {
			erro = mensagemDeErro(falha);
		}
	}

	const provedores = $derived(
		(authState.user?.providerData ?? [])
			.map((provedor) => provedor.providerId.replace('.com', ''))
			.join(', ') || '—'
	);
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-bold tracking-tight">Perfil</h1>
		<p class="text-muted-foreground text-sm">
			Conta conectada, identificação da sessão e saída. A sessão expira sozinha depois de
			{LIMITE_INATIVIDADE_MS / 1000} segundos sem atividade.
		</p>
	</header>

	{#if authState.carregando}
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-muted-foreground text-sm">Verificando sua sessão…</p>
			</Card.Content>
		</Card.Root>
	{:else if !authState.user}
		<Card.Root>
			<Card.Header>
				<Card.Title>Você não está conectado</Card.Title>
				<Card.Description>A área privada só aparece com uma sessão válida.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/login?redirect=/perfil">Entrar</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Conta</Card.Title>
				<Card.Description>{authState.user.email}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-2 text-sm">
				<p><span class="text-muted-foreground">Identificador (uid):</span> <code>{authState.user.uid}</code></p>
				<p><span class="text-muted-foreground">Provedor de login:</span> {provedores}</p>
				<p>
					<span class="text-muted-foreground">Verificado:</span>
					{authState.user.emailVerified ? 'sim' : 'não'}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Sessão do aplicativo</Card.Title>
				<Card.Description>
					Este é o identificador que o servidor usa para validar as operações (cabeçalho
					<code>X-Sessao</code>).
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-2 text-sm">
				<p>
					<span class="text-muted-foreground">ID da sessão:</span>
					<code>{sessaoUsuario.id || '—'}</code>
				</p>
				<p>
					<span class="text-muted-foreground">Expira em:</span>
					<strong>{restante}s</strong>
					<span class="text-muted-foreground">(renovado a cada interação)</span>
				</p>
				<p class="text-muted-foreground text-xs">
					Sem atividade por {LIMITE_INATIVIDADE_MS / 1000}s a sessão é encerrada e a área privada
					desmonta: as telas voltam a pedir login.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Entrada nativa</Card.Title>
				<Card.Description>
					Confirmação pelo sistema (biometria ou PIN do aparelho) depois do login remoto.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3 text-sm">
				{#if !nativo.plataforma}
					<p class="text-muted-foreground">
						Disponível apenas no aplicativo Android (build Capacitor). No navegador não existe
						diálogo de biometria do sistema.
					</p>
				{:else}
					<p>
						<span class="text-muted-foreground">Biometria cadastrada:</span>
						{nativo.biometria ? 'sim' : 'não'} ·
						<span class="text-muted-foreground">PIN/padrão do aparelho:</span>
						{nativo.aparelhoProtegido ? 'sim' : 'não'}
						{#if nativo.tipo}· <span class="text-muted-foreground">Tipo:</span> {nativo.tipo}{/if}
					</p>
					{#if !nativo.podeConfirmar && nativo.motivo}
						<p class="text-muted-foreground">{nativo.motivo}</p>
					{/if}
					<p>
						<span class="text-muted-foreground">Situação nesta conta/aparelho:</span>
						<strong>{nativo.ativa ? 'ativada' : 'desativada'}</strong>
					</p>
					<div>
						<Button variant={nativo.ativa ? 'outline' : 'default'} disabled={ocupadoNativo} onclick={alternarNativo}>
							{ocupadoNativo ? 'Aguarde…' : nativo.ativa ? 'Desativar entrada nativa' : 'Ativar entrada nativa'}
						</Button>
					</div>
					{#if avisoNativo}
						<p class="text-muted-foreground" role="status">{avisoNativo}</p>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Preferências</Card.Title>
				<Card.Description>
					Fonte, tema e Libras ficam na barra superior; o som dos eventos fica aqui.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="accent-primary size-4"
						checked={!som.mudo}
						onchange={alternarSom}
					/>
					Sons de evento (nova pergunta, resposta, fim da sessão)
				</label>
				<p class="text-muted-foreground text-xs">
					A preferência fica salva no navegador e vale para as próximas visitas.
				</p>
			</Card.Content>
		</Card.Root>

		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={sairDaConta}>Encerrar sessão e sair</Button>
			<Button variant="ghost" href="/meus-quizzes">Meus questionários</Button>
		</div>

		{#if erro}
			<p class="text-destructive text-sm" role="alert">{erro}</p>
		{/if}
	{/if}
</div>
