/**
 * Internal: Clickatón orquesta upload; FotoRank persiste asset canónico.
 * Auth: Bearer FOTORANK_INTERNAL_ASSET_SECRET (mismo valor en Clickatón).
 */
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { persistCanonicalEntryOriginal } from "../../../../lib/fotorank/entries/persist-canonical-asset";
import { EntryError } from "../../../../lib/fotorank/entries/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

function assertInternalAuth(req: Request): boolean {
  const secret = process.env.FOTORANK_INTERNAL_ASSET_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-fotorank-internal-secret")?.trim() ?? "";
  return bearer === secret || alt === secret;
}

export async function POST(req: Request) {
  if (!assertInternalAuth(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    contestId?: string;
    entryId?: string;
    fileBase64?: string;
    originalFileName?: string;
    declaredMime?: string;
    isReplace?: boolean;
    legacyStorageKey?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const contestId = body.contestId?.trim();
  const entryId = body.entryId?.trim();
  const fileBase64 = body.fileBase64;
  const originalFileName = body.originalFileName?.trim() || "upload.jpg";
  const declaredMime = body.declaredMime?.trim() || "image/jpeg";

  if (!contestId || !entryId || !fileBase64) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }
  // No aceptar claves/storage arbitrarios del cliente.
  if (body.legacyStorageKey && typeof body.legacyStorageKey === "string") {
    const legacy = body.legacyStorageKey;
    if (legacy.includes("..") || legacy.includes("@") || legacy.startsWith("http")) {
      return NextResponse.json({ ok: false, error: "LEGACY_KEY_REJECTED" }, { status: 400 });
    }
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileBase64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BASE64" }, { status: 400 });
  }
  if (buffer.byteLength < 32 || buffer.byteLength > 40 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "INVALID_SIZE" }, { status: 413 });
  }

  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      contestId: true,
      sourcePlatform: true,
      externalEditionId: true,
      externalRegistrationId: true,
      externalPromptId: true,
    },
  });
  if (!entry) {
    return NextResponse.json({ ok: false, error: "ENTRY_NOT_FOUND" }, { status: 404 });
  }
  if (entry.contestId !== contestId) {
    return NextResponse.json({ ok: false, error: "CROSS_CONTEST_DENIED" }, { status: 403 });
  }
  if (entry.sourcePlatform !== "CLICKATON") {
    return NextResponse.json({ ok: false, error: "SOURCE_PLATFORM_DENIED" }, { status: 403 });
  }
  if (!entry.externalRegistrationId || !entry.externalPromptId) {
    return NextResponse.json({ ok: false, error: "EXTERNAL_REFS_REQUIRED" }, { status: 400 });
  }

  try {
    const result = await persistCanonicalEntryOriginal({
      contestId,
      entryId,
      buffer,
      originalFileName,
      declaredMime,
      isReplace: Boolean(body.isReplace),
      sourcePlatform: "CLICKATON",
      legacyStorageKey: body.legacyStorageKey ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[canonical-entry-asset]", message);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 500 });
  }
}
