import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME baseline: tells Prisma that the existing database already matches
 * the 0_init migration, so `migrate deploy` won't try to recreate tables that
 * are already there.
 *
 * This is the browser equivalent of `prisma migrate resolve --applied 0_init`,
 * which normally needs CLI access.
 *
 * DELETE THIS ROUTE once it has run successfully.
 */
export async function GET(request: Request) {
  const secret = process.env.BASELINE_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MIGRATION = "0_init";

  // Prisma's bookkeeping table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"              VARCHAR(64) NOT NULL,
      "finished_at"           TIMESTAMPTZ,
      "migration_name"        VARCHAR(255) NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        TIMESTAMPTZ,
      "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    )
  `);

  const existing = await db.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1`,
    MIGRATION
  );
  if (existing.length > 0) {
    return NextResponse.json({
      ok: true,
      alreadyBaselined: true,
      note: "Nothing to do — you can delete this route.",
    });
  }

  // Checksum must match the migration file byte-for-byte, or migrate deploy
  // will report the migration as modified and refuse to run.
  const file = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    MIGRATION,
    "migration.sql"
  );
  let checksum: string;
  try {
    const sql = await readFile(file);
    checksum = createHash("sha256").update(sql).digest("hex");
  } catch {
    return NextResponse.json(
      { error: `Could not read ${file}. Is the migration committed?` },
      { status: 500 }
    );
  }

  await db.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       ("id","checksum","finished_at","migration_name","started_at","applied_steps_count")
     VALUES ($1,$2,now(),$3,now(),1)`,
    crypto.randomUUID(),
    checksum,
    MIGRATION
  );

  return NextResponse.json({
    ok: true,
    baselined: MIGRATION,
    checksum,
    next: "Change the build script to 'prisma migrate deploy && next build', redeploy, then DELETE this route.",
  });
}
