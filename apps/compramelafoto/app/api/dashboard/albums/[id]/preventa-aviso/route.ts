import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  getPreventaPhotosReadyStatus,
  notifyPreventaPhotosReady,
  parseAvisoOrderIds,
} from "@/lib/preventa-canjeable/notify-preventa-photos-ready";
import { cursosDeLosPacks, marcarCursosSubidos } from "@/lib/preventa-canjeable/cursos-publicados";
import { familiaPuedeElegir } from "@/lib/schools/quien-elige-las-fotos";
import { cargarRegla } from "@/lib/schools/quien-elige-las-fotos-server";

const MOTIVO_ELIGE_EL_FOTOGRAFO =
  "En esta preventa elegís vos las fotos: las familias no reciben el aviso para elegir. Las encontrás en Pedidos escolares → Por canjear → Te toca elegir.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

/** GET: cuántas familias de la preventa faltan canjear y cuándo se les avisó por última vez. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  return NextResponse.json(await getPreventaPhotosReadyStatus(r.albumId));
}

/**
 * POST: manda el aviso "ya están las fotos" a las familias que todavía no canjearon. Body
 * opcional `{ orderIds: number[] }`: sólo a esos packs (p. ej. los de un curso).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  if (!familiaPuedeElegir(await cargarRegla(r.albumId))) {
    return NextResponse.json({ error: MOTIVO_ELIGE_EL_FOTOGRAFO }, { status: 409 });
  }
  const body = (await req.json().catch(() => null)) as { orderIds?: unknown } | null;
  const orderIds = parseAvisoOrderIds(body?.orderIds);
  const baseUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/+$/, "");
  const result = await notifyPreventaPhotosReady({ albumId: r.albumId, baseUrl, orderIds });
  // Aviso a una lista (Pedidos con filtro de curso): esos cursos quedan como avisados, así el
  // aviso automático no los repite y los anotados saben qué cursos ya están.
  if (orderIds && orderIds.length > 0 && result.enviados + result.sinEmail > 0) {
    const cursoIds = await cursosDeLosPacks(r.albumId, orderIds);
    await marcarCursosSubidos({ albumId: r.albumId, cursoIds, userId: r.userId, yaAvisado: true });
  }
  return NextResponse.json(result);
}
