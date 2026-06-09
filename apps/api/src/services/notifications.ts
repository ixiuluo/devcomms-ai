import { prisma } from "../db.js";

// ── Config ──────────────────────────────────────────────────

interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from: string;
}

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "noreply@devcomms.ai",
  };
}

function getHostUrl(): string {
  return process.env.HOST_URL ?? "http://localhost:3000";
}

// ── Slack ───────────────────────────────────────────────────

async function sendSlackNotification(
  webhookUrl: string,
  entry: { title: string; summary: string; category: string },
  changelog: { title: string; slug: string },
  teamSlug: string,
): Promise<void> {
  const categoryEmoji: Record<string, string> = {
    added: ":sparkles:",
    changed: ":wrench:",
    fixed: ":bug:",
    removed: ":wastebasket:",
    deprecated: ":warning:",
    security: ":lock:",
  };

  const emoji = categoryEmoji[entry.category] ?? ":memo:";
  const changelogUrl = `${getHostUrl()}/${teamSlug}/${changelog.slug}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} New Changelog Entry: ${entry.title}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: entry.summary,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${changelogUrl}|${changelog.title}>`,
        },
      ],
    },
  ];

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    console.error("Slack notification failed:", response.status, await response.text());
  }
}

// ── Email ───────────────────────────────────────────────────

async function sendEmailNotification(
  to: string,
  entry: { title: string; summary: string; body: string | null; category: string },
  changelog: { title: string; slug: string },
  teamSlug: string,
  unsubscribeToken: string,
): Promise<void> {
  const config = getEmailConfig();
  if (!config) {
    console.warn("Email notification skipped: SMTP not configured");
    return;
  }

  const { createTransport } = await import("nodemailer");
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth:
      config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : undefined,
  });

  const changelogUrl = `${getHostUrl()}/${teamSlug}/${changelog.slug}`;
  const unsubscribeUrl = `${getHostUrl()}/api/subscribers/unsubscribe?token=${unsubscribeToken}`;

  const bodyHtml = entry.body
    ? `<div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;">${escapeHtml(entry.body)}</div>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#333;">${escapeHtml(entry.title)}</h2>
      <p style="color:#555;font-size:15px;line-height:1.5;">${escapeHtml(entry.summary)}</p>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:13px;color:#999;">
        <a href="${changelogUrl}" style="color:#6366f1;">View on ${escapeHtml(changelog.title)}</a>
        &middot;
        <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: `[${changelog.title}] ${entry.title}`,
      html,
    });
  } catch (err) {
    console.error("Email notification failed:", (err as Error).message);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Orchestrator ────────────────────────────────────────────

/**
 * Send notifications for published entries in a changelog.
 * Called after publish action completes.
 */
export async function notifyPublishedEntries(changelogId: string): Promise<void> {
  try {
    const changelog = await prisma.changelog.findUnique({
      where: { id: changelogId },
      include: {
        team: {
          include: {
            slackIntegrations: { where: { enabled: true } },
            subscribers: { where: { unsubscribedAt: null } },
          },
        },
        entries: {
          where: { published: true, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!changelog || changelog.entries.length === 0) return;

    const team = changelog.team;
    const teamSlug = team.slug;

    // For each newly published entry, send notifications
    for (const entry of changelog.entries) {
      // Slack notifications
      for (const slack of team.slackIntegrations) {
        await sendSlackNotification(slack.webhookUrl, entry, changelog, teamSlug);
      }

      // Email notifications
      const emailConfig = getEmailConfig();
      if (emailConfig) {
        for (const subscriber of team.subscribers) {
          await sendEmailNotification(
            subscriber.email,
            entry,
            changelog,
            teamSlug,
            subscriber.token,
          );
        }
      }
    }
  } catch (err) {
    console.error("notifyPublishedEntries error:", (err as Error).message);
  }
}
