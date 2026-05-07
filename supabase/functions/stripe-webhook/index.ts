import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const PRICE_TO_TIER: Record<string, 'pro' | 'premium'> = {
  [Deno.env.get('STRIPE_PRO_PRICE_ID') ?? '']:          'pro',
  [Deno.env.get('STRIPE_PREMIUM_PRICE_ID') ?? '']:      'premium',
  [Deno.env.get('STRIPE_PRO_ANNUAL_PRICE_ID') ?? '']:   'pro',
  [Deno.env.get('STRIPE_PREMIUM_ANNUAL_PRICE_ID') ?? '']: 'premium',
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  console.log(`Processing Stripe event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const priceId = session.metadata?.price_id
        if (!userId) { console.error('No user_id in session metadata'); break }

        const tier = PRICE_TO_TIER[priceId ?? ''] ?? 'pro'
        let subData: Record<string, unknown> = {}

        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          subData = {
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price.id,
            status: sub.status === 'trialing' ? 'trialing' : 'active',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          }
        }

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          tier,
          stripe_customer_id: session.customer as string,
          updated_at: new Date().toISOString(),
          ...subData,
        }, { onConflict: 'user_id' })

        console.log(`User ${userId} upgraded to ${tier}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id
        const tier = PRICE_TO_TIER[priceId ?? ''] ?? 'pro'

        await supabase.from('subscriptions').update({
          tier,
          status: sub.status,
          stripe_price_id: priceId,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase.from('subscriptions').update({
          tier: 'free',
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        console.log(`Subscription ${sub.id} canceled — downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await supabase.from('subscriptions').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription as string)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.billing_reason === 'subscription_create') break
        await supabase.from('subscriptions').update({
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription as string)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription
        console.log(`Trial ending soon for subscription: ${sub.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook:', err)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
