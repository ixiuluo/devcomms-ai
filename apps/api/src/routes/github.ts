import crypto from "node:crypto";
import { Router } from "express";
import { Octokit } from "octokit";
import { prisma } from "../db.js";

const router = Router();

// ── Config ──────────────────────────────────────────────────

function getGitHubConfig():
  | { clientId: string; clientSecret: string; appId: string; privateKey: string }
  | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!clientId || !clientSecret || !appId || !privateKey) {
    return null;
  }

  return { clientId, clientSecret, appId, privateKey };
}

function getWebhookSecret(): string | null {
  return process.env.GITHUB_WEBHOOK_SECRET ?? null;
}

// ── OAuth Flow ──────────────────────────────────────────────

/**
 * GET /github/login
 * Redirect user to GitHub OAuth authorization page.
 * Accepts optional ?return_url=... to redirect back after auth completes.
 */
router.get("/login", (req, res) => {
  const config = getGitHubConfig();
  if (!config) {
    const returnUrl = (req.query.return_url as string) ?? "/dashboard";
    const errorUrl = new URL(returnUrl, "http://localhost");
    errorUrl.searchParams.set("github_error", "github_not_configured");
    res.redirect(errorUrl.pathname + errorUrl.search);
    return;
  }

  const hostUrl = process.env.HOST_URL ?? "http://localhost:3000";
  const redirectUri = `${hostUrl}/api/github/callback`;
  const returnUrl = (req.query.return_url as string) ?? "/dashboard";

  // Encode return_url into state alongside the CSRF nonce
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ nonce, returnUrl })).toString("base64url");

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo,user:email");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

/**
 * GET /github/callback
 * Exchange authorization code for access token, fetch repos, store them.
 * Redirects back to the frontend with team info on success, or error on failure.
 */
router.get("/callback", async (req, res) => {
  const config = getGitHubConfig();
  if (!config) {
    res.status(503).json({ ok: false, error: "GitHub App is not configured" });
    return;
  }

  const { code, state } = req.query as { code?: string; state?: string };

  // Decode return_url from state parameter (encoded as base64url JSON in /login)
  let returnUrl = "/dashboard";
  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8"),
      ) as { nonce: string; returnUrl: string };
      if (decoded.returnUrl) returnUrl = decoded.returnUrl;
    } catch {
      // state might be a plain UUID from older login flows — ignore
    }
  }

  // Helper: redirect back to frontend with error
  function redirectError(message: string) {
    const errorUrl = new URL(returnUrl, "http://localhost");
    errorUrl.searchParams.set("github_error", message);
    res.redirect(errorUrl.pathname + errorUrl.search);
  }

  if (!code) {
    redirectError("missing_code");
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
        }),
      },
    );

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      redirectError(tokenData.error ?? "token_exchange_failed");
      return;
    }

    // Fetch authenticated user and their repos
    const octokit = new Octokit({ auth: tokenData.access_token });

    const { data: user } = await octokit.rest.users.getAuthenticated();
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "owner",
      sort: "updated",
      per_page: 50,
    });

    // Find or create a team for this user
    const teamSlug = `user-${user.login}`;
    const team = await prisma.team.upsert({
      where: { slug: teamSlug },
      create: {
        name: `${user.login}'s Team`,
        slug: teamSlug,
      },
      update: {},
    });

    // Create or update user
    await prisma.user.upsert({
      where: { githubId: String(user.id) },
      create: {
        teamId: team.id,
        githubId: String(user.id),
        name: user.name ?? user.login,
        email: user.email,
        avatarUrl: user.avatar_url,
        role: "owner",
      },
      update: {
        name: user.name ?? user.login,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    });

    // Store repos
    let storedCount = 0;
    for (const repo of repos) {
      if (repo.fork) continue; // skip forks

      await prisma.gitHubRepo.upsert({
        where: { fullName: repo.full_name },
        create: {
          teamId: team.id,
          githubId: repo.id,
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch,
        },
        update: {
          private: repo.private,
          defaultBranch: repo.default_branch,
        },
      });
      storedCount++;
    }

    // Create a default changelog for this team if none exists
    const existingChangelog = await prisma.changelog.findFirst({
      where: { teamId: team.id },
    });

    if (!existingChangelog) {
      await prisma.changelog.create({
        data: {
          teamId: team.id,
          title: `${user.login}'s Changelog`,
          slug: `${user.login}-changelog`,
          description: `Automated changelog for ${user.login}`,
        },
      });
    }

    // Redirect back to frontend dashboard with team info
    const successUrl = new URL(returnUrl, "http://localhost");
    successUrl.searchParams.set("github_connected", "true");
    successUrl.searchParams.set("team", team.slug);
    successUrl.searchParams.set("repos", String(storedCount));
    res.redirect(successUrl.pathname + successUrl.search);
  } catch (err) {
    console.error("GitHub OAuth callback error:", (err as Error).message);
    redirectError("oauth_failed");
  }
});

// ── Webhooks ────────────────────────────────────────────────

/**
 * Verify GitHub webhook signature using the raw body.
 */
function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const expected = `sha256=${computed}`;

  // Constant-time comparison
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * POST /github/webhook
 * Receive GitHub webhook events (push, pull_request, ping).
 * Verifies signature before processing.
 */
router.post("/webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"] as string;
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = req.rawBody;

    // Verify webhook signature when secret is configured
    const webhookSecret = getWebhookSecret();
    if (webhookSecret) {
      if (!rawBody) {
        res.status(400).json({ ok: false, error: "Missing raw body" });
        return;
      }
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.warn("GitHub webhook: invalid signature");
        res.status(401).json({ ok: false, error: "Invalid signature" });
        return;
      }
    }

    // Parse body from rawBody (JSON parser was bypassed for this route)
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (event === "ping") {
      res.json({ ok: true, data: { message: "Webhook registered successfully" } });
      return;
    }

    if (event === "push") {
      const repository = body.repository as Record<string, unknown> | undefined;
      const fullName = repository?.full_name as string | undefined;
      const commits = (body.commits as Array<Record<string, unknown>>) || [];

      if (fullName && commits.length > 0) {
        const repo = await prisma.gitHubRepo.findUnique({ where: { fullName } });
        if (repo) {
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

          // Trigger AI generation for new commits (fire-and-forget)
          generateEntryForCommits(repo.id, commits.map((c) => c.id as string));
        }
      }

      res.json({ ok: true, data: { processed: commits.length } });
      return;
    }

    if ((event === "pull_request" && body.action === "opened") || body.action === "synchronize") {
      const pullRequest = body.pull_request as Record<string, unknown> | undefined;
      if (pullRequest) {
        const fullName = (body.repository as Record<string, unknown>)
          ?.full_name as string | undefined;
        if (fullName) {
          const repo = await prisma.gitHubRepo.findUnique({ where: { fullName } });
          if (repo) {
            const prHead = pullRequest.head as Record<string, unknown> | undefined;
            await prisma.commit.upsert({
              where: {
                repoId_sha: {
                  repoId: repo.id,
                  sha: prHead?.sha as string,
                },
              },
              create: {
                repoId: repo.id,
                sha: prHead?.sha as string,
                message: (pullRequest.title as string) || "",
                authorName: (pullRequest.user as Record<string, string>)?.login,
                prNumber: pullRequest.number as number,
                prTitle: pullRequest.title as string,
                prBody: pullRequest.body as string | undefined,
                committedAt: new Date(pullRequest.created_at as string),
              },
              update: {
                prTitle: pullRequest.title as string,
                prBody: pullRequest.body as string | undefined,
              },
            });
          }
        }
      }
    }

    res.json({ ok: true, data: { message: `Event '${event}' acknowledged` } });
  } catch (err) {
    console.error("POST /github/webhook error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Failed to process webhook" });
  }
});

// ── Repos ───────────────────────────────────────────────────

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

// ── AI Generation (fire-and-forget after webhook) ──────────

async function generateEntryForCommits(
  repoId: string,
  commitShas: string[],
): Promise<void> {
  try {
    const repo = await prisma.gitHubRepo.findUnique({
      where: { id: repoId },
      include: { team: { include: { changelogs: { take: 1 } } } },
    });
    if (!repo || repo.team.changelogs.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const changelog = repo.team.changelogs[0]!;
    const commits = await prisma.commit.findMany({
      where: { repoId, sha: { in: commitShas } },
    });

    if (commits.length === 0) return;

    // Use AI generator if available, otherwise create placeholder entries
    const { generateChangelogEntry } = await import("../services/ai-generator.js");
    const result = await generateChangelogEntry(
      commits.map((c) => ({
        message: c.message,
        prTitle: c.prTitle,
        prBody: c.prBody,
      })),
    );

    if (!result || result.skip) return;

    // Create entry for each commit
    for (const commit of commits) {
      await prisma.entry.create({
        data: {
          changelogId: changelog.id,
          commitId: commit.id,
          category: result.category,
          title: result.title,
          summary: result.summary,
          body: result.body,
          aiGenerated: true,
          aiModel: result.aiModel,
        },
      });
    }

    console.log(`AI: generated entry for ${commits.length} commit(s)`);
  } catch (err) {
    console.error("AI generation failed for webhook:", (err as Error).message);
  }
}

export default router;
