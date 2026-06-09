import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// ── Category display labels ───────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  added: 'Added',
  fixed: 'Fixed',
  changed: 'Changed',
  deprecated: 'Deprecated',
  removed: 'Removed',
  security: 'Security',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ── Helpers ────────────────────────────────────────────────────

interface EntryRow {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string | null;
  publishedAt: Date | null;
  releaseId: string | null;
  release: {
    version: string;
    title: string | null;
    publishedAt: Date | null;
  } | null;
}

async function fetchPublishedData(changelogId: string) {
  const changelog = await prisma.changelog.findUnique({
    where: { id: changelogId },
    select: { id: true, title: true, updatedAt: true },
  });
  if (!changelog) return null;

  const entries = (await prisma.entry.findMany({
    where: { changelogId, published: true },
    select: {
      id: true,
      category: true,
      title: true,
      summary: true,
      body: true,
      publishedAt: true,
      releaseId: true,
      release: {
        select: { version: true, title: true, publishedAt: true },
      },
    },
    orderBy: { publishedAt: 'desc' },
  })) as unknown as EntryRow[];

  return { changelog, entries };
}

// ── Markdown export ────────────────────────────────────────────

function renderMarkdownFlat(title: string, entries: EntryRow[]): string {
  const lines: string[] = [`# ${title}`, ''];

  // Group by category, preserving insertion order
  const byCategory = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const existing = byCategory.get(e.category);
    if (existing) {
      existing.push(e);
    } else {
      byCategory.set(e.category, [e]);
    }
  }

  for (const [category, items] of byCategory) {
    lines.push(`### ${categoryLabel(category)}`, '');
    for (const item of items) {
      const date = item.publishedAt
        ? ` (${new Date(item.publishedAt).toISOString().slice(0, 10)})`
        : '';
      lines.push(`- ${item.title}${date}`);
      if (item.summary) {
        lines.push(`  ${item.summary}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function renderMarkdownByRelease(title: string, entries: EntryRow[]): string {
  const lines: string[] = [`# ${title}`, ''];

  // Group entries by release
  const releaseMap = new Map<
    string,
    { version: string; releaseTitle: string | null; publishedAt: Date | null; entries: EntryRow[] }
  >();

  // Collect un-released entries
  const unreleased: EntryRow[] = [];

  for (const e of entries) {
    if (e.release) {
      const key = e.release.version;
      if (!releaseMap.has(key)) {
        releaseMap.set(key, {
          version: e.release.version,
          releaseTitle: e.release.title,
          publishedAt: e.release.publishedAt,
          entries: [],
        });
      }
      releaseMap.get(key)!.entries.push(e);
    } else {
      unreleased.push(e);
    }
  }

  // Sort releases by publishedAt desc
  const sortedReleases = [...releaseMap.values()].sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });

  for (const release of sortedReleases) {
    const versionDate = release.publishedAt
      ? ` (${new Date(release.publishedAt).toISOString().slice(0, 10)})`
      : '';
    const heading = release.releaseTitle
      ? `## ${release.version} — ${release.releaseTitle}${versionDate}`
      : `## ${release.version}${versionDate}`;
    lines.push(heading, '');

    // Group entries within release by category
    const byCategory = new Map<string, EntryRow[]>();
    for (const e of release.entries) {
      const existing = byCategory.get(e.category);
      if (existing) {
        existing.push(e);
      } else {
        byCategory.set(e.category, [e]);
      }
    }

    for (const [category, items] of byCategory) {
      lines.push(`### ${categoryLabel(category)}`, '');
      for (const item of items) {
        lines.push(`- ${item.title}`);
        if (item.summary) {
          lines.push(`  ${item.summary}`);
        }
      }
      lines.push('');
    }
  }

  // Unreleased entries
  if (unreleased.length > 0) {
    lines.push('## Unreleased', '');

    const byCategory = new Map<string, EntryRow[]>();
    for (const e of unreleased) {
      const existing = byCategory.get(e.category);
      if (existing) {
        existing.push(e);
      } else {
        byCategory.set(e.category, [e]);
      }
    }

    for (const [category, items] of byCategory) {
      lines.push(`### ${categoryLabel(category)}`, '');
      for (const item of items) {
        lines.push(`- ${item.title}`);
        if (item.summary) {
          lines.push(`  ${item.summary}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim() + '\n';
}

router.get('/:id/export.md', async (req, res) => {
  try {
    const format = (req.query.format as string | undefined) ?? 'flat';
    const data = await fetchPublishedData(req.params.id);
    if (!data) {
      res.status(404).json({ ok: false, error: 'Changelog not found' });
      return;
    }

    const md =
      format === 'release'
        ? renderMarkdownByRelease(data.changelog.title, data.entries)
        : renderMarkdownFlat(data.changelog.title, data.entries);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="changelog-${data.changelog.id.slice(0, 8)}.md"`,
    );
    res.send(md);
  } catch (err) {
    console.error('GET /changelogs/:id/export.md error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to generate markdown export' });
  }
});

// ── JSON export ────────────────────────────────────────────────

interface JsonEntry {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string | null;
  publishedAt: string | null;
  releaseVersion: string | null;
}

interface JsonRelease {
  version: string;
  title: string | null;
  publishedAt: string | null;
  entries: JsonEntry[];
}

function toJsonEntry(e: EntryRow): JsonEntry {
  return {
    id: e.id,
    category: e.category,
    title: e.title,
    summary: e.summary,
    body: e.body,
    publishedAt: e.publishedAt?.toISOString() ?? null,
    releaseVersion: e.release?.version ?? null,
  };
}

function renderJsonFlat(
  changelog: { id: string; title: string; updatedAt: Date },
  entries: EntryRow[],
) {
  return {
    changelog: {
      id: changelog.id,
      title: changelog.title,
      updatedAt: changelog.updatedAt.toISOString(),
    },
    entries: entries.map(toJsonEntry),
  };
}

function renderJsonByRelease(
  changelog: { id: string; title: string; updatedAt: Date },
  entries: EntryRow[],
) {
  const releaseMap = new Map<string, JsonRelease>();
  const unreleased: JsonEntry[] = [];

  for (const e of entries) {
    if (e.release) {
      const key = e.release.version;
      if (!releaseMap.has(key)) {
        releaseMap.set(key, {
          version: e.release.version,
          title: e.release.title,
          publishedAt: e.release.publishedAt?.toISOString() ?? null,
          entries: [],
        });
      }
      releaseMap.get(key)!.entries.push(toJsonEntry(e));
    } else {
      unreleased.push(toJsonEntry(e));
    }
  }

  const releases = [...releaseMap.values()].sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });

  return {
    changelog: {
      id: changelog.id,
      title: changelog.title,
      updatedAt: changelog.updatedAt.toISOString(),
    },
    releases,
    ...(unreleased.length > 0 ? { unreleased } : {}),
  };
}

router.get('/:id/export.json', async (req, res) => {
  try {
    const format = (req.query.format as string | undefined) ?? 'flat';
    const data = await fetchPublishedData(req.params.id);
    if (!data) {
      res.status(404).json({ ok: false, error: 'Changelog not found' });
      return;
    }

    const json =
      format === 'release'
        ? renderJsonByRelease(data.changelog, data.entries)
        : renderJsonFlat(data.changelog, data.entries);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(json);
  } catch (err) {
    console.error('GET /changelogs/:id/export.json error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to generate JSON export' });
  }
});

export default router;

// Exported for testing
export {
  renderMarkdownFlat,
  renderMarkdownByRelease,
  renderJsonFlat,
  renderJsonByRelease,
  toJsonEntry,
};
export type { EntryRow, JsonEntry, JsonRelease };
