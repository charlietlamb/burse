import { pgTable, text, uuid, integer } from 'drizzle-orm/pg-core'
import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { users } from './users'
import { timestamps } from './columns.helpers'
import { sql } from 'drizzle-orm'

export const media = pgTable('media', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('userId').references(() => users.id),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  extension: text('type').notNull(),
  duration: integer('duration').notNull(),
  source: text('source').notNull(),
  language: text('language'),
  ...timestamps,
})

export const selectMediaSchema = createSelectSchema(media)
export const insertMediaSchema = createInsertSchema(media)
export type Media = typeof media.$inferSelect