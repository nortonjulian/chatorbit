import Stripe from 'stripe';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function resolveUserIdFromEvent(event) {
  const obj = event?.data?.object || {};
  if (obj.client_reference_id && Number(obj.client_reference_id)) return Number(obj.client_reference_id);
  if (obj.metadata?.userId && Number(obj.metadata.userId)) return Number(obj.metadata.userId);
  if (obj.customer) {
    try {
      const customer = await stripe.customers.retrieve(obj.customer);
      const metaId = customer?.metadata?.userId;
      if (metaId && Number(metaId)) return Number(metaId);
    } catch {}
  }
  return null;
}

export default async function billingWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body);
  } catch (err) {
    console.error('Stripe signature verification failed:', err?.message);
    return res.status(400).send('Bad signature');
  }

  try {
    const userId = await resolveUserIdFromEvent(event);
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        // Persist customerId if missing
        if (userId && obj.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: String(obj.customer), plan: 'PREMIUM' },
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const activeish = ['active', 'trialing', 'past_due'].includes(obj.status);
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: activeish ? 'PREMIUM' : 'FREE',
              stripeSubscriptionId: String(obj.id),
            },
          });
        }
        // Ensure the Customer carries userId for future events
        if (obj.customer) {
          try {
            await stripe.customers.update(obj.customer, {
              metadata: { userId: String(userId || '') },
            });
          } catch {}
        }
        break;
      }

      case 'customer.subscription.deleted': {
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan: 'FREE' },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('Webhook error');
  }
}
