import { describe, it, expect } from "vitest";
import {
  renderMarkdownFlat,
  renderMarkdownByRelease,
  renderJsonFlat,
  renderJsonByRelease,
  type EntryRow,
} from "./routes/exports.js";

// ── Test data builders ─────────────────────────────────────────

function makeEntry(overrides: Partial<EntryRow> = {}): EntryRow {
  return {
    id: "entry-1",
    category: "added",
    title: "New feature",
    summary: "A great new feature",
    body: null,
    publishedAt: new Date("2026-06-09T10:00:00Z"),
    releaseId: null,
    release: null,
    ...overrides,
  };
}

// ── Markdown flat format ──────────────────────────────────────

describe("renderMarkdownFlat", () => {
  it("renders changelog title as H1", () => {
    const result = renderMarkdownFlat("My Changelog", []);
    expect(result).toContain("# My Changelog");
  });

  it("renders entries grouped by category", () => {
    const entries: EntryRow[] = [
      makeEntry({ id: "1", category: "added", title: "Feature A", summary: "Desc A" }),
      makeEntry({ id: "2", category: "fixed", title: "Bug fix B", summary: "Desc B" }),
    ];

    const result = renderMarkdownFlat("Test", entries);

    expect(result).toContain("### Added");
    expect(result).toContain("- Feature A");
    expect(result).toContain("  Desc A");
    expect(result).toContain("### Fixed");
    expect(result).toContain("- Bug fix B");
    expect(result).toContain("  Desc B");
  });

  it("includes published date in flat format", () => {
    const entries: EntryRow[] = [
      makeEntry({
        id: "1",
        category: "added",
        title: "Feature A",
        publishedAt: new Date("2026-06-09T10:00:00Z"),
      }),
    ];

    const result = renderMarkdownFlat("Test", entries);
    expect(result).toContain("- Feature A (2026-06-09)");
  });

  it("preserves category insertion order", () => {
    const entries: EntryRow[] = [
      makeEntry({ id: "2", category: "fixed", title: "Bug fix" }),
      makeEntry({ id: "1", category: "added", title: "Feature" }),
    ];

    const result = renderMarkdownFlat("Test", entries);
    const fixedIdx = result.indexOf("### Fixed");
    const addedIdx = result.indexOf("### Added");
    expect(fixedIdx).toBeLessThan(addedIdx);
  });

  it("handles empty entries list", () => {
    const result = renderMarkdownFlat("Empty Changelog", []);
    expect(result).toBe("# Empty Changelog\n");
  });
});

// ── Markdown by-release format ────────────────────────────────

describe("renderMarkdownByRelease", () => {
  it("renders releases as H2 with version and date", () => {
    const entries: EntryRow[] = [
      makeEntry({
        id: "1",
        category: "added",
        title: "Feature A",
        release: {
          version: "1.2.0",
          title: "Beta Release",
          publishedAt: new Date("2026-06-09T10:00:00Z"),
        },
      }),
    ];

    const result = renderMarkdownByRelease("Test", entries);
    expect(result).toContain("## 1.2.0 — Beta Release (2026-06-09)");
  });

  it("renders release without title correctly", () => {
    const entries: EntryRow[] = [
      makeEntry({
        id: "1",
        category: "added",
        title: "Feature A",
        release: {
          version: "1.0.0",
          title: null,
          publishedAt: new Date("2026-06-01T10:00:00Z"),
        },
      }),
    ];

    const result = renderMarkdownByRelease("Test", entries);
    expect(result).toContain("## 1.0.0 (2026-06-01)");
  });

  it("groups unreleased entries under 'Unreleased'", () => {
    const entries: EntryRow[] = [
      makeEntry({
        id: "1",
        category: "added",
        title: "Feature A",
        release: null,
      }),
    ];

    const result = renderMarkdownByRelease("Test", entries);
    expect(result).toContain("## Unreleased");
    expect(result).toContain("### Added");
    expect(result).toContain("- Feature A");
  });

  it("sorts releases by publishedAt descending", () => {
    const entries: EntryRow[] = [
      makeEntry({
        id: "1",
        category: "added",
        title: "Older",
        release: {
          version: "1.0.0",
          title: null,
          publishedAt: new Date("2026-01-01T10:00:00Z"),
        },
      }),
      makeEntry({
        id: "2",
        category: "fixed",
        title: "Newer",
        release: {
          version: "2.0.0",
          title: null,
          publishedAt: new Date("2026-06-01T10:00:00Z"),
        },
      }),
    ];

    const result = renderMarkdownByRelease("Test", entries);
    const v2Idx = result.indexOf("## 2.0.0");
    const v1Idx = result.indexOf("## 1.0.0");
    expect(v2Idx).toBeLessThan(v1Idx);
  });
});

// ── JSON flat format ──────────────────────────────────────────

describe("renderJsonFlat", () => {
  it("returns changelog metadata and entries array", () => {
    const changelog = {
      id: "cl-123",
      title: "My Changelog",
      updatedAt: new Date("2026-06-09T12:00:00Z"),
    };
    const entries: EntryRow[] = [
      makeEntry({
        id: "e-1",
        category: "added",
        title: "Feature A",
        publishedAt: new Date("2026-06-09T10:00:00Z"),
      }),
    ];

    const result = renderJsonFlat(changelog, entries);

    expect(result.changelog.id).toBe("cl-123");
    expect(result.changelog.title).toBe("My Changelog");
    expect(result.changelog.updatedAt).toBe("2026-06-09T12:00:00.000Z");
    expect(result.entries).toHaveLength(1);
    const e0 = result.entries[0]!;
    expect(e0.id).toBe("e-1");
    expect(e0.category).toBe("added");
    expect(e0.title).toBe("Feature A");
    expect(e0.summary).toBe("A great new feature");
    expect(e0.publishedAt).toBe("2026-06-09T10:00:00.000Z");
  });

  it("handles empty entries", () => {
    const changelog = { id: "cl-1", title: "Test", updatedAt: new Date() };
    const result = renderJsonFlat(changelog, []);

    expect(result.entries).toEqual([]);
  });
});

// ── JSON by-release format ────────────────────────────────────

describe("renderJsonByRelease", () => {
  it("groups entries under releases", () => {
    const changelog = {
      id: "cl-1",
      title: "Test",
      updatedAt: new Date("2026-06-09T12:00:00Z"),
    };
    const entries: EntryRow[] = [
      makeEntry({
        id: "e-1",
        category: "added",
        title: "Feature A",
        release: {
          version: "1.0.0",
          title: "First",
          publishedAt: new Date("2026-06-01T10:00:00Z"),
        },
      }),
    ];

    const result = renderJsonByRelease(changelog, entries);

    expect(result.releases).toHaveLength(1);
    const r0 = result.releases[0]!;
    expect(r0.version).toBe("1.0.0");
    expect(r0.title).toBe("First");
    expect(r0.entries).toHaveLength(1);
    expect(r0.entries[0]!.title).toBe("Feature A");
  });

  it("includes unreleased entries when present", () => {
    const changelog = { id: "cl-1", title: "Test", updatedAt: new Date() };
    const entries: EntryRow[] = [
      makeEntry({
        id: "e-1",
        category: "added",
        title: "Unreleased feature",
        release: null,
      }),
    ];

    const result = renderJsonByRelease(changelog, entries);

    expect(result.releases).toHaveLength(0);
    expect(result.unreleased).toHaveLength(1);
    expect(result.unreleased![0]!.title).toBe("Unreleased feature");
  });

  it("omits unreleased key when all entries have releases", () => {
    const changelog = { id: "cl-1", title: "Test", updatedAt: new Date() };
    const entries: EntryRow[] = [
      makeEntry({
        id: "e-1",
        release: {
          version: "1.0.0",
          title: null,
          publishedAt: new Date("2026-06-01T10:00:00Z"),
        },
      }),
    ];

    const result = renderJsonByRelease(changelog, entries);
    expect(result).not.toHaveProperty("unreleased");
  });

  it("includes releaseVersion in entry data", () => {
    const changelog = { id: "cl-1", title: "Test", updatedAt: new Date() };
    const entries: EntryRow[] = [
      makeEntry({
        id: "e-1",
        release: {
          version: "1.2.3",
          title: null,
          publishedAt: new Date("2026-06-01T10:00:00Z"),
        },
      }),
    ];

    const result = renderJsonByRelease(changelog, entries);
    expect(result.releases[0]!.entries[0]!.releaseVersion).toBe("1.2.3");
  });
});
