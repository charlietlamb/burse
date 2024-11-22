import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '@dubble/database/schema/users'

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id),
  token: text('token'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
