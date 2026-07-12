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

  const userSessionDelegate = (
    prisma as unknown as { userSession?: { create?: unknown } }
  ).userSession;
  const userSession =
    typeof userSessionDelegate?.create === "function" ? "ok" : "missing";

  const body = {
    status: db === "ok" && userSession === "ok" ? "ok" : "degraded",
    app: "infospot",
    db,
    userSession,
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
  };

  return NextResponse.json(body, {
    status: db === "ok" && userSession === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
