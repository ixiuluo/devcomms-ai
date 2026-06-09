"use client";

import { useState, useEffect } from "react";
import { APP_NAME, APP_VERSION } from "@dra/shared";

interface ChangelogSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  published: boolean;
  updatedAt: string;
  _count: { entries: number };
}

interface EntrySummary {
  id: string;
  title: string;
  category: string;
  approved: boolean;
  published: boolean;
  createdAt: string;
  commit: { sha: string; message: string } | null;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function DashboardPage() {
  const [changelogs, setChangelogs] = useState<ChangelogSummary[]>([]);
  const [selectedChangelog, setSelectedChangelog] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "published">("pending");

  // For MVP, assume a demo team exists
  const DEMO_TEAM_ID = "demo";

  useEffect(() => {
    fetchChangelogs();
  }, []);

  useEffect(() => {
    if (selectedChangelog) {
      fetchEntries(selectedChangelog);
    }
  }, [selectedChangelog, activeTab]);

  async function fetchChangelogs() {
    try {
      const res = await fetch(`${API_URL}/api/changelogs`);
      const json = (await res.json()) as ApiResponse<ChangelogSummary[]>;
      if (json.ok && json.data) {
        setChangelogs(json.data);
        if (json.data.length > 0 && !selectedChangelog) {
          setSelectedChangelog(json.data[0].id);
        }
      }
    } catch (err) {
      setError(`API not reachable at ${API_URL} — start the API with: npm run dev -w apps/api`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEntries(changelogId: string) {
    setLoading(true);
    try {
      const approved = activeTab === "pending" ? "false" : "true";
      const published = activeTab === "published" ? "true" : "false";
      const res = await fetch(
        `${API_URL}/api/entries?changelogId=${changelogId}&approved=${approved}&published=${published}`,
      );
      const json = (await res.json()) as ApiResponse<EntrySummary[]>;
      if (json.ok && json.data) {
        setEntries(json.data);
      }
    } catch {
      // API not running
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(entryId: string) {
    await fetch(`${API_URL}/api/entries/${entryId}/approve`, { method: "POST" });
    if (selectedChangelog) fetchEntries(selectedChangelog);
  }

  async function handleReject(entryId: string) {
    await fetch(`${API_URL}/api/entries/${entryId}/reject`, { method: "POST" });
    if (selectedChangelog) fetchEntries(selectedChangelog);
  }

  async function handlePublish() {
    if (!selectedChangelog) return;
    await fetch(`${API_URL}/api/changelogs/${selectedChangelog}/publish`, { method: "POST" });
    fetchEntries(selectedChangelog);
  }

  const categoryColors: Record<string, string> = {
    added: "bg-green-100 text-green-800",
    changed: "bg-blue-100 text-blue-800",
    fixed: "bg-yellow-100 text-yellow-800",
    removed: "bg-red-100 text-red-800",
    deprecated: "bg-orange-100 text-orange-800",
    security: "bg-purple-100 text-purple-800",
  };

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">API Not Connected</h2>
            <p className="text-yellow-700 font-mono text-sm">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">DevComms AI</h1>
              <span className="text-xs text-gray-400">
                {APP_NAME} v{APP_VERSION}
              </span>
            </div>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="text-gray-500 hover:text-gray-700">
                Home
              </a>
              <a href="/dashboard" className="text-blue-600 font-medium">
                Dashboard
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && changelogs.length === 0 ? (
          <div className="text-center py-20">
            <div className="animate-pulse text-gray-400">Loading dashboard...</div>
          </div>
        ) : changelogs.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No changelogs yet</h2>
            <p className="text-gray-500 mb-6">
              Connect a GitHub repository to get started with AI-generated changelogs.
            </p>
            <button
              className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
              onClick={() => alert("GitHub connection coming soon!")}
            >
              Connect GitHub Repository
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Changelogs
              </h2>
              <ul className="space-y-1">
                {changelogs.map((cl) => (
                  <li key={cl.id}>
                    <button
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedChangelog === cl.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      onClick={() => setSelectedChangelog(cl.id)}
                    >
                      <div className="truncate">{cl.title}</div>
                      <div className="text-xs text-gray-400">{cl._count.entries} entries</div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Main content */}
            <section className="lg:col-span-3">
              {/* Tabs */}
              <div className="flex gap-4 mb-6 border-b border-gray-200">
                {(["pending", "approved", "published"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
                <div className="ml-auto flex items-center">
                  {activeTab === "approved" && (
                    <button
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-green-700 transition-colors"
                      onClick={handlePublish}
                    >
                      Publish All Approved
                    </button>
                  )}
                </div>
              </div>

              {/* Entry list */}
              {entries.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  {activeTab === "pending"
                    ? "No entries pending approval. Push some commits to generate changelog entries!"
                    : activeTab === "approved"
                      ? "No approved entries yet. Review the pending queue."
                      : "Nothing published yet. Approve and publish entries to see them here."}
                </div>
              ) : (
                <ul className="space-y-3">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                                categoryColors[entry.category] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {entry.category}
                            </span>
                            {entry.commit && (
                              <span className="text-xs text-gray-400 font-mono">
                                {entry.commit.sha.slice(0, 7)}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-gray-900">{entry.title}</h3>
                          {entry.commit && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {entry.commit.message.split("\n")[0]}
                            </p>
                          )}
                        </div>
                        {activeTab === "pending" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              className="rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
                              onClick={() => handleApprove(entry.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                              onClick={() => handleReject(entry.id)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {activeTab === "published" && (
                          <span className="text-xs text-green-600 font-medium flex-shrink-0">
                            Published
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
