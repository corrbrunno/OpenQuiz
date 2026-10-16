<script lang="ts">
	import type { ConteudoPergunta, RespostaComum } from '$lib/quiz/tipos';

	let {
		conteudo,
		gabarito = null
	}: { conteudo: ConteudoPergunta; gabarito?: RespostaComum | null } = $props();

	const corretos = $derived(
		new Map((gabarito?.atribuicoes ?? []).map((atribuicao) => [atribuicao.itemId, atribuicao.alvoId]))
	);
</script>

{#if conteudo.tipo === 'multipla-escolha'}
	<ul class="flex flex-col gap-1">
		{#each conteudo.opcoes as opcao (opcao.id)}
			<li
				class="rounded-md border px-3 py-2 text-sm"
				class:border-emerald-500={corretos.get(opcao.id) === 'marcada'}
				class:font-medium={corretos.get(opcao.id) === 'marcada'}
			>
				{opcao.texto}
				{#if corretos.get(opcao.id) === 'marcada'}
					<span class="text-emerald-600">(correta)</span>
				{/if}
			</li>
		{/each}
	</ul>
{:else if conteudo.tipo === 'verdadeiro-falso'}
	<div class="flex gap-2 text-sm">
		{#each [{ valor: 'verdadeiro', rotulo: 'Verdadeiro' }, { valor: 'falso', rotulo: 'Falso' }] as opcao (opcao.valor)}
			<span
				class="rounded-md border px-3 py-2"
				class:border-emerald-500={corretos.has(opcao.valor)}
				class:font-medium={corretos.has(opcao.valor)}
			>
				{opcao.rotulo}{corretos.has(opcao.valor) ? ' (correta)' : ''}
			</span>
		{/each}
	</div>
{:else if conteudo.tipo === 'categorizar'}
	<ul class="flex flex-col gap-1 text-sm">
		{#each conteudo.itens as item (item.id)}
			<li class="flex items-center gap-2">
				<span class="flex-1">{item.texto}</span>
				<span class="text-muted-foreground">
					→ {conteudo.categorias.find((categoria) => categoria.id === corretos.get(item.id))?.texto ??
						'(sem categoria)'}
				</span>
			</li>
		{/each}
	</ul>
	<p class="text-muted-foreground text-xs">
		Categorias: {conteudo.categorias.map((categoria) => categoria.texto).join(' · ')}
	</p>
{:else if conteudo.tipo === 'reordenar'}
	<ol class="flex list-decimal flex-col gap-1 pl-5 text-sm">
		{#each [...conteudo.itens].sort((a, b) => Number(corretos.get(a.id) ?? 0) - Number(corretos.get(b.id) ?? 0)) as item (item.id)}
			<li>{item.texto}</li>
		{/each}
	</ol>
{:else if conteudo.tipo === 'correspondencia'}
	<ul class="flex flex-col gap-1 text-sm">
		{#each conteudo.pares as par (par.id)}
			<li class="flex items-center gap-2">
				<span class="flex-1">{par.esquerda}</span>
				<span class="text-muted-foreground">→ {par.direita}</span>
			</li>
		{/each}
	</ul>
{/if}
