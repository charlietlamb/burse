import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { updateUserSchema } from './schema'
import { selectUserSchema } from '@/src/db/schema/users'

const tags = ['Users']

export const get = createRoute({
  path: '/user/get/:userId',
  method: 'get',
  summary: 'Get a user by their ID',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUserSchema, 'User information.'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        error: z.string(),
      }),
      'User ID is required'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        error: z.string(),
      }),
      'User not found'
    ),
  },
})

export type GetUserRoute = typeof get

export const update = createRoute({
  path: '/user/update',
  method: 'put',
  summary: 'Update a user by their ID',
  tags,
  request: {
    body: jsonContentRequired(updateUserSchema, 'User update information.'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectUserSchema,
      'User update information.'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        error: z.string(),
      }),
      'Incorrect body sent'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        error: z.string(),
      }),
      'User not found'
    ),
  },
})

export type UpdateUserRoute = typeof update
