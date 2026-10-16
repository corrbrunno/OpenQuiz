import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const quizzes = pgTable('quizzes', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	joinCode: text('join_code').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
