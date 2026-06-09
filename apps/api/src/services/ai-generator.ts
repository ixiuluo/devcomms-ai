/**
 * AI Changelog Generation Service
 *
 * Converts commits and PR descriptions into user-facing changelog entries.
 * Uses the Anthropic API (Claude) for generation.
 *
 * Categories: added, changed, fixed, removed, deprecated, security
 */

// Category definitions for the AI prompt
const CATEGORY_DEFINITIONS = `
- **added**: New features, functionality, or capabilities
- **changed**: Modifications to existing behavior (not fixes)
- **fixed**: Bug fixes
- **removed**: Deprecated or removed features
- **deprecated**: Features marked for future removal
- **security**: Security-related fixes or improvements
`;

/**
 * Build a prompt for generating a changelog entry from a commit.
 */
export function buildChangelogPrompt(commits: Array<{
  message: string;
  prTitle?: string | null;
  prBody?: string | null;
}>): string {
  const commitList = commits
    .map(
      (c, i) =>
        `Commit ${i + 1}:\n  Message: ${c.message}\n  ${c.prTitle ? `PR Title: ${c.prTitle}\n  ` : ""}${c.prBody ? `PR Body: ${c.prBody}\n  ` : ""}`,
    )
    .join("\n\n");

  return `You are a developer advocate writing a user-facing changelog entry. Convert the following git commits into a clear, helpful changelog entry that end users (not developers) will understand.

## Commit Information

${commitList}

## Categories

${CATEGORY_DEFINITIONS}

## Instructions

1. Write a short, clear **title** (5-10 words max) describing what changed from the user's perspective
2. Write a **summary** (1-2 sentences) explaining the benefit to users
3. Optionally write a longer **body** in markdown with more detail (only if the changes warrant it)
4. Pick exactly one **category** from the list above
5. If the commits are purely internal (refactoring, CI changes, linting), set **skip** to true

Output as JSON:
{
  "title": "...",
  "summary": "...",
  "body": "...",
  "category": "added|changed|fixed|removed|deprecated|security",
  "skip": true|false
}`;
}

/**
 * Configuration for the AI generation service.
 * In MVP, this reads from environment variables.
 */
export interface AIGenerationConfig {
  apiKey: string;
  model: string;
}

export function getAIConfig(): AIGenerationConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.AI_MODEL || "claude-sonnet-4-6",
  };
}

/**
 * Generate a changelog entry using Claude.
 * Returns null if AI generation fails or is not configured.
 */
export async function generateChangelogEntry(
  commits: Array<{
    message: string;
    prTitle?: string | null;
    prBody?: string | null;
  }>,
): Promise<{
  title: string;
  summary: string;
  body: string | null;
  category: string;
  skip: boolean;
  aiModel: string;
} | null> {
  const config = getAIConfig();
  if (!config) {
    console.warn("AI generation skipped: ANTHROPIC_API_KEY not set");
    return null;
  }

  const prompt = buildChangelogPrompt(commits);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) return null;

    // Try to parse JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      summary: string;
      body?: string;
      category: string;
      skip: boolean;
    };

    return {
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body ?? null,
      category: parsed.category ?? "changed",
      skip: parsed.skip ?? false,
      aiModel: config.model,
    };
  } catch (err) {
    console.error("AI generation failed:", (err as Error).message);
    return null;
  }
}
