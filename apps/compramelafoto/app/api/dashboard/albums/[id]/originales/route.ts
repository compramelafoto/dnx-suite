/**
 * GET: partes en las que se baja el álbum completo en originales.
 * Solo el fotógrafo dueño del álbum (ver `lib/albums/originales/originales.ts`).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { armarPartes, FOTOS_POR_PARTE } from "@/lib/albums/originales/originales";
import { cargarOriginalesDelAlbum } from "@/lib/albums/originales/cargar-originales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) {
    return NextResponse.json({ error: "Álbum inválido" }, { status: 400 });
  }

  const resultado = await cargarOriginalesDelAlbum(albumId, user.id);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json({
    totalFotos: resultado.fotos.length,
    fotosPorParte: FOTOS_POR_PARTE,
    partes: armarPartes(resultado.fotos.length),
  });
}
