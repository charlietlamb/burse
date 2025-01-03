import { AppRouteHandler } from '@burse/hono/lib/types'
import { HttpStatusCodes } from '@burse/http'
import { stripeProducts } from '@burse/database/schema/stripe/stripe-products'
import { stripePrices } from '@burse/database/schema/stripe/stripe-prices'
import { stripeConnects } from '@burse/database/schema/stripe/stripe-connects'
import { db } from '@burse/database'
import { and, eq } from 'drizzle-orm'
import type {
  CreateStripeProductRoute,
  DeleteStripeProductRoute,
  GetStripeProductByIdRoute,
  GetStripeProductsRoute,
  UpdateStripeProductRoute,
} from './stripe-products.routes'
import { v4 as uuidv4 } from 'uuid'
import { stripe, stripeTest } from '@burse/stripe'
import type Stripe from 'stripe'
import { PriceFormSchema } from '@burse/design-system/types/stripe/prices'

export const getStripeProducts: AppRouteHandler<
  GetStripeProductsRoute
> = async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const { offset, limit, stripeConnectId } = await c.req.valid('json')

  try {
    const stripeProductsList = await db.query.stripeProducts.findMany({
      where: and(
        eq(stripeProducts.userId, user.id),
        eq(stripeProducts.stripeConnectId, stripeConnectId)
      ),
      offset,
      limit,
      with: {
        stripeConnect: true,
        prices: true,
      },
    })

    return c.json({ stripeProducts: stripeProductsList }, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error getting stripe products:', error)
    return c.json(
      { error: 'Failed to get stripe products' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getStripeProductById: AppRouteHandler<
  GetStripeProductByIdRoute
> = async (c) => {
  const { stripeProductId } = await c.req.valid('json')
  const stripeProduct = await db.query.stripeProducts.findFirst({
    where: eq(stripeProducts.id, stripeProductId),
    with: {
      stripeConnect: true,
      prices: true,
    },
  })

  if (!stripeProduct) {
    return c.json(
      { error: 'Stripe product not found' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json({ stripeProduct }, HttpStatusCodes.OK)
}

export const createStripeProduct: AppRouteHandler<
  CreateStripeProductRoute
> = async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const product = await c.req.valid('json')

  try {
    // Validate input data
    if (!product.title || !product.prices || product.prices.length === 0) {
      return c.json(
        {
          error:
            'Invalid product data. Title and at least one price are required.',
        },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    // Get the Stripe account ID from the stripe connect record
    const stripeConnect = await db.query.stripeConnects.findFirst({
      where: eq(stripeConnects.id, product.stripeConnectId),
    })

    if (!stripeConnect) {
      console.error(
        `Stripe Connect account not found for ID: ${product.stripeConnectId}`
      )
      return c.json(
        { error: 'Stripe Connect account not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }

    const stripeUserId = stripeConnect.stripeUserId
    if (!stripeUserId) {
      console.error(
        `No Stripe User ID found for connect account: ${product.stripeConnectId}`
      )
      return c.json(
        { error: 'Stripe account not properly configured' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    let liveProduct: Stripe.Product
    let testProduct: Stripe.Product

    try {
      // Create product in live mode using stripe instance
      liveProduct = await stripe.products.create(
        {
          name: product.title,
          metadata: {
            userId: user.id,
            environment: 'live',
          },
        },
        {
          stripeAccount: stripeUserId,
        }
      )

      // Create product in test mode using stripeTest instance
      testProduct = await stripeTest.products.create(
        {
          name: product.title,
          metadata: {
            userId: user.id,
            environment: 'test',
          },
        },
        {
          stripeAccount: stripeUserId,
        }
      )
    } catch (stripeError) {
      console.error('Stripe product creation failed:', stripeError)
      if (stripeError instanceof stripe.errors.StripeError) {
        return c.json(
          {
            error: 'Stripe product creation failed',
            details: stripeError.message,
          },
          HttpStatusCodes.BAD_REQUEST
        )
      }
      throw stripeError
    }

    const productId = uuidv4()

    // Use a transaction for database operations
    try {
      await db.transaction(async (tx) => {
        // Store in database
        await tx.insert(stripeProducts).values({
          id: productId,
          userId: user.id,
          stripeConnectId: product.stripeConnectId,
          title: product.title,
          stripeProductId: liveProduct.id,
          stripeTestProductId: testProduct.id,
        })

        // Create prices for the product
        for (const price of product.prices) {
          try {
            // Create live price using stripe instance
            const livePrice = await stripe.prices.create(
              {
                product: liveProduct.id,
                currency: price.currency.toLowerCase(),
                unit_amount: Math.round(price.price * 100),
                nickname: price.title,
              },
              {
                stripeAccount: stripeUserId,
              }
            )

            // Create test price using stripeTest instance
            const testPrice = await stripeTest.prices.create(
              {
                product: testProduct.id,
                currency: price.currency.toLowerCase(),
                unit_amount: Math.round(price.price * 100),
                nickname: price.title,
              },
              {
                stripeAccount: stripeUserId,
              }
            )

            await tx.insert(stripePrices).values({
              id: uuidv4(),
              stripeProductId: productId,
              title: price.title,
              stripePriceId: livePrice.id,
              stripeTestPriceId: testPrice.id,
              amount: Math.round(price.price * 100),
              currency: price.currency,
            })
          } catch (priceError) {
            console.error('Failed to create price:', priceError)
            throw priceError
          }
        }
      })
    } catch (dbError) {
      console.error('Database transaction failed:', dbError)
      // Attempt to clean up Stripe products if DB transaction fails
      try {
        await Promise.all([
          stripe.products.del(liveProduct.id, {
            stripeAccount: stripeUserId,
          }),
          stripeTest.products.del(testProduct.id, {
            stripeAccount: stripeUserId,
          }),
        ])
      } catch (cleanupError) {
        console.error('Failed to cleanup Stripe products:', cleanupError)
      }
      throw dbError
    }

    return c.json(
      {
        success: true,
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error creating stripe product:', error)
    return c.json(
      {
        error: 'Failed to create stripe product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const deleteStripeProduct: AppRouteHandler<
  DeleteStripeProductRoute
> = async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const { productId } = await c.req.valid('json')
  const stripeProduct = await db.query.stripeProducts.findFirst({
    where: eq(stripeProducts.id, productId),
    with: {
      stripeConnect: true,
      prices: true,
    },
  })

  if (!stripeProduct) {
    return c.json(
      { error: 'Stripe product not found' },
      HttpStatusCodes.NOT_FOUND
    )
  }

  const stripeUserId = stripeProduct.stripeConnect.stripeUserId
  if (!stripeUserId) {
    return c.json(
      { error: 'Stripe account not properly configured' },
      HttpStatusCodes.NOT_FOUND
    )
  }

  try {
    await db.transaction(async (tx) => {
      // Step 1: Get all prices (both active and inactive) for both live and test products
      const [livePrices, testPrices] = await Promise.all([
        stripe.prices.list(
          {
            product: stripeProduct.stripeProductId,
            limit: 100,
          },
          {
            stripeAccount: stripeUserId,
          }
        ),
        stripeTest.prices.list(
          {
            product: stripeProduct.stripeTestProductId,
            limit: 100,
          },
          {
            stripeAccount: stripeUserId,
          }
        ),
      ])

      // Step 2: Archive all prices (Stripe doesn't allow price deletion)
      const archivePricePromises = [
        ...livePrices.data.map((price) =>
          stripe.prices.update(
            price.id,
            { active: false },
            {
              stripeAccount: stripeUserId,
            }
          )
        ),
        ...testPrices.data.map((price) =>
          stripeTest.prices.update(
            price.id,
            { active: false },
            {
              stripeAccount: stripeUserId,
            }
          )
        ),
      ]

      await Promise.all(archivePricePromises)

      // Step 3: Archive and then delete products in Stripe
      await Promise.all([
        // First archive the products
        stripe.products.update(
          stripeProduct.stripeProductId,
          {
            active: false,
            metadata: {
              archived_at: new Date().toISOString(),
              archived_by: user.id,
            },
          },
          {
            stripeAccount: stripeUserId,
          }
        ),
        stripeTest.products.update(
          stripeProduct.stripeTestProductId,
          {
            active: false,
            metadata: {
              archived_at: new Date().toISOString(),
              archived_by: user.id,
            },
          },
          {
            stripeAccount: stripeUserId,
          }
        ),
      ])

      // Then delete the products
      await Promise.all([
        stripe.products.del(stripeProduct.stripeProductId, {
          stripeAccount: stripeUserId,
        }),
        stripeTest.products.del(stripeProduct.stripeTestProductId, {
          stripeAccount: stripeUserId,
        }),
      ])

      // Step 4: Delete from our database - prices will be deleted automatically due to cascade
      await tx.delete(stripeProducts).where(eq(stripeProducts.id, productId))
    })

    return c.json({ success: true }, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error deleting stripe product:', error)
    return c.json(
      {
        error: 'Failed to delete stripe product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const updateStripeProduct: AppRouteHandler<
  UpdateStripeProductRoute
> = async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const product = await c.req.valid('json')

  try {
    // Get the existing product with its prices
    const existingProduct = await db.query.stripeProducts.findFirst({
      where: eq(stripeProducts.id, product.productId),
      with: {
        stripeConnect: true,
        prices: true,
      },
    })

    if (!existingProduct) {
      return c.json(
        { error: 'Stripe product not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }

    if (existingProduct.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
    }

    const stripeUserId = existingProduct.stripeConnect.stripeUserId
    if (!stripeUserId) {
      return c.json(
        { error: 'Stripe account not properly configured' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    if (
      !existingProduct.stripeProductId ||
      !existingProduct.stripeTestProductId
    ) {
      return c.json(
        { error: 'Product not properly configured in Stripe' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    // Start a transaction for all database operations
    await db.transaction(async (tx) => {
      // 1. Update the product name in Stripe (both live and test)
      if (product.title !== existingProduct.title) {
        await Promise.all([
          stripe.products.update(
            existingProduct.stripeProductId,
            { name: product.title },
            { stripeAccount: stripeUserId }
          ),
          stripeTest.products.update(
            existingProduct.stripeTestProductId,
            { name: product.title },
            { stripeAccount: stripeUserId }
          ),
        ])

        // Update product in our database
        await tx
          .update(stripeProducts)
          .set({ title: product.title })
          .where(eq(stripeProducts.id, product.productId))
      }

      // 2. Handle prices
      const existingPriceMap = new Map(
        existingProduct.prices.map((price) => [price.id, price])
      )
      const newPriceMap = new Map(
        product.prices.map((price) => [price.id, price])
      )

      // Prices to archive (prices that exist in DB but not in the update)
      const pricesToArchive = existingProduct.prices.filter(
        (price) => !newPriceMap.has(price.id)
      )

      // Archive removed prices in Stripe
      for (const price of pricesToArchive) {
        if (price.stripePriceId) {
          const archivePromises: Promise<Stripe.Response<Stripe.Price>>[] = [
            stripe.prices.update(
              price.stripePriceId,
              { active: false },
              { stripeAccount: stripeUserId }
            ),
          ]

          if (price.stripeTestPriceId) {
            archivePromises.push(
              stripeTest.prices.update(
                price.stripeTestPriceId,
                { active: false },
                { stripeAccount: stripeUserId }
              )
            )
          }

          await Promise.all(archivePromises)
        }
        // Delete from our database
        await tx.delete(stripePrices).where(eq(stripePrices.id, price.id))
      }

      // Update existing prices and create new ones
      for (const newPrice of product.prices as PriceFormSchema[]) {
        const existingPrice = existingPriceMap.get(newPrice.id)

        if (existingPrice) {
          // Price exists - check if it needs updating
          if (
            existingPrice.amount !== Math.round(newPrice.price * 100) ||
            existingPrice.currency !== newPrice.currency ||
            existingPrice.title !== newPrice.title
          ) {
            // Create new prices in Stripe (prices can't be updated, only archived)
            const stripePriceData = {
              product: existingProduct.stripeProductId,
              currency: newPrice.currency.toLowerCase(),
              unit_amount: Math.round(newPrice.price * 100),
              nickname: newPrice.title,
            } as const

            const [livePrice, testPrice] = await Promise.all([
              stripe.prices.create(stripePriceData, {
                stripeAccount: stripeUserId,
              }),
              stripeTest.prices.create(
                {
                  ...stripePriceData,
                  product: existingProduct.stripeTestProductId,
                },
                { stripeAccount: stripeUserId }
              ),
            ])

            // Archive old prices
            if (existingPrice.stripePriceId) {
              const archivePromises: Promise<Stripe.Response<Stripe.Price>>[] =
                [
                  stripe.prices.update(
                    existingPrice.stripePriceId,
                    { active: false },
                    { stripeAccount: stripeUserId }
                  ),
                ]

              if (existingPrice.stripeTestPriceId) {
                archivePromises.push(
                  stripeTest.prices.update(
                    existingPrice.stripeTestPriceId,
                    { active: false },
                    { stripeAccount: stripeUserId }
                  )
                )
              }

              await Promise.all(archivePromises)
            }

            // Update in our database
            await tx
              .update(stripePrices)
              .set({
                stripePriceId: livePrice.id,
                stripeTestPriceId: testPrice.id,
                title: newPrice.title,
                amount: Math.round(newPrice.price * 100),
                currency: newPrice.currency,
              })
              .where(eq(stripePrices.id, newPrice.id))
          }
        } else {
          // New price - create it
          const stripePriceData = {
            product: existingProduct.stripeProductId,
            currency: newPrice.currency.toLowerCase(),
            unit_amount: Math.round(newPrice.price * 100),
            nickname: newPrice.title,
          } as const

          const [livePrice, testPrice] = await Promise.all([
            stripe.prices.create(stripePriceData, {
              stripeAccount: stripeUserId,
            }),
            stripeTest.prices.create(
              {
                ...stripePriceData,
                product: existingProduct.stripeTestProductId,
              },
              { stripeAccount: stripeUserId }
            ),
          ])

          // Insert into our database
          await tx.insert(stripePrices).values({
            id: uuidv4(),
            stripeProductId: product.productId,
            stripePriceId: livePrice.id,
            stripeTestPriceId: testPrice.id,
            title: newPrice.title,
            amount: Math.round(newPrice.price * 100),
            currency: newPrice.currency,
          })
        }
      }
    })

    return c.json({ success: true }, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error updating stripe product:', error)
    return c.json(
      {
        error: 'Failed to update stripe product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
