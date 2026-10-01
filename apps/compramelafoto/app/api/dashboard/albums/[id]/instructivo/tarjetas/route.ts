// app/api/dashboard/albums/[id]/instructivo/tarjetas/route.ts — Hoja A4 de tarjetas.
//
// Material de trabajo del fotógrafo: sólo lo puede pedir el dueño del álbum.
import { NextResponse } from "next/server";

import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { loadAlbumInstructivo } from "@/lib/instructivos/load-album-instructivo";
import { buildQrPng } from "@/lib/instructivos/instructivo-qr";
import { buildTarjetasPdf } from "@/lib/instructivos/tarjetas-pdf";

export const runtime = "nodejs";

async function bajarLogo(logoUrl: string | null): Promise<Uint8Array | null> {
  if (!logoUrl) return null;
  try {
    const r = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id?: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const albumId = Number.parseInt(String(id || ""), 10);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "Álbum inválido" }, { status: 400 });
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, publicSlug: true, deletedAt: true },
  });
  if (!album || album.deletedAt) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (album.userId !== user.id) {
    return NextResponse.json({ error: "Este álbum no es tuyo" }, { status: 403 });
  }

  const profile = await loadAlbumInstructivo(album.publicSlug);
  if (!profile) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const [qr, logo] = await Promise.all([
    buildQrPng(profile.album.url, 600),
    bajarLogo(profile.fotografo.logoUrl),
  ]);
  const pdf = await buildTarjetasPdf(profile, qr, logo);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tarjetas-${profile.album.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
