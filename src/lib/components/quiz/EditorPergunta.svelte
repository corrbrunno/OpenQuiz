<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { DESCRICOES_TIPO, type TipoPergunta } from '$lib/quiz/tipos';
	import { trocarTipo, type RascunhoPergunta } from '$lib/quiz/rascunhos';
	import EditorCategorizar from './editores/EditorCategorizar.svelte';
	import EditorCorrespondencia from './editores/EditorCorrespondencia.svelte';
	import EditorMultiplaEscolha from './editores/EditorMultiplaEscolha.svelte';
	import EditorReordenar from './editores/EditorReordenar.svelte';
	import EditorVerdadeiroFalso from './editores/EditorVerdadeiroFalso.svelte';
	import SeletorTipo from './SeletorTipo.svelte';

	let {
		rascunho,
		indice,
		total,
		onRemover
	}: {
		rascunho: RascunhoPergunta;
		indice: number;
		total: number;
		onRemover: () => void;
	} = $props();

	function escolherImagem(evento: Event) {
		const arquivo = (evento.currentTarget as HTMLInputElement).files?.[0] ?? null;

		if (rascunho.previa) URL.revokeObjectURL(rascunho.previa);
		rascunho.imagem = arquivo;
		rascunho.previa = arquivo ? URL.createObjectURL(arquivo) : null;
	}

	function aplicarTipo(tipo: TipoPergunta) {
		trocarTipo(rascunho, tipo);
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Pergunta {indice + 1}</Card.Title>
		<Card.Description>{DESCRICOES_TIPO[rascunho.conteudo.tipo]}</Card.Description>
		<Card.Action>
			<Button variant="ghost" size="sm" disabled={total <= 1} onclick={onRemover}>
				Remover
			</Button>
		</Card.Action>
	</Card.Header>

	<Card.Content class="flex flex-col gap-5">
		<SeletorTipo valor={rascunho.conteudo.tipo} onMudar={aplicarTipo} />

		<label class="flex flex-col gap-1 text-sm font-medium">
			Enunciado
			<Input placeholder="Escreva a pergunta" bind:value={rascunho.enunciado} />
		</label>

		{#if rascunho.conteudo.tipo === 'multipla-escolha'}
			<EditorMultiplaEscolha {rascunho} />
		{:else if rascunho.conteudo.tipo === 'verdadeiro-falso'}
			<EditorVerdadeiroFalso {rascunho} />
		{:else if rascunho.conteudo.tipo === 'categorizar'}
			<EditorCategorizar {rascunho} />
		{:else if rascunho.conteudo.tipo === 'reordenar'}
			<EditorReordenar {rascunho} />
		{:else if rascunho.conteudo.tipo === 'correspondencia'}
			<EditorCorrespondencia {rascunho} />
		{/if}

		<div class="flex flex-col gap-2">
			<label class="flex flex-col gap-1 text-sm font-medium">
				Imagem (opcional)
				<input
					type="file"
					accept="image/*"
					class="file:bg-secondary file:text-secondary-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
					onchange={escolherImagem}
				/>
			</label>
			{#if rascunho.previa}
				<img
					src={rascunho.previa}
					alt={`Pré-visualização da imagem da pergunta ${indice + 1}`}
					class="max-h-48 w-fit rounded-md border object-contain"
				/>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
