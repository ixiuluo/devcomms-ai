import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// ── Analytics ───────────────────────────────────────────────────

// Track a page view on a changelog
// No IP stored — per acceptance criteria (no PII collected)
router.post('/changelogs/:id/views', async (req, res) => {
  try {
    const { path, referrer, userAgent } = req.body as {
      path: string;
      referrer?: string;
      userAgent?: string;
    };

    if (!path) {
      res.status(400).json({ ok: false, error: 'path is required' });
      return;
    }

    // Verify changelog exists
    const changelog = await prisma.changelog.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!changelog) {
      res.status(404).json({ ok: false, error: 'Changelog not found' });
      return;
    }

    // Anonymize user agent: keep only browser/OS family, strip version details
    const anonymizedUA = userAgent ? userAgent.replace(/\d+/g, 'X').slice(0, 200) : null;

    const view = await prisma.pageView.create({
      data: {
        changelogId: req.params.id,
        path,
        referrer: referrer ?? null,
        userAgent: anonymizedUA,
        ip: null, // explicitly null — no PII collected
      },
    });

    res.status(201).json({ ok: true, data: { id: view.id } });
  } catch (err) {
    console.error('POST /analytics/changelogs/:id/views error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to track page view' });
  }
});

// Get analytics for a single changelog
router.get('/changelogs/:id/analytics', async (req, res) => {
  try {
    const changelog = await prisma.changelog.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true },
    });
    if (!changelog) {
      res.status(404).json({ ok: false, error: 'Changelog not found' });
      return;
    }

    // Total views
    const totalViews = await prisma.pageView.count({
      where: { changelogId: req.params.id },
    });

    // Views per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentViews = await prisma.pageView.findMany({
      where: {
        changelogId: req.params.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const viewsPerDay: Record<string, number> = {};
    for (const v of recentViews) {
      const day = v.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      viewsPerDay[day] = (viewsPerDay[day] ?? 0) + 1;
    }

    // Fill in missing days with 0
    const dailyData: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyData.push({ date: key, count: viewsPerDay[key] ?? 0 });
    }

    // Top referrers
    const referrers = await prisma.pageView.groupBy({
      by: ['referrer'],
      where: {
        changelogId: req.params.id,
        referrer: { not: null },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: 10,
    });

    const topReferrers = referrers.map(
      (r: { referrer: string | null; _count: { referrer: number } }) => ({
        referrer: r.referrer!,
        count: r._count.referrer,
      }),
    );

    res.json({
      ok: true,
      data: {
        changelogId: changelog.id,
        changelogTitle: changelog.title,
        totalViews,
        viewsPerDay: dailyData,
        topReferrers,
      },
    });
  } catch (err) {
    console.error('GET /analytics/changelogs/:id/analytics error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to fetch analytics' });
  }
});

// Get aggregate analytics for a team
router.get('/teams/:id/analytics', async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });
    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found' });
      return;
    }

    // Get all changelogs for this team
    const changelogs = await prisma.changelog.findMany({
      where: { teamId: req.params.id },
      select: { id: true },
    });
    const changelogIds = changelogs.map((c: { id: string }) => c.id);

    // Total views across all team changelogs
    const totalViews = await prisma.pageView.count({
      where: { changelogId: { in: changelogIds } },
    });

    // Views per day (last 30 days) across all team changelogs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentViews = await prisma.pageView.findMany({
      where: {
        changelogId: { in: changelogIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const viewsPerDay: Record<string, number> = {};
    for (const v of recentViews) {
      const day = v.createdAt.toISOString().slice(0, 10);
      viewsPerDay[day] = (viewsPerDay[day] ?? 0) + 1;
    }

    const dailyData: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyData.push({ date: key, count: viewsPerDay[key] ?? 0 });
    }

    // Subscriber count (active, not unsubscribed)
    const subscriberCount = await prisma.subscriber.count({
      where: { teamId: req.params.id, unsubscribedAt: null },
    });

    // Per-changelog breakdown
    const perChangelog = await Promise.all(
      changelogs.map(async (cl: { id: string }) => {
        const views = await prisma.pageView.count({
          where: { changelogId: cl.id },
        });
        const changelog = await prisma.changelog.findUnique({
          where: { id: cl.id },
          select: { id: true, title: true, slug: true },
        });
        return { ...changelog!, views };
      }),
    );

    res.json({
      ok: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        totalViews,
        viewsPerDay: dailyData,
        subscriberCount,
        changelogs: perChangelog,
      },
    });
  } catch (err) {
    console.error('GET /analytics/teams/:id/analytics error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to fetch team analytics' });
  }
});

export default router;
