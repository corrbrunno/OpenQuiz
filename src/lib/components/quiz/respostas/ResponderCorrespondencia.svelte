<script lang="ts">
	import { montarResposta } from '$lib/quiz/rascunhos';
	import type { ConteudoDe, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';
	import { embaralharComSemente } from '$lib/quiz/utils';

	let {
		pergunta,
		responder
	}: { pergunta: PerguntaSalva; responder: (resposta: RespostaComum) => void } = $props();

	const conteudo = $derived(pergunta.conteudo as ConteudoDe<'correspondencia'>);
	const colunaB = $derived(
		embaralharComSemente(
			conteudo.pares.map((par) => ({ id: par.idDireita, texto: par.direita })),
			pergunta.id
		)
	);

	let associacoes = $state<Record<string, string>>({});

	function associar(parId: string, evento: Event) {
		const alvo = (evento.currentTarget as HTMLSelectElement).value;

		if (alvo) associacoes[parId] = alvo;
		else delete associacoes[parId];

		responder(montarResposta(pergunta.id, { tipo: 'correspondencia', associacoes: { ...associacoes } }));
	}
</script>

<div class="flex flex-col gap-2">
	<div class="text-muted-foreground grid grid-cols-[1fr_auto_1fr] gap-2 text-xs font-medium">
		<span>Coluna A</span>
		<span></span>
		<span>Coluna B</span>
	</div>

	{#each conteudo.pares as par (par.id)}
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
			<span class="text-sm">{par.esquerda}</span>
			<span class="text-muted-foreground shrink-0">→</span>
			<select
				class="border-input bg-background h-9 rounded-md border px-2 text-sm"
				value={associacoes[par.id] ?? ''}
				onchange={(evento) => associar(par.id, evento)}
				aria-label={`Correspondência de ${par.esquerda}`}
			>
				<option value="">escolha…</option>
				{#each colunaB as opcao (opcao.id)}
					<option value={opcao.id}>{opcao.texto}</option>
				{/each}
			</select>
		</div>
	{/each}
</div>
