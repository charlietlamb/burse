import { defineConfig } from 'drizzle-kit'
import { env } from '@burse/env'

export default defineConfig({
  dialect: 'postgresql',
  schema: './schema/*',
  out: './migrations',
  dbCredentials: {
    url: env.DATABASE_URL ?? 'invalid-db-url',
  },
})
