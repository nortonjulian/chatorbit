import express from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// Map your logical plan names to Stripe price IDs
function mapPlanToPrice(plan) {
  switch (plan) {
    case 'PREMIUM_MONTHLY':
      return process.env.STRIPE_PRICE_PREMIUM_MONTHLY;
    default:
      return null;
  }
}

// Create a Stripe Checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Billing not configured' });

    const { plan } = req.body || {};
    const priceId = mapPlanToPrice(plan);
    if (!priceId) return res.status(400).json({ error: 'Unknown plan' });

    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/settings/upgrade?status=success`,
      cancel_url: `${webUrl}/settings/upgrade?status=cancel`,
      client_reference_id: String(req.user.id),
      // Optionally collect billing address, tax, etc.
    });

    return res.json({ checkoutUrl: session.url });
  } catch (e) {
    console.error('Checkout error', e);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Webhook: mark user as PREMIUM when Stripe confirms payment/subscription
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).end();

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // optional but recommended
    let event = req.body;

    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }

    // Handle a couple of key events — you can expand this:
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = Number(session.client_reference_id);
      if (Number.isFinite(userId)) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'PREMIUM' },
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      // Optional: downgrade on cancel/expire
      const sub = event.data.object;
      // You’d look up the user via sub.customer metadata you set, or store mapping on create.
      // await prisma.user.update({ where: { id }, data: { plan: 'FREE' } });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(400).send(`Webhook Error`);
  }
});

export default router;
