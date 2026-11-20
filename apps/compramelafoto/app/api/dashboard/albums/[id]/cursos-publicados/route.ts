import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  avisarCursosPendientes,
  cursosDelAlbum,
  marcarCursosSubidos,
} from "@/lib/preventa-canjeable/cursos-publicados";
import { parseCursoIds } from "@/lib/preventa-canjeable/cursos-publicados-reglas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function albumPropio(params: Promise<{ id: string }>) {
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

/** GET: los cursos de la escuela del álbum, con sus familias de preventa y si ya se les avisó. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await albumPropio(params);
  if ("response" in r) return r.response;
  return NextResponse.json(await cursosDelAlbum(r.albumId));
}

/**
 * POST `{ cursoIds: number[] }`: marca esos cursos como subidos. El aviso a sus familias sale
 * solo cuando el álbum terminó de procesarse; si ya está listo, sale ahora.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await albumPropio(params);
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => null)) as { cursoIds?: unknown } | null;
  const cursoIds = parseCursoIds(body?.cursoIds);
  if (cursoIds.length === 0) {
    return NextResponse.json({ error: "Elegí al menos un curso." }, { status: 400 });
  }
  const marcados = await marcarCursosSubidos({ albumId: r.albumId, cursoIds, userId: r.userId });
  if (marcados.length === 0) {
    return NextResponse.json({ error: "Esos cursos no son de la escuela de este álbum." }, { status: 400 });
  }
  const baseUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/+$/, "");
  const aviso = await avisarCursosPendientes({ baseUrl, albumIds: [r.albumId] });
  const hecho = aviso.avisados.find((a) => a.albumId === r.albumId) ?? null;
  return NextResponse.json({
    marcados: marcados.length,
    enviados: hecho?.enviados ?? 0,
    sinEmail: hecho?.sinEmail ?? 0,
    /** El álbum sigue procesando fotos: el aviso sale solo apenas termine. */
    esperando: aviso.esperando.includes(r.albumId),
    cursos: await cursosDelAlbum(r.albumId),
  });
}
