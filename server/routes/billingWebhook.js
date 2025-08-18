import express from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event = req.body;
  // Optional but recommended: verify signature
  // const sig = req.headers['stripe-signature'];
  // event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = Number(event.data.object.metadata?.userId);
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { plan: 'PREMIUM' }});
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const userId = Number(event.data.object.metadata?.userId);
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' }});
      }
      break;
    }
  }

  res.json({ received: true });
});

export default router;
