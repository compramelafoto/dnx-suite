import archiver from "archiver";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { jpgConDensidad } from "@/lib/design-v2/jpg-imprenta";
import { etiquetasDeCaras } from "@/lib/design-v2/produccion";
import { archivosJpgDeTrabajo, datosDelLibrito, nombreDeTrabajo } from "@/lib/design-v2/produccion-reglas";
import { loadDesignPhotoBytes, loadDesignProjectForActor, loadTemplateForDesign } from "@/lib/design-v2/projects";
import { renderDesignV2 } from "@/lib/design-v2/render";
import { readFromR2, urlToR2Key } from "@/lib/r2-client";
import { safeFilename } from "@/lib/safe-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** «attachment» con el nombre legible (acentos, «º») y uno ASCII para navegadores viejos. */
function adjunto(nombre: string, fallback: string): string {
  return `attachment; filename="${safeFilename(nombre, fallback)}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/**
 * GET /api/fotografo/disenos/[id]/jpg[?cara=N] — el diseño en JPG para imprenta (300 dpi, sRGB).
 *
 * - Una sola cara (o `?cara=N`): el JPG suelto, con el nombre del trabajo y la cara.
 * - Varias caras (librito): un ZIP con un JPG por cara, sin subcarpetas
 *   («7 A - Celoria Pedro (diseño 123) - 1 EXTERIOR (contratapa + tapa).jpg»).
 *
 * Si el diseño está aprobado se entregan los JPG que se generaron al aprobar (los mismos que van
 * al lote). Si no, se dibuja como está ahora, con el mismo motor que el PDF.
 */
export async function GET(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  const caraPedida = Number(new URL(req.url).searchParams.get("cara") ?? "");

  try {
    const { project, data } = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(data);

    let jpgs: Uint8Array[];
    const aprobados = project.status === "EXPORTED" ? (data.export?.jpgUrls ?? []) : [];
    if (aprobados.length > 0) {
      jpgs = [];
      for (const url of aprobados) jpgs.push(new Uint8Array(await readFromR2(urlToR2Key(url))));
    } else {
      const out = await renderDesignV2({
        template,
        data,
        loadPhoto: loadDesignPhotoBytes,
        formats: { pdf: false, jpg: true },
        fileBaseName: `diseno-${id}`,
      });
      if (!out.ok || out.jpgs.length === 0) {
        return NextResponse.json(
          { ok: false, error: `No se pudo generar el JPG: ${out.ok ? "sin archivo" : out.errors.join(" · ")}` },
          { status: 422 },
        );
      }
      jpgs = out.jpgs;
    }
    jpgs = jpgs.map((b) => jpgConDensidad(b, 300));

    const libro = datosDelLibrito(id, data.values);
    const archivos = archivosJpgDeTrabajo(null, libro, 1, jpgs.length, etiquetasDeCaras(template.legacy.meta));

    if (Number.isInteger(caraPedida) && caraPedida >= 1) {
      const i = caraPedida - 1;
      if (!jpgs[i]) return NextResponse.json({ ok: false, error: "Esa cara no existe." }, { status: 404 });
      return jpgResponse(jpgs[i]!, archivos[i]!);
    }
    if (jpgs.length === 1) return jpgResponse(jpgs[0]!, archivos[0]!);

    // Librito: las caras juntas en un ZIP, sueltas y ordenadas por nombre. Sin recomprimir.
    const archive = archiver("zip", { store: true });
    archivos.forEach((nombre, i) => archive.append(Buffer.from(jpgs[i]!), { name: nombre }));
    void archive.finalize();
    return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": adjunto(`${nombreDeTrabajo(null, libro, 1)} - JPG.zip`, `diseno-${id}-jpg.zip`),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return designErrorResponse(err, "JPG de diseño");
  }
}

function jpgResponse(bytes: Uint8Array, nombre: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": adjunto(nombre, "diseno.jpg"),
      "cache-control": "no-store",
    },
  });
}
