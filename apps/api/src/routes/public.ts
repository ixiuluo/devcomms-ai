import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// ── Public API (CORS-friendly, no auth required) ──────────────

// Get published changelog entries for a team (by slug)
// Used by the embeddable widget
// GET /api/public/:teamSlug?max=5
router.get('/:teamSlug', async (req, res) => {
  try {
    const max = Math.min(Math.max(1, parseInt(req.query.max as string, 10) || 10), 50);

    // Find the team by slug
    const team = await prisma.team.findUnique({
      where: { slug: req.params.teamSlug },
      include: {
        changelogs: {
          where: { published: true },
          select: { id: true, title: true, slug: true, description: true },
        },
      },
    });

    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found' });
      return;
    }

    if (team.changelogs.length === 0) {
      res.json({
        ok: true,
        data: {
          team: { name: team.name, slug: team.slug },
          changelogs: [],
          entries: [],
        },
      });
      return;
    }

    // Get published entries across all published changelogs
    const changelogIds = team.changelogs.map((c: { id: string }) => c.id);

    const entries = await prisma.entry.findMany({
      where: {
        changelogId: { in: changelogIds },
        published: true,
      },
      include: {
        changelog: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: max,
    });

    res.json({
      ok: true,
      data: {
        team: { name: team.name, slug: team.slug },
        changelogs: team.changelogs,
        entries: entries.map((e) => ({
          id: e.id,
          title: e.title,
          summary: e.summary,
          body: e.body,
          category: e.category,
          publishedAt: e.publishedAt,
          changelog: e.changelog,
        })),
      },
    });
  } catch (err) {
    console.error('GET /public/:teamSlug error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to fetch changelog entries' });
  }
});

export default router;
