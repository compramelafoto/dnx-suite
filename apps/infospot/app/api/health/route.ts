import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Healthcheck seguro — no expone secretos ni detalles de error internos.
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const body = {
    status: db === "ok" ? "ok" : "degraded",
    app: "infospot",
    db,
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
  };

  return NextResponse.json(body, {
    status: db === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
