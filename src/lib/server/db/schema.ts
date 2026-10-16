import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { Atribuicao, ConteudoPergunta, TipoPergunta } from '$lib/quiz/tipos';

export const quizzes = pgTable(
	'quizzes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		titulo: text('titulo').notNull(),
		codigo: varchar('codigo', { length: 6 }).notNull(),
		donoUid: text('dono_uid').notNull(),
		donoEmail: text('dono_email'),
		totalPerguntas: integer('total_perguntas').notNull().default(0),
		criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
	},
	(tabela) => [
		uniqueIndex('quizzes_codigo_unico').on(tabela.codigo),
		index('quizzes_dono_idx').on(tabela.donoUid)
	]
);

/** O conteúdo da pergunta (opções/itens/pares) fica em JSON; a resposta certa NÃO fica aqui. */
export const perguntas = pgTable(
	'perguntas',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		quizId: uuid('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		ordem: integer('ordem').notNull(),
		enunciado: text('enunciado').notNull(),
		imagemUrl: text('imagem_url'),
		tipo: text('tipo').$type<TipoPergunta>().notNull(),
		conteudo: jsonb('conteudo').$type<ConteudoPergunta>().notNull()
	},
	(tabela) => [uniqueIndex('perguntas_quiz_ordem_unico').on(tabela.quizId, tabela.ordem)]
);

/** O gabarito é resposta no mesmo formato comum do jogador; a API só o entrega para o dono. */
export const gabaritos = pgTable('gabaritos', {
	perguntaId: uuid('pergunta_id')
		.primaryKey()
		.references(() => perguntas.id, { onDelete: 'cascade' }),
	quizId: uuid('quiz_id')
		.notNull()
		.references(() => quizzes.id, { onDelete: 'cascade' }),
	donoUid: text('dono_uid').notNull(),
	tipo: text('tipo').$type<TipoPergunta>().notNull(),
	atribuicoes: jsonb('atribuicoes').$type<Atribuicao[]>().notNull()
});
