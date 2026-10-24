import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/agencies/invite-token";
import {
  MosaicoError,
  cambiarSinIdentificar,
  cerrarCurso,
  confirmarRetrato,
  generarEnlaceDelColegio,
  guardarIntegrantes,
  ponerRetratoDelFotografo,
  reabrirCurso,
  resumenDelCurso,
} from "@/lib/mosaico/curso";
import { accesoAlMosaico, respuestaDeError } from "../acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; courseKey: string }> };

async function leerParams(context: Ctx) {
  const p = await context.params;
  let courseKey = p.courseKey;
  try {
    courseKey = decodeURIComponent(p.courseKey);
  } catch {
    // ya venía decodificado
  }
  return { id: p.id, courseKey };
}

function idPositivo(v: unknown, campo: string): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new MosaicoError(`Falta ${campo}.`, 400);
  return n;
}

function listaDeIds(v: unknown): number[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v)) throw new MosaicoError("La lista de fotos no es válida.", 400);
  return v.map((x) => idPositivo(x, "la foto"));
}

/** GET /api/dashboard/albums/[id]/mosaico/[courseKey] — alumnos, docentes, sin identificar y estado. */
export async function GET(_req: Request, context: Ctx) {
  try {
    const { id, courseKey } = await leerParams(context);
    const acceso = await accesoAlMosaico(id);
    if (!acceso.ok) return acceso.res;
    const resumen = await resumenDelCurso(prisma, acceso.albumId, courseKey);
    return NextResponse.json({ resumen });
  } catch (e) {
    return respuestaDeError(e, "GET /api/dashboard/albums/[id]/mosaico/[courseKey]");
  }
}

/**
 * POST /api/dashboard/albums/[id]/mosaico/[courseKey] con `{ accion, ... }`:
 * retrato | confirmar | integrantes | sinIdentificar | enlace | cerrar | reabrir.
 */
export async function POST(req: Request, context: Ctx) {
  try {
    const { id, courseKey } = await leerParams(context);
    const acceso = await accesoAlMosaico(id);
    if (!acceso.ok) return acceso.res;
    const { albumId, userId } = acceso;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body.accion) {
      case "retrato": {
        const photoId = body.photoId == null ? null : idPositivo(body.photoId, "la foto");
        await ponerRetratoDelFotografo(prisma, {
          albumId,
          courseKey,
          rosterEntryId: idPositivo(body.rosterEntryId, "el alumno"),
          photoId,
        });
        return NextResponse.json({ ok: true });
      }
      case "confirmar":
        await confirmarRetrato(prisma, { albumId, courseKey, rosterEntryId: idPositivo(body.rosterEntryId, "el alumno") });
        return NextResponse.json({ ok: true });
      case "integrantes":
        if (!Array.isArray(body.integrantes)) throw new MosaicoError("Falta la lista de docentes.", 400);
        await guardarIntegrantes(prisma, { albumId, courseKey, integrantes: body.integrantes });
        return NextResponse.json({ ok: true });
      case "sinIdentificar":
        await cambiarSinIdentificar(prisma, {
          albumId,
          courseKey,
          agregar: listaDeIds(body.agregar),
          quitar: listaDeIds(body.quitar),
        });
        return NextResponse.json({ ok: true });
      case "enlace": {
        const { token, vence } = await generarEnlaceDelColegio(prisma, { albumId, courseKey });
        const url = `${appBaseUrl().replace(/\/+$/, "")}/escolar/mosaico/${token}`;
        return NextResponse.json({ url, vence });
      }
      case "cerrar":
        await cerrarCurso(prisma, { albumId, courseKey, userId });
        return NextResponse.json({ ok: true });
      case "reabrir":
        await reabrirCurso(prisma, { albumId, courseKey });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return respuestaDeError(e, "POST /api/dashboard/albums/[id]/mosaico/[courseKey]");
  }
}
