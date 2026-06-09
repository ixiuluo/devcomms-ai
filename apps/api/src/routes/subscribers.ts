import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// ── Subscribers ───────────────────────────────────────────────

// Subscribe to a changelog
router.post("/", async (req, res) => {
  try {
    const { teamId, email } = req.body as { teamId: string; email: string };
    if (!teamId || !email) {
      res.status(400).json({ ok: false, error: "teamId and email are required" });
      return;
    }

    // Generate unsubscribe token
    const token = crypto.randomUUID();

    const subscriber = await prisma.subscriber.upsert({
      where: { teamId_email: { teamId, email } },
      create: { teamId, email, token },
      update: { unsubscribedAt: null }, // re-subscribe if previously unsubscribed
    });

    res.status(201).json({ ok: true, data: subscriber });
  } catch (err) {
    console.error("POST /subscribers error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to subscribe" });
  }
});

// Unsubscribe (via token)
router.post("/unsubscribe", async (req, res) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) {
      res.status(400).json({ ok: false, error: "token is required" });
      return;
    }

    await prisma.subscriber.updateMany({
      where: { token },
      data: { unsubscribedAt: new Date() },
    });

    res.json({ ok: true, data: { message: "Unsubscribed" } });
  } catch (err) {
    console.error("POST /subscribers/unsubscribe error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to unsubscribe" });
  }
});

// List subscribers for a team
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      res.status(400).json({ ok: false, error: "teamId query param required" });
      return;
    }
    const subscribers = await prisma.subscriber.findMany({
      where: { teamId, unsubscribedAt: null },
      select: { id: true, email: true, verified: true, createdAt: true },
    });
    res.json({ ok: true, data: subscribers });
  } catch (err) {
    console.error("GET /subscribers error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch subscribers" });
  }
});

export default router;
