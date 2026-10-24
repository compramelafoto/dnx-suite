import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/hidden-album-audit";
import { normalizePreviewUrl, readFromR2, urlToR2Key } from "@/lib/r2-client";
import { cursoDelEnlace, fotoVisibleParaElColegio } from "@/lib/mosaico/curso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La foto de un retrato para el enlace del colegio. Sólo las fotos del curso (sin identificar,
 * maestra/directivos o retratos ya puestos). Sirve la vista con marca de agua; si no hay, la
 * vista achicada a 800 px. No depende de que el bucket sea público.
 */

const ANCHO = 800;

function noEncontrada(status = 404) {
  return new NextResponse("No encontrada", { status, headers: { "Cache-Control": "no-store" } });
}

async function leerPrimera(keys: Array<string | null>): Promise<Buffer | null> {
  for (const k of keys) {
    if (!k) continue;
    try {
      return await readFromR2(k);
    } catch {
      // probar la siguiente
    }
  }
  return null;
}

function keyDe(urlOKey: string | null): string | null {
  if (!urlOKey) return null;
  try {
    return urlToR2Key(urlOKey) || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string; photoId: string }> }) {
  const p = await ctx.params;
  const token = decodeURIComponent(String(p.token || "")).trim().slice(0, 200);
  const photoId = Number(p.photoId);
  if (!token || !Number.isInteger(photoId) || photoId <= 0) return noEncontrada();

  const ip = getClientIp(req);
  if (!checkRateLimit({ key: `mosaico-colegio:foto:ip:${ip}`, limit: 600, windowMs: 60_000 }).allowed) {
    return noEncontrada(429);
  }

  try {
    if (!(await fotoVisibleParaElColegio(prisma, token, photoId))) return noEncontrada();
    const e = await cursoDelEnlace(prisma, token);
    if (!e) return noEncontrada();
    const foto = await prisma.photo.findFirst({
      where: { id: photoId, albumId: e.albumId, isRemoved: false },
      select: { previewWatermarkedKey: true, previewUrl: true, originalKey: true },
    });
    if (!foto) return noEncontrada();

    if (foto.previewWatermarkedKey) {
      const conMarca = await leerPrimera([keyDe(foto.previewWatermarkedKey)]);
      if (conMarca) {
        const img = await sharp(conMarca).rotate().resize({ width: ANCHO, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        return responder(img);
      }
    }

    const base = await leerPrimera([keyDe(normalizePreviewUrl(foto.previewUrl, foto.originalKey)), foto.originalKey]);
    if (!base) return noEncontrada();
    // Sin vista con marca de agua generada, nunca la foto limpia: se le pone una marca encima.
    const chica = await sharp(base).rotate().resize({ width: ANCHO, height: ANCHO, fit: "inside", withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = chica.info;
    const marca = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="rotate(-30 ${w / 2} ${h / 2})" fill="#ffffff" fill-opacity="0.45" stroke="#000000" stroke-opacity="0.25" stroke-width="1" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${Math.round(w / 9)}" text-anchor="middle"><text x="${w / 2}" y="${h / 2 - w / 6}">MUESTRA</text><text x="${w / 2}" y="${h / 2 + w / 12}">MUESTRA</text><text x="${w / 2}" y="${h / 2 + w / 3}">MUESTRA</text></g></svg>`,
    );
    const img = await sharp(chica.data).composite([{ input: marca }]).jpeg({ quality: 78 }).toBuffer();
    return responder(img);
  } catch (err) {
    console.error("[escolar/mosaico foto]", err);
    return new NextResponse("Error", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

function responder(img: Buffer) {
  return new NextResponse(new Uint8Array(img), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
