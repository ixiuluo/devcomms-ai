import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// ── Teams ─────────────────────────────────────────────────────

// Create team
router.post("/", async (req, res) => {
  try {
    const { name, slug } = req.body as { name: string; slug: string };
    if (!name || !slug) {
      res.status(400).json({ ok: false, error: "name and slug are required" });
      return;
    }
    const team = await prisma.team.create({ data: { name, slug } });
    res.status(201).json({ ok: true, data: team });
  } catch (err) {
    console.error("POST /teams error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to create team" });
  }
});

// Get team by slug
router.get("/:slug", async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { slug: req.params.slug },
      include: { githubRepos: true, changelogs: true },
    });
    if (!team) {
      res.status(404).json({ ok: false, error: "Team not found" });
      return;
    }
    res.json({ ok: true, data: team });
  } catch (err) {
    console.error("GET /teams/:slug error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch team" });
  }
});

export default router;
