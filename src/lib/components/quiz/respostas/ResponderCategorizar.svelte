<script lang="ts">
	import { montarResposta, type RascunhoResposta } from '$lib/quiz/rascunhos';
	import type { ConteudoDe, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';

	let {
		pergunta,
		responder,
		estadoInicial = null,
		desabilitado = false
	}: {
		pergunta: PerguntaSalva;
		responder: (resposta: RespostaComum) => void;
		estadoInicial?: RascunhoResposta | null;
		desabilitado?: boolean;
	} = $props();

	const conteudo = $derived(pergunta.conteudo as ConteudoDe<'categorizar'>);
	function associacoesIniciais(): Record<string, string> {
		return estadoInicial?.tipo === 'categorizar' ? { ...estadoInicial.associacoes } : {};
	}

	let associacoes = $state<Record<string, string>>(associacoesIniciais());

	function associar(itemId: string, evento: Event) {
		const alvo = (evento.currentTarget as HTMLSelectElement).value;

		if (alvo) associacoes[itemId] = alvo;
		else delete associacoes[itemId];

		responder(
			montarResposta(pergunta.id, { tipo: 'categorizar', associacoes: { ...associacoes } })
		);
	}
</script>

<div class="flex flex-col gap-2">
	{#each conteudo.itens as item (item.id)}
		<div class="flex flex-wrap items-center gap-2">
			<span class="min-w-40 flex-1 text-sm">{item.texto}</span>
			<select
				class="border-input bg-background h-9 rounded-md border px-2 text-sm"
				value={associacoes[item.id] ?? ''}
				onchange={(evento) => associar(item.id, evento)}
				disabled={desabilitado}
				aria-label={`Categoria de ${item.texto}`}
			>
				<option value="">escolha…</option>
				{#each conteudo.categorias as categoria (categoria.id)}
					<option value={categoria.id}>{categoria.texto}</option>
				{/each}
			</select>
		</div>
	{/each}
</div>
