import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico seguro de DB (10B.1). No expone secretos ni connection strings.
 */
export async function GET() {
  const source = (process.env.CLICKATON_PUBLIC_DATA_SOURCE ?? "prisma").trim();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";
  let hostHint = "absent";
  try {
    if (databaseUrl) {
      hostHint = new URL(databaseUrl).hostname.split(".")[0] ?? "unknown";
    }
  } catch {
    hostHint = "unparseable";
  }

  try {
    const published = await prisma.clickatonEdition.count({
      where: { isPublished: true, status: { not: "CANCELLED" } },
    });
    return NextResponse.json({
      ok: true,
      source,
      databaseHostHint: hostHint,
      hasDirectUrl: Boolean(directUrl),
      publishedEditions: published,
    });
  } catch (error) {
    const err = error as {
      name?: string;
      code?: string;
      message?: string;
      meta?: unknown;
    };
    return NextResponse.json(
      {
        ok: false,
        source,
        databaseHostHint: hostHint,
        hasDirectUrl: Boolean(directUrl),
        errorName: err?.name ?? "Error",
        errorCode: err?.code ?? null,
        errorMessage: String(err?.message ?? error).slice(0, 500),
        errorMeta: err?.meta ?? null,
      },
      { status: 500 },
    );
  }
}
