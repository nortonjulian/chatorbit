import express from 'express';
import Stripe from 'stripe';
import pkg from '@prisma/client';
import Boom from '@hapi/boom';
import { requireAuth } from '../middleware/auth.js';

const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const router = express.Router();

/* ----------------------------------------------
 * Utils
 * --------------------------------------------*/
function mapPlanToPrice(plan) {
  switch (plan) {
    case 'PREMIUM_MONTHLY':
      return process.env.STRIPE_PRICE_PREMIUM_MONTHLY;
    default:
      return null;
  }
}

async function setUserPremiumByCustomer({ stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, plan = 'PREMIUM' }) {
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;
  await prisma.user.updateMany({
    where: { stripeCustomerId: String(stripeCustomerId) },
    data: {
      plan,
      stripeSubscriptionId: stripeSubscriptionId ? String(stripeSubscriptionId) : null,
      planExpiresAt: periodEnd,
    },
  });
}

async function setUserFreeByCustomer({ stripeCustomerId }) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: String(stripeCustomerId) },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      planExpiresAt: null,
    },
  });
}

/**
 * Try to resolve a userId directly from the event:
 * 1) checkout.session.*: client_reference_id / metadata.userId
 * 2) any: object.metadata.userId
 * 3) fallback: retrieve Stripe Customer and read metadata.userId
 */
async function resolveUserIdFromEvent(event) {
  const obj = event?.data?.object || {};
  // 1) checkout session path
  if (obj.client_reference_id && Number(obj.client_reference_id)) return Number(obj.client_reference_id);
  if (obj.metadata?.userId && Number(obj.metadata.userId)) return Number(obj.metadata.userId);
  // 2) generic object metadata
  if (obj?.metadata?.userId && Number(obj.metadata.userId)) return Number(obj.metadata.userId);
  // 3) customer metadata
  if (obj.customer) {
    try {
      const customer = await stripe.customers.retrieve(obj.customer);
      const metaId = customer?.metadata?.userId;
      if (metaId && Number(metaId)) return Number(metaId);
    } catch {
      // ignore
    }
  }
  return null;
}

/* ----------------------------------------------
 * Checkout session (subscription)
 * --------------------------------------------*/
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const priceId = mapPlanToPrice(req.body?.plan);
    if (!priceId) throw Boom.badRequest('Unknown plan');

    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, stripeCustomerId: true },
    });

    // Ensure single Stripe customer per user
    let customerId = me?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: me?.email || undefined,
        metadata: { userId: String(req.user.id) },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: req.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/settings/upgrade?status=success`,
      cancel_url: `${webUrl}/settings/upgrade?status=cancel`,
      // Redundant user mapping for webhook correlation
      client_reference_id: String(req.user.id),
      metadata: { userId: String(req.user.id) },
      subscription_data: { metadata: { userId: String(req.user.id) } },
      allow_promotion_codes: true,
    });

    res.json({ checkoutUrl: session.url });
  } catch (e) {
    next(e);
  }
});

/* ----------------------------------------------
 * Customer Portal
 * --------------------------------------------*/
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeCustomerId: true },
    });
    if (!me?.stripeCustomerId) {
      return res.status(409).json({ error: 'No billing profile yet. Start a checkout first.' });
    }

    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    const portal = await stripe.billingPortal.sessions.create({
      customer: me.stripeCustomerId,
      return_url: `${webUrl}/settings/upgrade`,
    });

    res.json({ portalUrl: portal.url });
  } catch (e) {
    next(e);
  }
});

/* ----------------------------------------------
 * Webhook (mounted with express.raw() in app.js)
 * --------------------------------------------*/
router.post('/webhook', async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const skipSig = process.env.STRIPE_SKIP_SIG_CHECK === 'true' || process.env.NODE_ENV === 'test';
  const sig = req.headers['stripe-signature'];

  // Helper: robustly parse body if skipping signature (handles Buffer or JSON)
  const parseLoose = (body) => {
    if (!body) return {};
    if (Buffer.isBuffer(body)) {
      try { return JSON.parse(body.toString('utf8')); } catch { return {}; }
    }
    if (typeof body === 'string') {
      try { return JSON.parse(body); } catch { return {}; }
    }
    return body; // already an object
  };

  let event;
  try {
    if (!skipSig) {
      if (!endpointSecret) {
        console.error('Missing STRIPE_WEBHOOK_SECRET');
        return res.status(500).end();
      }
      // req.body must be raw Buffer here
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // In tests (or when explicitly allowed), accept JSON body
      event = parseLoose(req.body);
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message || 'Bad signature'}`);
  }

  try {
    const obj = event?.data?.object || {};
    const userId = await resolveUserIdFromEvent(event);

    // Helper to flip PREMIUM by direct userId (and persist customerId when present)
    const setPremiumByUserId = async () => {
      const updates = {
        plan: 'PREMIUM',
      };
      if (obj.customer) updates.stripeCustomerId = String(obj.customer);
      if (obj.subscription) updates.stripeSubscriptionId = String(obj.subscription);
      // best-effort period end
      if (obj.current_period_end) {
        updates.planExpiresAt = new Date(obj.current_period_end * 1000);
      }
      await prisma.user.update({ where: { id: Number(userId) }, data: updates });
    };

    const setFreeByUserId = async () => {
      await prisma.user.update({
        where: { id: Number(userId) },
        data: { plan: 'FREE', stripeSubscriptionId: null, planExpiresAt: null },
      });
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        // Prefer direct user update (has client_reference_id/metadata)
        if (userId) {
          await setPremiumByUserId();
        } else if (obj.customer) {
          // Fallback by customer id
          let currentPeriodEnd = null;
          if (obj.subscription) {
            try {
              const sub = await stripe.subscriptions.retrieve(obj.subscription);
              currentPeriodEnd = sub?.current_period_end || null;
            } catch {/* ignore */}
          }
          await setUserPremiumByCustomer({
            stripeCustomerId: obj.customer,
            stripeSubscriptionId: obj.subscription || null,
            currentPeriodEnd,
            plan: 'PREMIUM',
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const activeish = ['active', 'trialing', 'past_due'].includes(obj.status);
        if (userId) {
          if (activeish) {
            await setPremiumByUserId();
          } else {
            await setFreeByUserId();
          }
          // ensure Customer carries metadata.userId for future correlation
          if (obj.customer) {
            try {
              await stripe.customers.update(obj.customer, { metadata: { userId: String(userId) } });
            } catch {/* ignore */}
          }
        } else if (obj.customer) {
          if (activeish) {
            await setUserPremiumByCustomer({
              stripeCustomerId: obj.customer,
              stripeSubscriptionId: obj.id,
              currentPeriodEnd: obj.current_period_end,
              plan: 'PREMIUM',
            });
          } else {
            await setUserFreeByCustomer({ stripeCustomerId: obj.customer });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        if (userId) {
          await setFreeByUserId();
        } else if (obj.customer) {
          await setUserFreeByCustomer({ stripeCustomerId: obj.customer });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Optional: treat as confirmation for create/cycle
        if (['subscription_create', 'subscription_cycle'].includes(obj.billing_reason)) {
          if (userId) {
            await setPremiumByUserId();
          } else if (obj.customer) {
            const line = obj.lines?.data?.[0];
            const periodEnd = line?.period?.end || null;
            await setUserPremiumByCustomer({
              stripeCustomerId: obj.customer,
              stripeSubscriptionId: obj.subscription || null,
              currentPeriodEnd: periodEnd,
              plan: 'PREMIUM',
            });
          }
        }
        break;
      }

      default:
        // ignore others
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
