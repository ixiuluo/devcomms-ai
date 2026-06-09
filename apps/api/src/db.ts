import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Singleton Prisma client instance.
 *
 * Adapter selection (based on DATABASE_URL scheme):
 * - file:...          → @prisma/adapter-libsql (SQLite, zero-dependency)
 * - postgresql://...  → Prisma's built-in PostgreSQL adapter
 *
 * For Fly.io production:
 * - MVP: mount a persistent volume, use file:/data/prod.db
 * - Scale: provision Fly Postgres, set DATABASE_URL=postgresql://...
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (isPostgresUrl(dbUrl)) {
    // PostgreSQL — Prisma reads DATABASE_URL from env automatically
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["warn", "error"]
          : ["error"],
    });
  }

  // SQLite via libsql adapter
  const adapter = new PrismaLibSql({ url: dbUrl });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
