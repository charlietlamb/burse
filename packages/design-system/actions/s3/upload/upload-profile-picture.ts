'use server'

import client from '@burse/design-system/lib/client'
import { headersWithCookies } from '@burse/design-system/lib/header-with-cookies'

export async function uploadProfilePicture(path: string): Promise<number> {
  const response = await client.s3.upload['profile-image'].$post(
    {
      json: { path },
    },
    await headersWithCookies()
  )
  return response.status
}
