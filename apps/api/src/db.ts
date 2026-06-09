import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Singleton Prisma client instance.
 *
 * Uses SQLite via @prisma/adapter-libsql — zero external dependencies.
 * For production on Fly.io, mount a persistent volume at /data and set:
 *   DATABASE_URL=file:/data/prod.db
 *
 * PostgreSQL migration (post-MVP): switch schema provider, regenerate
 * client, and update this file to use Prisma's built-in PG adapter.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

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
