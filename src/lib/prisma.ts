import { PrismaClient } from "@/generated/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "prisma/dev.db";
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

const adapter = new PrismaLibSql({
  url: `file:${absoluteDbPath}`,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
