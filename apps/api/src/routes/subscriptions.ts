import { Router } from "express";
import type Stripe from "stripe";
import { prisma } from "../db.js";

const router = Router();

// ── Config ──────────────────────────────────────────────────

function getStripeConfig():
  | { secretKey: string; webhookSecret: string; priceId: string }
  | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !webhookSecret || !priceId) return null;

  return { secretKey, webhookSecret, priceId };
}

let stripeInstance: Stripe | null = null;

async function getStripe(): Promise<Stripe | null> {
  if (stripeInstance) return stripeInstance;
  const config = getStripeConfig();
  if (!config) return null;

  const { default: StripeLib } = await import("stripe");
  stripeInstance = new StripeLib(config.secretKey, {
    apiVersion: "2026-05-27.dahlia",
  });
  return stripeInstance;
}

// ── Helpers ─────────────────────────────────────────────────

async function ensureSubscription(teamId: string) {
  return prisma.subscription.upsert({
    where: { teamId },
    create: { teamId, plan: "free", status: "active" },
    update: {},
  });
}

// ── Routes ──────────────────────────────────────────────────

/**
 * GET /subscriptions/status?teamId=<id>
 * Returns the current subscription status for a team.
 */
router.get("/status", async (req, res) => {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      res.status(400).json({ ok: false, error: "teamId query param required" });
      return;
    }

    const subscription = await ensureSubscription(teamId);
    res.json({ ok: true, data: subscription });
  } catch (err) {
    console.error("GET /subscriptions/status error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to get subscription status" });
  }
});

/**
 * POST /subscriptions/create-checkout
 * Creates a Stripe Checkout Session for subscription purchase.
 * Body: { teamId: string, successUrl?: string, cancelUrl?: string }
 */
router.post("/create-checkout", async (req, res) => {
  try {
    const { teamId, successUrl, cancelUrl } = req.body as {
      teamId: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!teamId) {
      res.status(400).json({ ok: false, error: "teamId is required" });
      return;
    }

    const stripe = await getStripe();
    const config = getStripeConfig();
    if (!stripe || !config) {
      res.status(503).json({ ok: false, error: "Stripe is not configured" });
      return;
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      res.status(404).json({ ok: false, error: "Team not found" });
      return;
    }

    const subscription = await ensureSubscription(teamId);
    const hostUrl = process.env.HOST_URL ?? "http://localhost:3000";

    // Create or reuse a Stripe customer
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: team.name,
        metadata: { teamId },
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { teamId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url: successUrl || `${hostUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${hostUrl}/dashboard`,
      metadata: { teamId },
    });

    res.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    console.error("POST /subscriptions/create-checkout error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to create checkout session" });
  }
});

/**
 * POST /subscriptions/portal
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * Body: { teamId: string, returnUrl?: string }
 */
router.post("/portal", async (req, res) => {
  try {
    const { teamId, returnUrl } = req.body as {
      teamId: string;
      returnUrl?: string;
    };

    if (!teamId) {
      res.status(400).json({ ok: false, error: "teamId is required" });
      return;
    }

    const stripe = await getStripe();
    if (!stripe) {
      res.status(503).json({ ok: false, error: "Stripe is not configured" });
      return;
    }

    const subscription = await prisma.subscription.findUnique({ where: { teamId } });
    if (!subscription?.stripeCustomerId) {
      res.status(400).json({ ok: false, error: "No Stripe customer found for this team" });
      return;
    }

    const hostUrl = process.env.HOST_URL ?? "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || `${hostUrl}/dashboard`,
    });

    res.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    console.error("POST /subscriptions/portal error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to create portal session" });
  }
});

/**
 * POST /subscriptions/webhook
 * Stripe webhook handler — processes subscription lifecycle events.
 * Body parser bypasses express.json() (raw body needed for signature verification).
 */
router.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const signature = req.headers["stripe-signature"] as string;

    if (!rawBody) {
      res.status(400).json({ ok: false, error: "Missing raw body" });
      return;
    }

    const stripe = await getStripe();
    const config = getStripeConfig();
    if (!stripe || !config) {
      res.status(503).json({ ok: false, error: "Stripe is not configured" });
      return;
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const teamId = session.metadata?.teamId;
        const subscriptionId = session.subscription as string;

        if (teamId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const firstItem = sub.items.data[0];
          await prisma.subscription.upsert({
            where: { teamId },
            create: {
              teamId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: "starter",
              status: sub.status,
              currentPeriodStart: firstItem?.current_period_start
                ? new Date(firstItem.current_period_start * 1000)
                : null,
              currentPeriodEnd: firstItem?.current_period_end
                ? new Date(firstItem.current_period_end * 1000)
                : null,
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: "starter",
              status: sub.status,
              currentPeriodStart: firstItem?.current_period_start
                ? new Date(firstItem.current_period_start * 1000)
                : null,
              currentPeriodEnd: firstItem?.current_period_end
                ? new Date(firstItem.current_period_end * 1000)
                : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const dbSub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (dbSub) {
          const plan = subscription.items.data[0]?.price?.nickname?.toLowerCase() ?? "starter";
          const firstItem = subscription.items.data[0];
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              stripeSubscriptionId: subscription.id,
              plan,
              status: subscription.status,
              currentPeriodStart: firstItem?.current_period_start
                ? new Date(firstItem.current_period_start * 1000)
                : null,
              currentPeriodEnd: firstItem?.current_period_end
                ? new Date(firstItem.current_period_end * 1000)
                : null,
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Optionally send a reminder notification
        break;
      }
    }

    res.json({ ok: true, data: { received: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /subscriptions/webhook error:", message);
    res.status(400).json({ ok: false, error: `Webhook error: ${message}` });
  }
});

export default router;
