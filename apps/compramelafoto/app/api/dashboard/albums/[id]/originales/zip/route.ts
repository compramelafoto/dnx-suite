/**
 * GET ?parte=N: ZIP en streaming con los originales de esa parte del álbum.
 * Solo el fotógrafo dueño del álbum (ver `lib/albums/originales/originales.ts`).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  armarPartes,
  idsDeLaParte,
  leerNumeroDeParte,
  nombreDeFotoEnZip,
  nombreDelZip,
  FOTOS_POR_PARTE,
} from "@/lib/albums/originales/originales";
import {
  cargarOriginalesDelAlbum,
  lectorDeOriginalesDelAlbum,
} from "@/lib/albums/originales/cargar-originales";
import { streamOriginalesZip } from "@/lib/albums/originales/stream-originales-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una parte son cientos de MB y el ritmo lo pone la conexión de quien baja: tope máximo.
export const maxDuration = 800;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const totalPartes = armarPartes(resultado.fotos.length).length;
  if (totalPartes === 0) {
    return NextResponse.json({ error: "El álbum no tiene fotos" }, { status: 404 });
  }
  const parte = leerNumeroDeParte(new URL(req.url).searchParams.get("parte"), totalPartes);
  if (parte == null) {
    return NextResponse.json({ error: `Parte inválida (1 a ${totalPartes})` }, { status: 400 });
  }

  const primera = (parte - 1) * FOTOS_POR_PARTE;
  const fotos = idsDeLaParte(resultado.fotos, parte).map((foto, i) => ({
    id: foto.id,
    nombre: nombreDeFotoEnZip(primera + i + 1, foto),
  }));

  return streamOriginalesZip(
    fotos,
    nombreDelZip(resultado.album.title, parte, totalPartes),
    lectorDeOriginalesDelAlbum(albumId),
  );
}
