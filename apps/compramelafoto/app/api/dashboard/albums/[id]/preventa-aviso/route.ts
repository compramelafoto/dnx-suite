import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  getPreventaPhotosReadyStatus,
  notifyPreventaPhotosReady,
} from "@/lib/preventa-canjeable/notify-preventa-photos-ready";

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
  return { albumId };
}

/** GET: cuántas familias de la preventa faltan canjear y cuándo se les avisó por última vez. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  return NextResponse.json(await getPreventaPhotosReadyStatus(r.albumId));
}

/** POST: manda el aviso "ya están las fotos" a las familias que todavía no canjearon. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await ownedAlbumId(params);
  if ("response" in r) return r.response;
  const baseUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/+$/, "");
  const result = await notifyPreventaPhotosReady({ albumId: r.albumId, baseUrl });
  return NextResponse.json(result);
}
