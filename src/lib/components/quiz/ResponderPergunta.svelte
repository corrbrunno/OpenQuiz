<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { corrigir, resumoCorrecao } from '$lib/quiz/correcao';
	import { rotuloAlvo, rotuloItem } from '$lib/quiz/rotulos';
	import { ROTULOS_TIPO, type Correcao, type PerguntaSalva, type RespostaComum } from '$lib/quiz/tipos';
	import ResponderCategorizar from './respostas/ResponderCategorizar.svelte';
	import ResponderCorrespondencia from './respostas/ResponderCorrespondencia.svelte';
	import ResponderMultiplaEscolha from './respostas/ResponderMultiplaEscolha.svelte';
	import ResponderReordenar from './respostas/ResponderReordenar.svelte';
	import ResponderVerdadeiroFalso from './respostas/ResponderVerdadeiroFalso.svelte';

	let {
		pergunta,
		gabarito = null
	}: { pergunta: PerguntaSalva; gabarito?: RespostaComum | null } = $props();

	let resposta = $state<RespostaComum | null>(null);
	let correcao = $state<Correcao | null>(null);
	let resumo = $state('');

	function registrar(nova: RespostaComum) {
		resposta = nova;
		correcao = null;
		resumo = '';
	}

	function conferir() {
		if (!gabarito) return;

		correcao = corrigir(resposta, gabarito);
		resumo = resumoCorrecao(correcao);
	}
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

		<p>{pergunta.enunciado}</p>

		{#if pergunta.conteudo.tipo === 'multipla-escolha'}
			<ResponderMultiplaEscolha {pergunta} responder={registrar} />
		{:else if pergunta.conteudo.tipo === 'verdadeiro-falso'}
			<ResponderVerdadeiroFalso {pergunta} responder={registrar} />
		{:else if pergunta.conteudo.tipo === 'categorizar'}
			<ResponderCategorizar {pergunta} responder={registrar} />
		{:else if pergunta.conteudo.tipo === 'reordenar'}
			<ResponderReordenar {pergunta} responder={registrar} />
		{:else if pergunta.conteudo.tipo === 'correspondencia'}
			<ResponderCorrespondencia {pergunta} responder={registrar} />
		{/if}

		{#if gabarito}
			<div class="flex flex-wrap items-center gap-3 border-t pt-4">
				<Button size="sm" disabled={!resposta} onclick={conferir}>Corrigir</Button>
				{#if correcao}
					<span class="text-sm font-medium">{resumo}</span>
				{/if}
			</div>

			{#if correcao}
				<ul class="flex flex-col gap-1 text-sm">
					{#each correcao.itens as item (item.itemId)}
						<li class="flex items-start gap-2">
							{#if item.ok}
								<CheckIcon class="mt-0.5 size-4 shrink-0" />
							{:else}
								<XIcon class="text-destructive mt-0.5 size-4 shrink-0" />
							{/if}
							<span>
								{rotuloItem(pergunta.conteudo, item.itemId)}
								{#if !item.ok}
									<span class="text-muted-foreground">
										— esperado: {item.esperado ? rotuloAlvo(pergunta.conteudo, item.esperado) : 'nada'}
										· sua resposta: {item.obtido ? rotuloAlvo(pergunta.conteudo, item.obtido) : 'em branco'}
									</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="text-muted-foreground border-t pt-4 text-xs">
				Correção indisponível: o gabarito só é legível pelo dono do questionário.
			</p>
		{/if}
	</Card.Content>
</Card.Root>
