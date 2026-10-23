import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { Atribuicao, ConteudoPergunta, TipoPergunta } from '$lib/quiz/tipos';

/** O questionário em si. O código da sala NÃO fica aqui: ele nasce com a sessão. */
export const quizzes = pgTable(
	'quizzes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		titulo: text('titulo').notNull(),
		donoUid: text('dono_uid').notNull(),
		donoEmail: text('dono_email'),
		totalPerguntas: integer('total_perguntas').notNull().default(0),
		criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
		atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow()
	},
	(tabela) => [index('quizzes_dono_idx').on(tabela.donoUid)]
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

export const MODOS_SESSAO = ['conduzida', 'livre'] as const;
export type ModoSessao = (typeof MODOS_SESSAO)[number];

export const STATUS_SESSAO = ['aberta', 'encerrada'] as const;
export type StatusSessao = (typeof STATUS_SESSAO)[number];

/**
 * A sessão é a rodada ao vivo: é ela que tem o código que os participantes digitam.
 * `perguntaAtual` (ordem) só manda no modo `conduzida`.
 */
export const sessoes = pgTable(
	'sessoes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		quizId: uuid('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		donoUid: text('dono_uid').notNull(),
		codigo: varchar('codigo', { length: 6 }).notNull(),
		modo: text('modo').$type<ModoSessao>().notNull().default('conduzida'),
		status: text('status').$type<StatusSessao>().notNull().default('aberta'),
		perguntaAtual: integer('pergunta_atual').notNull().default(1),
		abertaEm: timestamp('aberta_em', { withTimezone: true }).notNull().defaultNow(),
		encerradaEm: timestamp('encerrada_em', { withTimezone: true })
	},
	(tabela) => [
		uniqueIndex('sessoes_codigo_unico').on(tabela.codigo),
		index('sessoes_quiz_idx').on(tabela.quizId),
		index('sessoes_dono_idx').on(tabela.donoUid)
	]
);

export const participantes = pgTable(
	'participantes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessaoId: uuid('sessao_id')
			.notNull()
			.references(() => sessoes.id, { onDelete: 'cascade' }),
		uid: text('uid').notNull(),
		nome: text('nome').notNull(),
		entrouEm: timestamp('entrou_em', { withTimezone: true }).notNull().defaultNow()
	},
	(tabela) => [uniqueIndex('participantes_sessao_uid_unico').on(tabela.sessaoId, tabela.uid)]
);

/**
 * Sessão do APLICATIVO (não confundir com `sessoes`, que é a rodada do quiz):
 * nasce no login, é renovada pela atividade e expira sozinha — validade checada no servidor.
 */
export const sessoesUsuario = pgTable(
	'sessoes_usuario',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		uid: text('uid').notNull(),
		email: text('email'),
		iniciadaEm: timestamp('iniciada_em', { withTimezone: true }).notNull().defaultNow(),
		ultimaAtividadeEm: timestamp('ultima_atividade_em', { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
		encerradaEm: timestamp('encerrada_em', { withTimezone: true })
	},
	(tabela) => [index('sessoes_usuario_uid_idx').on(tabela.uid)]
);

/** Uma resposta por pergunta por participante; a pontuação é calculada no servidor. */
export const respostas = pgTable(
	'respostas',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessaoId: uuid('sessao_id')
			.notNull()
			.references(() => sessoes.id, { onDelete: 'cascade' }),
		perguntaId: uuid('pergunta_id')
			.notNull()
			.references(() => perguntas.id, { onDelete: 'cascade' }),
		participanteId: uuid('participante_id')
			.notNull()
			.references(() => participantes.id, { onDelete: 'cascade' }),
		atribuicoes: jsonb('atribuicoes').$type<Atribuicao[]>().notNull(),
		acertos: integer('acertos').notNull(),
		total: integer('total').notNull(),
		respondidaEm: timestamp('respondida_em', { withTimezone: true }).notNull().defaultNow()
	},
	(tabela) => [
		uniqueIndex('respostas_sessao_pergunta_participante_unico').on(
			tabela.sessaoId,
			tabela.perguntaId,
			tabela.participanteId
		)
	]
);
