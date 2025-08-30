import express from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map your logical plan names to Stripe price IDs
function mapPlanToPrice(plan) {
  switch (plan) {
    case 'PREMIUM_MONTHLY':
      return process.env.STRIPE_PRICE_PREMIUM_MONTHLY;
    default:
      return null;
  }
}

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

// (Optional) Customer Portal now reliably works because we have customerId
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

export default router;
