-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "github_id" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "github_repos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "webhook_id" INTEGER,
    "webhook_secret" TEXT,
    "connected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "github_repos_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repo_id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author_name" TEXT,
    "author_email" TEXT,
    "committed_at" DATETIME NOT NULL,
    "pr_number" INTEGER,
    "pr_title" TEXT,
    "pr_body" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commits_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "github_repos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "changelogs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "repo_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "changelogs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "changelogs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "github_repos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changelog_id" TEXT NOT NULL,
    "commit_id" TEXT,
    "release_id" TEXT,
    "category" TEXT NOT NULL DEFAULT 'changed',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "ai_model" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "entries_changelog_id_fkey" FOREIGN KEY ("changelog_id") REFERENCES "changelogs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "entries_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "commits" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "entries_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changelog_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "releases_changelog_id_fkey" FOREIGN KEY ("changelog_id") REFERENCES "changelogs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" DATETIME,
    CONSTRAINT "subscribers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "channel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "slack_integrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME,
    CONSTRAINT "api_keys_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changelog_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_repos_full_name_key" ON "github_repos"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "commits_repo_id_sha_key" ON "commits"("repo_id", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "changelogs_team_id_slug_key" ON "changelogs"("team_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "releases_changelog_id_version_key" ON "releases"("changelog_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_token_key" ON "subscribers"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_team_id_email_key" ON "subscribers"("team_id", "email");
