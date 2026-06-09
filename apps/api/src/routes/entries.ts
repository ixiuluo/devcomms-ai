import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// ── Entries (changelog entries) ───────────────────────────────

// List entries (with optional filters for approval queue)
router.get("/", async (req, res) => {
  try {
    const { changelogId, approved, published } = req.query;
    const where: Record<string, unknown> = {};
    if (changelogId) where.changelogId = changelogId;
    if (approved !== undefined) where.approved = approved === "true";
    if (published !== undefined) where.published = published === "true";

    const entries = await prisma.entry.findMany({
      where,
      include: { commit: { select: { sha: true, message: true, prNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, data: entries });
  } catch (err) {
    console.error("GET /entries error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch entries" });
  }
});

// Get single entry
router.get("/:id", async (req, res) => {
  try {
    const entry = await prisma.entry.findUnique({
      where: { id: req.params.id },
      include: { commit: true, changelog: true },
    });
    if (!entry) {
      res.status(404).json({ ok: false, error: "Entry not found" });
      return;
    }
    res.json({ ok: true, data: entry });
  } catch (err) {
    console.error("GET /entries/:id error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch entry" });
  }
});

// Update entry (edit title, summary, category before approval)
router.patch("/:id", async (req, res) => {
  try {
    const { title, summary, body, category } = req.body as {
      title?: string;
      summary?: string;
      body?: string;
      category?: string;
    };
    const entry = await prisma.entry.update({
      where: { id: req.params.id },
      data: { title, summary, body, category },
    });
    res.json({ ok: true, data: entry });
  } catch (err) {
    console.error("PATCH /entries/:id error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to update entry" });
  }
});

// Approve entry
router.post("/:id/approve", async (req, res) => {
  try {
    const entry = await prisma.entry.update({
      where: { id: req.params.id },
      data: { approved: true },
    });
    res.json({ ok: true, data: entry });
  } catch (err) {
    console.error("POST /entries/:id/approve error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to approve entry" });
  }
});

// Reject entry (delete or mark as rejected)
router.post("/:id/reject", async (req, res) => {
  try {
    // Soft-reject: mark as not approved, AI can regenerate
    const entry = await prisma.entry.update({
      where: { id: req.params.id },
      data: { approved: false },
    });
    res.json({ ok: true, data: entry });
  } catch (err) {
    console.error("POST /entries/:id/reject error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to reject entry" });
  }
});

export default router;
