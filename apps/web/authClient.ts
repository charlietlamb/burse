import { env } from '@dubble/env'
import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { auth } from '@dubble/auth'

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API,
  plugins: [inferAdditionalFields<typeof auth>()],
})