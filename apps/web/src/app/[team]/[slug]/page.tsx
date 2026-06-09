"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ChangelogEntry {
  id: string;
  title: string;
  summary: string;
  body: string | null;
  category: string;
  publishedAt: string;
}

interface Release {
  id: string;
  version: string;
  title: string | null;
  summary: string | null;
  publishedAt: string;
  entries: ChangelogEntry[];
}

interface ChangelogData {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  entries: ChangelogEntry[];
  releases: Release[];
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const categoryIcons: Record<string, string> = {
  added: "✨",
  changed: "🔧",
  fixed: "🐛",
  removed: "🗑️",
  deprecated: "⚠️",
  security: "🔒",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function PublicChangelogPage() {
  const params = useParams<{ team: string; slug: string }>();
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subEmail, setSubEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "subscribing" | "success" | "error">("idle");
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the changelog — for MVP, we fetch by the team+slug from the URL
    // In production this would match against the database
    async function fetchChangelog() {
      try {
        // First find the team
        const teamRes = await fetch(`${API_URL}/api/teams/${params.team}`);
        const teamJson = (await teamRes.json()) as ApiResponse<{ id: string }> & {
          changelogs?: { id: string; slug: string }[];
        };

        if (!teamJson.ok || !teamJson.data) {
          setError("Team not found");
          setLoading(false);
          return;
        }

        setTeamId(teamJson.data.id);

        // Find the changelog with matching slug
        const changelogsRes = await fetch(
          `${API_URL}/api/changelogs?teamId=${teamJson.data.id}`,
        );
        const changelogsJson = (await changelogsRes.json()) as ApiResponse<ChangelogData[]>;

        if (!changelogsJson.ok || !changelogsJson.data) {
          setError("No changelogs found");
          setLoading(false);
          return;
        }

        const match = changelogsJson.data.find((cl) => cl.id === params.slug || cl.id === params.slug);
        if (!match) {
          // Try finding by fetching directly
          const directRes = await fetch(`${API_URL}/api/changelogs/${params.slug}`);
          const directJson = (await directRes.json()) as ApiResponse<ChangelogData>;
          if (directJson.ok && directJson.data) {
            setChangelog(directJson.data);
            // Track page view for directly fetched changelog
            trackPageView(directJson.data.id);
          } else {
            setError("Changelog not found");
          }
        } else {
          // Fetch full changelog with entries
          const fullRes = await fetch(`${API_URL}/api/changelogs/${match.id}`);
          const fullJson = (await fullRes.json()) as ApiResponse<ChangelogData>;
          if (fullJson.ok && fullJson.data) {
            setChangelog(fullJson.data);
          } else {
            setChangelog(match);
          }
          // Track page view
          trackPageView(match.id);
        }
      } catch {
        setError("Unable to load changelog. The API server may not be running.");
      } finally {
        setLoading(false);
      }
    }

    void fetchChangelog();
  }, [params.team, params.slug]);

  // Track page view (fire-and-forget, no PII)
  function trackPageView(changelogId: string) {
    fetch(`${API_URL}/api/analytics/changelogs/${changelogId}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/${params.team}/${params.slug}`,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {
      // Silently ignore tracking failures — don't disrupt the user
    });
  }

  async function handleSubscribe(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!teamId || !subEmail) return;
    setSubState("subscribing");
    setSubError(null);

    try {
      const res = await fetch(`${API_URL}/api/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, email: subEmail }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (json.ok) {
        setSubState("success");
      } else {
        setSubError(json.error ?? "Failed to subscribe");
        setSubState("error");
      }
    } catch {
      setSubError("Unable to reach the server. Please try again later.");
      setSubState("error");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading changelog...</div>
      </main>
    );
  }

  if (error || !changelog) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Changelog Not Found</h1>
          <p className="text-gray-500">{error ?? "This changelog does not exist or is not yet published."}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm">
            ← Back to home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900">{changelog.title}</h1>
          {changelog.description && (
            <p className="mt-2 text-gray-500">{changelog.description}</p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Releases (grouped entries) */}
        {changelog.releases.length > 0 && (
          <div className="space-y-12 mb-12">
            {changelog.releases.map((release) => (
              <section key={release.id}>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {release.title ?? `Release ${release.version}`}
                  </h2>
                  {release.summary && (
                    <p className="mt-1 text-gray-500">{release.summary}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(release.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <EntryList entries={release.entries} />
              </section>
            ))}
          </div>
        )}

        {/* Ungrouped entries */}
        {changelog.entries.length > 0 && changelog.releases.length === 0 && (
          <EntryList entries={changelog.entries} />
        )}

        {changelog.entries.length === 0 && changelog.releases.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No changelog entries published yet. Check back soon!
          </div>
        )}

        {/* Subscribe form */}
        <div className="mt-16 border-t border-gray-200 pt-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Stay updated</h3>
            <p className="text-sm text-gray-500 mb-4">
              Get notified when new changelog entries are published.
            </p>
            {subState === "success" ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-800">✓ Subscribed!</p>
                <p className="text-sm text-green-600 mt-1">
                  You&apos;ll receive email notifications when new entries are published.
                </p>
              </div>
            ) : (
              <form className="flex gap-2" onSubmit={(e) => { void handleSubscribe(e); }}>
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => { setSubEmail(e.target.value); }}
                  placeholder="you@company.com"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={subState === "subscribing"}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {subState === "subscribing" ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
            )}
            {subState === "error" && subError && (
              <p className="mt-3 text-sm text-red-600">{subError}</p>
            )}
          </div>

          {/* "Powered by" footer */}
          <p className="mt-6 text-center text-xs text-gray-400">
            Powered by{" "}
            <a href="/" className="text-gray-500 hover:text-gray-700 underline">
              DevComms AI
            </a>{" "}
            — Automated changelogs from your git history
          </p>
        </div>
      </div>
    </main>
  );
}

function EntryList({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <ul className="space-y-4">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">
              {categoryIcons[entry.category] ?? "📝"}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">{entry.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{entry.summary}</p>
              {entry.body && (
                <details className="mt-2">
                  <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                    More details
                  </summary>
                  <div
                    className="mt-2 text-sm text-gray-700 prose prose-sm max-w-none"
                    // In production, sanitize markdown
                  >
                    {entry.body}
                  </div>
                </details>
              )}
              {entry.publishedAt && (
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(entry.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
