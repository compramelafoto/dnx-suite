import { NextResponse } from "next/server";
import { getAuthUser } from "../../../lib/auth";
import { getJudgeAuthUser } from "../../../lib/judge-auth";
import { prisma } from "@repo/db";
import { verifySignedAssetParams } from "../../../lib/fotorank/storage/private-local-storage";
import { getPrivateContestStorageProvider } from "../../../lib/fotorank/storage/provider";

/**
 * Sirve bytes privados con firma temporal.
 * El rol NO viene por query: se infiere de sesión (User vs Judge).
 * Jurado: solo JURY_PREVIEW (y THUMBNAIL como fallback visual si existiera en firma — bloqueado ORIGINAL).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("k") ?? "";
  const purpose = url.searchParams.get("p") ?? "read";
  const exp = Number(url.searchParams.get("e") ?? 0);
  const nonce = url.searchParams.get("n") ?? "";
  const sig = url.searchParams.get("s") ?? "";

  if (!key || key.includes("..") || !verifySignedAssetParams({ key, purpose, exp, nonce, sig })) {
    return NextResponse.json({ error: "URL inválida o expirada." }, { status: 403 });
  }

  const user = await getAuthUser();
  const judge = user ? null : await getJudgeAuthUser();
  if (!user && !judge) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const asset = await prisma.fotorankContestEntryAsset.findFirst({
    where: { storageKey: key },
    include: {
      entry: {
        select: {
          id: true,
          authorUserId: true,
          contestId: true,
          categoryId: true,
          status: true,
          withdrawnAt: true,
        },
      },
      contest: { select: { organizationId: true } },
    },
  });
  if (!asset || !asset.entry) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const kind = asset.kind;
  let allowed = false;

  if (user) {
    const isOwner = asset.entry.authorUserId === user.id;
    const member = await prisma.contestOrganizationMember.findFirst({
      where: {
        organizationId: asset.contest.organizationId,
        userId: user.id,
        status: "ACTIVE",
      },
      select: { role: true },
    });
    if (isOwner) {
      // Participante: preview/thumb; original solo lectura inline controlada (no descarga forzada pública).
      allowed = kind === "THUMBNAIL" || kind === "JURY_PREVIEW" || kind === "ORIGINAL" || kind === "NORMALIZED";
    } else if (member) {
      allowed = true; // org: preview + original con permiso de membresía activa
    }
  } else if (judge) {
    if (kind === "ORIGINAL") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (kind !== "JURY_PREVIEW" && kind !== "THUMBNAIL") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (asset.entry.status !== "CONFIRMED" || asset.entry.withdrawnAt) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const assignment = await prisma.fotorankJudgeAssignment.findFirst({
      where: {
        contestId: asset.entry.contestId,
        categoryId: asset.entry.categoryId,
        judgeAccountId: judge.id,
        assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED", "ASSIGNED"] },
      },
      select: { id: true },
    });
    const conflict = await prisma.fotorankJudgeEntryConflict.findFirst({
      where: {
        entryId: asset.entry.id,
        judgeAccountId: judge.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    allowed = Boolean(assignment) && !conflict;
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const storage = getPrivateContestStorageProvider();
  try {
    const bytes = storage.readObject
      ? await storage.readObject(key)
      : null;
    if (!bytes) {
      return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
    }
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }
}
