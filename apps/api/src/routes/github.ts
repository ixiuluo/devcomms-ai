import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// ── GitHub Integration ────────────────────────────────────────

// OAuth callback — exchange code for token, store repo connection
router.get("/callback", async (_req, res) => {
  // Placeholder: GitHub OAuth callback
  // 1. Exchange code for access token
  // 2. Fetch user's repos
  // 3. Store repo connection
  res.json({ ok: true, data: { message: "GitHub OAuth callback placeholder" } });
});

// Webhook receiver for push events
router.post("/webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"] as string;
    const body = req.body as Record<string, unknown>;

    if (event === "ping") {
      res.json({ ok: true, data: { message: "Webhook registered successfully" } });
      return;
    }

    if (event === "push") {
      // Process push event: extract commits, store them
      const repository = body.repository as Record<string, unknown> | undefined;
      const fullName = repository?.full_name as string | undefined;
      const commits = (body.commits as Array<Record<string, unknown>>) || [];

      if (fullName && commits.length > 0) {
        const repo = await prisma.gitHubRepo.findUnique({ where: { fullName } });
        if (repo) {
          // Store commits
          for (const c of commits) {
            await prisma.commit.upsert({
              where: {
                repoId_sha: {
                  repoId: repo.id,
                  sha: c.id as string,
                },
              },
              create: {
                repoId: repo.id,
                sha: c.id as string,
                message: (c.message as string) || "",
                authorName: (c.author as Record<string, string>)?.name,
                authorEmail: (c.author as Record<string, string>)?.email,
                committedAt: new Date(c.timestamp as string),
              },
              update: {},
            });
          }
        }
      }
      res.json({ ok: true, data: { processed: commits.length } });
      return;
    }

    if (event === "pull_request") {
      // Process PR event: store PR info with commits
      const action = body.action as string;
      const pullRequest = body.pull_request as Record<string, unknown> | undefined;
      if (pullRequest && (action === "opened" || action === "synchronize")) {
        // Store PR metadata — the actual changelog generation happens asynchronously
        res.json({ ok: true, data: { message: "PR event received" } });
        return;
      }
    }

    res.json({ ok: true, data: { message: `Event '${event}' acknowledged` } });
  } catch (err) {
    console.error("POST /github/webhook error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to process webhook" });
  }
});

// List connected repos for a team
router.get("/repos", async (req, res) => {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      res.status(400).json({ ok: false, error: "teamId query param required" });
      return;
    }
    const repos = await prisma.gitHubRepo.findMany({
      where: { teamId },
      include: { _count: { select: { commits: true } } },
    });
    res.json({ ok: true, data: repos });
  } catch (err) {
    console.error("GET /github/repos error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to fetch repos" });
  }
});

export default router;
