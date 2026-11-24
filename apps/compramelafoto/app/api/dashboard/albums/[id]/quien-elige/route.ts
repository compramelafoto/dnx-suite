import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, prisma } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { acotarDias, esModoEleccion } from "@/lib/schools/quien-elige-las-fotos";
import { cargarRegla } from "@/lib/schools/quien-elige-las-fotos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedAlbumId(params: Promise<{ id: string }>) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const albumId = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) {
    return { response: NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 }) };
  }
  const album = await findAlbumOwnedByUser(albumId, user.id);
  if (!album) return { response: NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 }) };
  return { albumId, userId: user.id };
}

/** GET: quién elige las fotos de la preventa de este álbum. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  return NextResponse.json(await cargarRegla(r.albumId));
}

/** PUT `{ mode, familyDays? }`: cambia la regla. Los packs ya canjeados no se tocan. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => null)) as { mode?: unknown; familyDays?: unknown } | null;
  if (!esModoEleccion(body?.mode)) {
    return NextResponse.json({ error: "Elegí quién elige las fotos." }, { status: 400 });
  }
  const mode = body.mode;
  const familyDays =
    mode === "FAMILY_THEN_PHOTOGRAPHER"
      ? acotarDias(typeof body.familyDays === "number" ? body.familyDays : Number(body.familyDays))
      : null;
  await prisma.schoolPhotoChooserSetting.upsert({
    where: { albumId: r.albumId },
    create: { albumId: r.albumId, mode, familyDays, updatedByUserId: r.userId },
    update: { mode, familyDays, updatedByUserId: r.userId },
  });
  return NextResponse.json({ ok: true, ...(await cargarRegla(r.albumId)) });
}
