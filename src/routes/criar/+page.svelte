<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { mensagemDeErro, salvarQuestionario, type PerguntaNova } from '$lib/client/quiz';
	import { authState } from '$lib/client/stores/auth.svelte';

	type PerguntaForm = {
		chave: string;
		enunciado: string;
		alternativas: string[];
		correta: number;
		imagem: File | null;
		previa: string | null;
	};

	const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

	function novaPergunta(): PerguntaForm {
		return {
			chave: crypto.randomUUID(),
			enunciado: '',
			alternativas: ['', '', '', ''],
			correta: 0,
			imagem: null,
			previa: null
		};
	}

	let titulo = $state('');
	let perguntas = $state<PerguntaForm[]>([novaPergunta()]);
	let salvando = $state(false);
	let erro = $state('');
	let sucesso = $state('');

	function adicionarPergunta() {
		perguntas.push(novaPergunta());
	}

	function removerPergunta(indice: number) {
		const [removida] = perguntas.splice(indice, 1);
		if (removida?.previa) URL.revokeObjectURL(removida.previa);
	}

	function adicionarAlternativa(indice: number) {
		const pergunta = perguntas[indice];
		if (pergunta.alternativas.length < LETRAS.length) pergunta.alternativas.push('');
	}

	function removerAlternativa(indice: number) {
		const pergunta = perguntas[indice];
		if (pergunta.alternativas.length <= 2) return;

		pergunta.alternativas.splice(pergunta.alternativas.length - 1, 1);
		if (pergunta.correta >= pergunta.alternativas.length) pergunta.correta = 0;
	}

	function escolherImagem(indice: number, evento: Event) {
		const alvo = evento.currentTarget as HTMLInputElement;
		const arquivo = alvo.files?.[0] ?? null;
		const pergunta = perguntas[indice];

		if (pergunta.previa) URL.revokeObjectURL(pergunta.previa);
		pergunta.imagem = arquivo;
		pergunta.previa = arquivo ? URL.createObjectURL(arquivo) : null;
	}

	function validar(): string | null {
		if (!titulo.trim()) return 'Dê um título ao questionário.';
		if (perguntas.length === 0) return 'Adicione pelo menos uma pergunta.';

		for (const [indice, pergunta] of perguntas.entries()) {
			const numero = indice + 1;
			if (!pergunta.enunciado.trim()) return `Pergunta ${numero}: escreva o enunciado.`;
			if (pergunta.alternativas.some((alternativa) => !alternativa.trim())) {
				return `Pergunta ${numero}: todas as alternativas precisam de texto.`;
			}
			if (!pergunta.alternativas[pergunta.correta]?.trim()) {
				return `Pergunta ${numero}: marque uma alternativa correta válida.`;
			}
		}

		return null;
	}

	async function salvar() {
		erro = '';
		sucesso = '';

		const problema = validar();
		if (problema) {
			erro = problema;
			return;
		}

		const usuario = authState.user;
		if (!usuario) {
			erro = 'Sua sessão expirou. Entre novamente para salvar.';
			return;
		}

		salvando = true;
		try {
			const novas: PerguntaNova[] = perguntas.map((pergunta) => ({
				enunciado: pergunta.enunciado,
				alternativas: pergunta.alternativas,
				correta: pergunta.correta,
				imagem: pergunta.imagem
			}));

			const resultado = await salvarQuestionario(titulo, novas, usuario);
			sucesso = `Questionário salvo. Código da sala: ${resultado.codigo}`;
			titulo = '';
			perguntas = [novaPergunta()];
		} catch (falha) {
			erro = mensagemDeErro(falha);
		} finally {
			salvando = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight">Criar questionário</h1>
		<p class="text-muted-foreground text-sm">
			Perguntas objetivas de múltipla escolha. Cada pergunta aceita uma imagem opcional.
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
				<Card.Title>Faça login para criar questionários</Card.Title>
				<Card.Description>O criador do quiz fica vinculado à sua conta.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<Button href="/login?redirect=/criar">Entrar ou criar conta</Button>
				<Button variant="outline" href="/">Voltar ao início</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Identificação</Card.Title>
				<Card.Description>Criando como {authState.user.email}</Card.Description>
			</Card.Header>
			<Card.Content>
				<label class="flex flex-col gap-1 text-sm font-medium">
					Título do questionário
					<Input placeholder="Ex.: Revisão de História — 2º bimestre" bind:value={titulo} />
				</label>
			</Card.Content>
		</Card.Root>

		{#each perguntas as pergunta, indice (pergunta.chave)}
			<Card.Root>
				<Card.Header>
					<Card.Title>Pergunta {indice + 1}</Card.Title>
					<Card.Description>Marque a alternativa correta e, se quiser, anexe uma imagem.</Card.Description>
					<Card.Action>
						<Button
							variant="ghost"
							size="sm"
							disabled={perguntas.length === 1}
							onclick={() => removerPergunta(indice)}
						>
							Remover
						</Button>
					</Card.Action>
				</Card.Header>

				<Card.Content class="flex flex-col gap-4">
					<label class="flex flex-col gap-1 text-sm font-medium">
						Enunciado
						<Input placeholder="Escreva a pergunta" bind:value={pergunta.enunciado} />
					</label>

					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium">Alternativas</span>
						{#each pergunta.alternativas as alternativa, alternativaIndice}
							<div class="flex items-center gap-2">
								<label class="flex items-center gap-2">
									<input
										type="radio"
										class="accent-primary size-4"
										bind:group={pergunta.correta}
										value={alternativaIndice}
										aria-label={`Marcar alternativa ${LETRAS[alternativaIndice]} como correta`}
									/>
									<span class="w-4 text-sm font-medium">{LETRAS[alternativaIndice]}</span>
								</label>
								<Input
									placeholder={`Alternativa ${LETRAS[alternativaIndice]}`}
									bind:value={pergunta.alternativas[alternativaIndice]}
								/>
							</div>
						{/each}
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={pergunta.alternativas.length >= LETRAS.length}
								onclick={() => adicionarAlternativa(indice)}
							>
								Adicionar alternativa
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={pergunta.alternativas.length <= 2}
								onclick={() => removerAlternativa(indice)}
							>
								Remover última
							</Button>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<label class="flex flex-col gap-1 text-sm font-medium">
							Imagem (opcional)
							<input
								type="file"
								accept="image/*"
								class="file:bg-secondary file:text-secondary-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
								onchange={(evento) => escolherImagem(indice, evento)}
							/>
						</label>
						{#if pergunta.previa}
							<img
								src={pergunta.previa}
								alt={`Pré-visualização da imagem da pergunta ${indice + 1}`}
								class="max-h-48 w-fit rounded-md border object-contain"
							/>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		{/each}

		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={adicionarPergunta}>Adicionar pergunta</Button>
			<Button disabled={salvando} onclick={salvar}>
				{salvando ? 'Salvando…' : 'Salvar questionário'}
			</Button>
		</div>

		{#if erro}
			<p class="text-destructive text-sm" role="alert">{erro}</p>
		{/if}
		{#if sucesso}
			<p class="text-sm font-medium" role="status">{sucesso}</p>
		{/if}
	{/if}
</div>
