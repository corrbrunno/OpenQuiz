<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { estadoDeAtribuicoes, type RascunhoResposta } from '$lib/quiz/rascunhos';
	import {
		ROTULOS_TIPO,
		type Atribuicao,
		type PerguntaSalva,
		type RespostaComum
	} from '$lib/quiz/tipos';
	import ResponderCategorizar from './respostas/ResponderCategorizar.svelte';
	import ResponderCorrespondencia from './respostas/ResponderCorrespondencia.svelte';
	import ResponderMultiplaEscolha from './respostas/ResponderMultiplaEscolha.svelte';
	import ResponderReordenar from './respostas/ResponderReordenar.svelte';
	import ResponderVerdadeiroFalso from './respostas/ResponderVerdadeiroFalso.svelte';

	let {
		pergunta,
		responder,
		atribuicoesIniciais = null,
		resultado = null,
		desabilitado = false
	}: {
		pergunta: PerguntaSalva;
		responder: (resposta: RespostaComum) => void;
		atribuicoesIniciais?: Atribuicao[] | null;
		resultado?: { acertos: number; total: number } | null;
		desabilitado?: boolean;
	} = $props();

	// A pergunta não corrige nada: a correção vem do servidor (o gabarito não sai de lá).
	function estadoInicialDaPergunta(): RascunhoResposta {
		return estadoDeAtribuicoes(pergunta.conteudo, atribuicoesIniciais);
	}

	const estadoInicial: RascunhoResposta | null = estadoInicialDaPergunta();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Pergunta {pergunta.ordem}</Card.Title>
		<Card.Description>{ROTULOS_TIPO[pergunta.conteudo.tipo]}</Card.Description>
	</Card.Header>

	<Card.Content class="flex flex-col gap-4">
		{#if pergunta.imagemUrl}
			<img
				src={pergunta.imagemUrl}
				alt={`Imagem da pergunta ${pergunta.ordem}`}
				class="max-h-64 w-fit rounded-md border object-contain"
			/>
		{/if}

		<p class="text-lg">{pergunta.enunciado}</p>

		{#if pergunta.conteudo.tipo === 'multipla-escolha'}
			<ResponderMultiplaEscolha {pergunta} {responder} {estadoInicial} {desabilitado} />
		{:else if pergunta.conteudo.tipo === 'verdadeiro-falso'}
			<ResponderVerdadeiroFalso {pergunta} {responder} {estadoInicial} {desabilitado} />
		{:else if pergunta.conteudo.tipo === 'categorizar'}
			<ResponderCategorizar {pergunta} {responder} {estadoInicial} {desabilitado} />
		{:else if pergunta.conteudo.tipo === 'reordenar'}
			<ResponderReordenar {pergunta} {responder} {estadoInicial} {desabilitado} />
		{:else if pergunta.conteudo.tipo === 'correspondencia'}
			<ResponderCorrespondencia {pergunta} {responder} {estadoInicial} {desabilitado} />
		{/if}

		{#if resultado}
			<div class="flex items-center gap-2 border-t pt-4">
				<span
					class="rounded-md px-2 py-1 text-sm font-semibold {resultado.acertos === resultado.total
						? 'bg-emerald-500/15 text-emerald-600'
						: 'bg-amber-500/15 text-amber-600'}"
				>
					{resultado.acertos === resultado.total ? 'Acertou tudo' : 'Resposta registrada'}
				</span>
				<span class="text-muted-foreground text-sm">
					{resultado.acertos} de {resultado.total}
					{resultado.total === 1 ? 'item correto' : 'itens corretos'}
				</span>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
