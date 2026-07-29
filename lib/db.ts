import { PrismaClient } from "./generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — cannot connect to the database.")
}

// Neon's HTTP/WebSocket driver instead of Prisma's native query-engine
// binary — Vercel's serverless runtime kept failing to locate the
// rhel-openssl-3.0.x binary regardless of build tracing config, and this
// is Prisma's own recommended pattern for Vercel + Neon specifically.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
