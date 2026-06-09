import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// ── Changelogs ────────────────────────────────────────────────

// Create changelog
router.post("/", async (req, res) => {
  try {
    const { teamId, title, slug, description, repoId } = req.body as {
      teamId: string;
      title: string;
      slug: string;
      description?: string;
      repoId?: string;
    };
    if (!teamId || !title || !slug) {
      res.status(400).json({ ok: false, error: "teamId, title, and slug are required" });
      return;
    }
    const changelog = await prisma.changelog.create({
      data: { teamId, title, slug, description, repoId },
    });
    res.status(201).json({ ok: true, data: changelog });
  } catch (err) {
    console.error("POST /changelogs error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to create changelog" });
  }
});

// List changelogs for a team
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    const where = teamId ? { teamId } : {};
    const changelogs = await prisma.changelog.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ ok: true, data: changelogs });
  } catch (err) {
    console.error("GET /changelogs error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch changelogs" });
  }
});

// Get changelog by ID (public-facing — only published entries)
router.get("/:id", async (req, res) => {
  try {
    const changelog = await prisma.changelog.findUnique({
      where: { id: req.params.id },
      include: {
        entries: {
          where: { published: true },
          orderBy: { publishedAt: "desc" },
        },
        releases: {
          where: { published: true },
          include: { entries: { where: { published: true } } },
          orderBy: { publishedAt: "desc" },
        },
      },
    });
    if (!changelog) {
      res.status(404).json({ ok: false, error: "Changelog not found" });
      return;
    }
    res.json({ ok: true, data: changelog });
  } catch (err) {
    console.error("GET /changelogs/:id error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch changelog" });
  }
});

// Publish changelog (all approved entries go live)
router.post("/:id/publish", async (req, res) => {
  try {
    // Publish all approved but unpublished entries
    await prisma.entry.updateMany({
      where: { changelogId: req.params.id, approved: true, published: false },
      data: { published: true, publishedAt: new Date() },
    });
    const changelog = await prisma.changelog.update({
      where: { id: req.params.id },
      data: { published: true },
      include: { entries: { where: { published: true } } },
    });
    res.json({ ok: true, data: changelog });
  } catch (err) {
    console.error("POST /changelogs/:id/publish error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to publish changelog" });
  }
});

export default router;
