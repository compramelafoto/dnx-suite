import "server-only";
import { createHash } from "crypto";
import sharp from "sharp";
import { fileExistsInR2, readFromR2, uploadToR2, urlToR2Key } from "@/lib/r2-client";
import { loadDesignPhotoBytes, loadDesignProjectForActor, loadTemplateForDesign, type DesignActor } from "./projects";
import { renderDesignV2 } from "./render";

/**
 * Miniaturas de las caras de un librito, para la vista previa de la ficha del pedido.
 *
 * Dibujar un librito es caro (carga las fotos originales y rasteriza cada cara), así que se hace
 * una sola vez por versión del diseño y se guarda en R2: las siguientes veces se leen al instante.
 * El "sello" sale del contenido del diseño: si alguien lo edita, cambia y se vuelven a generar.
 *
 * Si el diseño está aprobado, se achican los JPG de imprenta que ya existen (no hace falta dibujar).
 */

/** Lado mayor de cada miniatura, en píxeles: alcanza para ampliarla en la ficha. */
const LADO = 1000;

function carpeta(designId: number, sello: string): string {
  return `design-previews/${designId}/${sello}`;
}

const claveCara = (designId: number, sello: string, cara: number) => `${carpeta(designId, sello)}/cara-${cara}.jpg`;
const claveIndice = (designId: number, sello: string) => `${carpeta(designId, sello)}/caras.json`;

export type MiniaturasDeDiseno = { sello: string; caras: number };

/** Sello del contenido del diseño (cambia con cualquier edición o con la aprobación). */
function selloDe(status: string, revisionId: number | string, data: unknown): string {
  return createHash("sha1")
    .update(`${status}|${revisionId}|${JSON.stringify(data)}`)
    .digest("hex")
    .slice(0, 16);
}

async function achicar(jpg: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(jpg)).resize(LADO, LADO, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

/**
 * Devuelve cuántas caras tiene el librito y el sello de su versión actual, generando y guardando
 * las miniaturas si todavía no existen. Valida que el diseño sea del fotógrafo (o admin).
 */
export async function miniaturasDeDiseno(designId: number, actor: DesignActor): Promise<MiniaturasDeDiseno> {
  const { project, data, revisionId } = await loadDesignProjectForActor(designId, actor);
  const sello = selloDe(project.status, revisionId, data);
  const indice = claveIndice(designId, sello);
  try {
    if (await fileExistsInR2(indice)) {
      const guardado = JSON.parse((await readFromR2(indice)).toString("utf8")) as { caras?: unknown };
      if (typeof guardado.caras === "number" && guardado.caras > 0) return { sello, caras: guardado.caras };
    }
  } catch {
    // Si no se puede leer el índice, se vuelven a generar.
  }

  let caras: Uint8Array[];
  const aprobados = project.status === "EXPORTED" ? (data.export?.jpgUrls ?? []) : [];
  if (aprobados.length > 0) {
    caras = [];
    for (const url of aprobados) caras.push(new Uint8Array(await readFromR2(urlToR2Key(url))));
  } else {
    const template = await loadTemplateForDesign(data);
    const out = await renderDesignV2({
      template,
      data,
      loadPhoto: loadDesignPhotoBytes,
      formats: { pdf: false, jpg: true },
      jpgMaxSide: LADO,
      fileBaseName: `vista-previa-${designId}`,
    });
    if (!out.ok || out.jpgs.length === 0) {
      throw new Error(out.ok ? "El diseño no tiene caras para mostrar." : out.errors.join(" · "));
    }
    caras = out.jpgs;
  }

  for (const [i, jpg] of caras.entries()) {
    await uploadToR2(await achicar(jpg), claveCara(designId, sello, i + 1), "image/jpeg", {
      type: "design_preview",
      designId: String(designId),
    });
  }
  await uploadToR2(Buffer.from(JSON.stringify({ caras: caras.length })), indice, "application/json", {
    type: "design_preview",
    designId: String(designId),
  });
  return { sello, caras: caras.length };
}

/**
 * La miniatura de una cara. Si el sello pedido ya no es el actual (el diseño cambió), se sirve la
 * de la versión actual, generándola si hace falta. `null` si esa cara no existe.
 */
export async function caraDeDiseno(
  designId: number,
  actor: DesignActor,
  cara: number,
): Promise<{ jpg: Buffer; sello: string } | null> {
  const { sello, caras } = await miniaturasDeDiseno(designId, actor);
  if (!Number.isInteger(cara) || cara < 1 || cara > caras) return null;
  return { jpg: await readFromR2(claveCara(designId, sello, cara)), sello };
}
