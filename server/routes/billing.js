import express from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // pin to your chosen version
});

const router = express.Router();

// Map your logical plan names to Stripe price IDs
function mapPlanToPrice(plan) {
  switch (plan) {
    case 'PREMIUM_MONTHLY':
      return process.env.STRIPE_PRICE_PREMIUM_MONTHLY;
    default:
      return null;
  }
}

/* -----------------------------------------------------------
 *  Checkout session (subscription)
 * --------------------------------------------------------- */
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const priceId = mapPlanToPrice(req.body?.plan);
    if (!priceId) return res.status(400).json({ error: 'Unknown plan' });

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

      // Redundant user mapping
      client_reference_id: String(req.user.id),
      metadata: { userId: String(req.user.id) },
      subscription_data: { metadata: { userId: String(req.user.id) } },

      // Optional niceties
      allow_promotion_codes: true,
      // automatic_tax: { enabled: true }, // if you’ve set up Stripe Tax
    });

    res.json({ checkoutUrl: session.url });
  } catch (e) {
    console.error('Checkout error', e);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/* -----------------------------------------------------------
 *  Customer Portal
 * --------------------------------------------------------- */
router.post('/portal', requireAuth, async (req, res) => {
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
    console.error('Portal error', e);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/* -----------------------------------------------------------
 *  Helpers used by webhook
 * --------------------------------------------------------- */
async function setUserPremiumByCustomer({ stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, plan = 'PREMIUM' }) {
  const trialOrPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;

  await prisma.user.updateMany({
    where: { stripeCustomerId },
    data: {
      plan, // 'PREMIUM'
      stripeSubscriptionId,
      planExpiresAt: trialOrPeriodEnd, // optional; used for display/renewal info
    },
  });
}

async function setUserFreeByCustomer({ stripeCustomerId }) {
  await prisma.user.updateMany({
    where: { stripeCustomerId },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      planExpiresAt: null,
    },
  });
}

/* -----------------------------------------------------------
 *  Webhook (mounted with express.raw() pre-route in app.js)
 *  POST /billing/webhook
 * --------------------------------------------------------- */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).end();
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // User completed Checkout (subscriptions)
      case 'checkout.session.completed': {
        const session = event.data.object;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const currentPeriodEnd = subscription.current_period_end;

        await setUserPremiumByCustomer({
          stripeCustomerId,
          stripeSubscriptionId,
          currentPeriodEnd,
          plan: 'PREMIUM',
        });
        break;
      }

      // Subscription created/updated (renews, plan changes, trial end)
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const stripeCustomerId = sub.customer;
        const stripeSubscriptionId = sub.id;
        const status = sub.status; // 'active', 'trialing', 'past_due', 'canceled', etc.
        const currentPeriodEnd = sub.current_period_end;

        if (status === 'active' || status === 'trialing' || status === 'past_due') {
          await setUserPremiumByCustomer({
            stripeCustomerId,
            stripeSubscriptionId,
            currentPeriodEnd,
            plan: 'PREMIUM',
          });
        } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
          await setUserFreeByCustomer({ stripeCustomerId });
        }
        break;
      }

      // Subscription deleted (canceled at period end or immediately)
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const stripeCustomerId = sub.customer;
        await setUserFreeByCustomer({ stripeCustomerId });
        break;
      }

      // (Optional) Treat final payment success as confirmation
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle') {
          const stripeCustomerId = invoice.customer;
          const stripeSubscriptionId = invoice.subscription;
          const currentPeriodEnd = invoice.lines?.data?.[0]?.period?.end;
          await setUserPremiumByCustomer({
            stripeCustomerId,
            stripeSubscriptionId,
            currentPeriodEnd,
            plan: 'PREMIUM',
          });
        }
        break;
      }

      default:
        // console.log(`Unhandled event type ${event.type}`);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
