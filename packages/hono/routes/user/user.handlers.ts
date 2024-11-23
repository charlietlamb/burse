import {
  GetUserRoute,
  ResetPasswordRoute,
  UpdateUserRoute,
} from '@dubble/hono/routes/user/user.routes'
import { AppRouteHandler } from '@dubble/hono/lib/types'
import { db } from '@dubble/database'
import { eq } from 'drizzle-orm'
import { users } from '@dubble/database/schema/users'
import { updateUserSchema } from '@dubble/hono/routes/user/user.schema'
import { HttpStatusCodes } from '@dubble/http'
import { verifications } from '@dubble/database/schema/verifications'
import { hashPassword } from '@dubble/hono/lib/password'
import { accounts } from '@dubble/database/schema'

export const get: AppRouteHandler<GetUserRoute> = async (c) => {
  const userId = c.req.param('userId')
  if (!userId) {
    return c.json({ error: 'User ID is required' }, HttpStatusCodes.BAD_REQUEST)
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(user, HttpStatusCodes.OK)
}

export const update: AppRouteHandler<UpdateUserRoute> = async (c) => {
  const authUser = await c.get('user')
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }
  const body = await c.req.json()
  const data = updateUserSchema.parse(body)
  if (!data) {
    return c.json({ error: 'Incorrect body sent' }, HttpStatusCodes.BAD_REQUEST)
  }

  const [user] = await db
    .update(users)
    .set({
      ...data.form,
      emailVerified: data.form.email === authUser.email,
    })
    .where(eq(users.id, authUser.id))
    .returning()

  if (!user) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(user, HttpStatusCodes.OK)
}

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
  const { token, password } = await c.req.json()
  if (!token) {
    return c.json({ error: 'Token is required' }, HttpStatusCodes.BAD_REQUEST)
  }
  const verification = await db.query.verifications.findFirst({
    where: eq(verifications.identifier, `reset-password:${token}`),
  })
  if (!verification) {
    return c.json(
      { error: 'Verification not found' },
      HttpStatusCodes.NOT_FOUND
    )
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, verification.value),
  })

  if (!user) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }
  const hashedPassword = await hashPassword(password)
  await db
    .update(accounts)
    .set({ password: hashedPassword })
    .where(eq(accounts.userId, user.id))
  return c.json({ success: true }, HttpStatusCodes.OK)
}