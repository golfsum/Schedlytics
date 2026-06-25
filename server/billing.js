/*
 *  Stripe subscriptions for Schedlytics.
 *
 *  One Checkout Session per upgrade, one webhook to keep each user's plan in
 *  sync, and a Billing Portal link so people can manage or cancel themselves.
 *  The user's plan lives in KV keyed by their Firebase UID, so it follows them
 *  across devices the same way settings do.
 *
 *  Everything here is a no-op until STRIPE_SECRET_KEY is set, so the app still
 *  runs (and the Upgrade modal falls back to a local plan switch) without it.
 */
import Stripe from 'stripe'
import { hashStore } from './kv.js'
import { verifyIdToken } from './lib/firebaseAuth.js'
import { BASE_URL, FRONTEND_URL } from './config.js'

const SECRET = process.env.STRIPE_SECRET_KEY
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

// Price IDs come from env so test and live can use different prices. The
// defaults are the current sandbox prices, so checkout works out of the box in
// test mode; set the live price IDs in production.
const PRICE = {
  pro: process.env.STRIPE_PRICE_CREATOR || 'price_1TmMc4CuwzF55lMX9GeX6yO5',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_1TmMdHCuwzF55lMXa1Fn3FWt',
}
// Reverse lookup (price -> plan id) for webhook handling.
const PLAN_FOR_PRICE = Object.fromEntries(Object.entries(PRICE).map(([plan, price]) => [price, plan]))

export const billingEnabled = Boolean(SECRET)

let _stripe = null
function stripe() {
  if (!_stripe) _stripe = new Stripe(SECRET, { apiVersion: '2024-06-20' })
  return _stripe
}

// uid -> { plan, status, customerId, subscriptionId, priceId, currentPeriodEnd, updatedAt }
const plans = hashStore('schedlytics:billing', 'billing.json')

const FREE = { plan: 'free', status: 'none' }

/** The stored plan record for a user, or the free default. */
async function planForUid(uid) {
  return (await plans.get(uid)) || { ...FREE }
}

/** Map a Stripe subscription to our plan record and persist it under `uid`. */
async function saveFromSubscription(uid, sub, customerId) {
  const priceId = sub.items?.data?.[0]?.price?.id || null
  const plan = PLAN_FOR_PRICE[priceId] || 'pro'
  const active = ['active', 'trialing', 'past_due'].includes(sub.status)
  const record = {
    plan: active ? plan : 'free',
    status: sub.status,
    customerId: customerId || sub.customer || null,
    subscriptionId: sub.id,
    priceId,
    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    updatedAt: Date.now(),
  }
  await plans.put(uid, record)
  return record
}

/* ------------------------------- middleware ------------------------------- */

async function requireUser(req, res, next) {
  if (!PROJECT_ID) return res.status(501).json({ error: 'Billing is not configured' })
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '')
  if (!m) return res.status(401).json({ error: 'missing bearer token' })
  try {
    req.auth = await verifyIdToken(m[1], PROJECT_ID)
    next()
  } catch (err) {
    res.status(401).json({ error: `auth failed: ${err.message}` })
  }
}

/* --------------------------------- routes --------------------------------- */

/**
 * Register the JSON billing routes. Call AFTER express.json(). The webhook is
 * registered separately (it needs the raw body) via stripeWebhook below.
 */
export function registerBillingRoutes(app) {
  // The user's current plan (used by the app on load).
  app.get('/api/billing/status', requireUser, async (req, res) => {
    if (!billingEnabled) return res.json({ ...FREE, billingEnabled: false })
    try {
      res.json({ ...(await planForUid(req.auth.uid)), billingEnabled: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Start a Checkout Session for the chosen plan; returns the URL to redirect to.
  app.post('/api/billing/checkout', requireUser, async (req, res) => {
    if (!billingEnabled) return res.status(501).json({ error: 'Billing is not configured' })
    const planId = req.body?.plan
    const price = PRICE[planId]
    if (!price) return res.status(400).json({ error: 'unknown plan' })
    try {
      const existing = await planForUid(req.auth.uid)
      const appUrl = `${FRONTEND_URL}/app/`
      const session = await stripe().checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        client_reference_id: req.auth.uid,
        // Reuse a saved customer when we have one, else create from the email.
        ...(existing.customerId
          ? { customer: existing.customerId }
          : { customer_email: req.auth.email || undefined }),
        metadata: { uid: req.auth.uid, plan: planId },
        subscription_data: { metadata: { uid: req.auth.uid } },
        allow_promotion_codes: true,
        success_url: `${appUrl}?billing=success`,
        cancel_url: `${appUrl}?billing=cancel`,
      })
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Open the Stripe Billing Portal so the user can change or cancel their plan.
  app.post('/api/billing/portal', requireUser, async (req, res) => {
    if (!billingEnabled) return res.status(501).json({ error: 'Billing is not configured' })
    try {
      const record = await planForUid(req.auth.uid)
      if (!record.customerId) return res.status(400).json({ error: 'no subscription to manage' })
      const session = await stripe().billingPortal.sessions.create({
        customer: record.customerId,
        return_url: `${FRONTEND_URL}/app/`,
      })
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}

/* -------------------------------- webhook --------------------------------- */

/**
 * Stripe webhook handler. Must be mounted with express.raw() so the signature
 * can be verified against the exact request body.
 */
export async function stripeWebhook(req, res) {
  if (!billingEnabled || !WEBHOOK_SECRET) return res.status(501).end()
  let event
  try {
    event = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook signature check failed: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const uid = session.client_reference_id || session.metadata?.uid
        if (uid && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(session.subscription)
          await saveFromSubscription(uid, sub, session.customer)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const uid = sub.metadata?.uid
        if (uid) await saveFromSubscription(uid, sub, sub.customer)
        break
      }
      default:
        break
    }
  } catch (err) {
    // Log and still 200 so Stripe does not hammer retries on our own bug.
    console.error('[stripe webhook]', event.type, err.message)
  }

  res.json({ received: true })
}

// Surface the configured base URL in logs for setup sanity (webhook target).
export const WEBHOOK_PATH = '/api/stripe/webhook'
export const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`
