import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Singleton Prisma client instance.
 * Uses SQLite via libsql adapter for local development.
 * In production, switch to PostgreSQL adapter.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  const adapter = new PrismaLibSql({
    url: dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`,
  });

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
