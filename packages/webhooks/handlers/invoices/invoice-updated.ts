import Stripe from 'stripe'
import { db } from '@burse/database/postgres'
import { invoices } from '@burse/database/schema/wh/invoices'
import { stripeConnects } from '@burse/database/schema/stripe/stripe-connects'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const handleInvoiceUpdated = async (event: Stripe.Event) => {
  try {
    const invoice = event.data.object as Stripe.Invoice

    // Get the Stripe Connect account
    const stripeConnect = await db.query.stripeConnects.findFirst({
      where: eq(stripeConnects.id, event.account!),
    })

    if (!stripeConnect) {
      throw new Error(
        `No Stripe Connect account found for ID: ${event.account}`
      )
    }

    // Get the existing invoice to ensure it exists
    const existingInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.stripeId, invoice.id),
    })

    if (!existingInvoice) {
      throw new Error(`No invoice found for ID: ${invoice.id}`)
    }

    // Update the invoice record with latest details
    await db
      .update(invoices)
      .set({
        status: invoice.status ?? 'draft',
        amountDue: sql`${invoice.amount_due / 100}::decimal`,
        amountPaid: sql`${invoice.amount_paid / 100}::decimal`,
        amountRemaining: sql`${invoice.amount_remaining / 100}::decimal`,
        subtotal: sql`${invoice.subtotal / 100}::decimal`,
        total: sql`${invoice.total / 100}::decimal`,
        tax: invoice.tax ? sql`${invoice.tax / 100}::decimal` : null,
        billingReason: invoice.billing_reason,
        collectionMethod: invoice.collection_method,
        description: invoice.description,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        receiptNumber: invoice.receipt_number,
        statementDescriptor: invoice.statement_descriptor,
        metadata: invoice.metadata ?? {},
        updatedAt: new Date(),
      })
      .where(eq(invoices.stripeId, invoice.id))
  } catch (error) {
    console.error('Error handling invoice.updated event:', error)
    throw error
  }
}