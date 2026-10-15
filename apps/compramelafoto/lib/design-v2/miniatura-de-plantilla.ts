import "server-only";
import sharp from "sharp";
import { CLASS_LIST_VARIABLE_KEY, serializeClassList } from "@repo/template-engine";
import { fileExistsInR2, readFromR2, uploadToR2 } from "@/lib/r2-client";
import { DESIGN_V2_SCHEMA_VERSION, type DesignV2Data } from "./design-data";
import { renderDesignV2 } from "./render";
import { loadDesignTemplateVersion } from "./template";
import { hayArchivoDeDemo, leerArchivoDeDemo, urlPublicaDeDemo } from "./demo-archivos";
import {
  FOTO_DE_MUESTRA_SVG,
  demoDePlantilla,
  fotoDemoDelHueco,
  selloDeDemo,
} from "./demo-de-plantilla";
import { valoresDeDemo } from "./demo-valores";

/**
 * Miniatura de una plantilla para los catálogos: la primera página, en JPG, con datos de demo.
 *
 * La dibuja el mismo motor que imprime (`renderDesignV2`), una sola vez por versión, y la guarda
 * en R2: la siguiente vez se sirve guardada. Los huecos llevan las fotos de demo del nivel de la
 * plantilla (retrato y grupal, ver `demo-de-plantilla.ts`), los textos un alumno, curso y colegio
 * de ejemplo, y el logo uno de muestra. Si una foto de demo todavía no se subió, va un gris suave
 * con una cámara.
 *
 * La clave guardada lleva un sello con las fotos de demo que había: cuando se suben las que
 * faltaban, la miniatura se vuelve a dibujar sola.
 */

const LADO = 720;

function clave(templateId: string, versionId: string, sello: string): string {
  return `template-thumbs/${templateId}/${versionId}-v2-${sello}.jpg`;
}

/** Foto de muestra para los huecos: gris suave con una cámara en el centro. */
async function fotoDeMuestra(): Promise<Uint8Array> {
  return new Uint8Array(await sharp(Buffer.from(FOTO_DE_MUESTRA_SVG)).jpeg({ quality: 80 }).toBuffer());
}

export type MiniaturaDePlantilla = {
  jpg: Uint8Array;
  /** true si se dibujó con todas las fotos de demo; false si faltaba alguna (no conviene guardarla mucho). */
  completa: boolean;
};

/** Devuelve la miniatura de la versión actual (o la pedida), generándola si no existe. */
export async function miniaturaDePlantilla(
  templateId: string,
  versionId?: string | null,
): Promise<MiniaturaDePlantilla | null> {
  const template = await loadDesignTemplateVersion({ templateId, versionId });
  if (!template) return null;

  const demo = demoDePlantilla({ templateId: template.templateId, meta: template.legacy.meta });
  const [hayRetrato, hayGrupal, hayLogo] = await Promise.all([
    hayArchivoDeDemo(demo.archivos.retrato),
    hayArchivoDeDemo(demo.archivos.grupal),
    hayArchivoDeDemo(demo.archivos.logo),
  ]);
  const completa = hayRetrato && hayGrupal && hayLogo;
  const key = clave(
    template.templateId,
    template.versionId,
    selloDeDemo({ retrato: hayRetrato, grupal: hayGrupal, logo: hayLogo }),
  );
  try {
    if (await fileExistsInR2(key)) return { jpg: new Uint8Array(await readFromR2(key)), completa };
  } catch {
    // Si no se puede leer la guardada, se vuelve a dibujar.
  }

  const [retrato, grupal] = await Promise.all([
    hayRetrato ? leerArchivoDeDemo(demo.archivos.retrato) : null,
    hayGrupal ? leerArchivoDeDemo(demo.archivos.grupal) : null,
  ]);
  let muestra: Promise<Uint8Array> | null = null;
  const deMuestra = () => (muestra ??= fotoDeMuestra());
  // 1 = retrato, 2 = grupal.
  const slots = Object.fromEntries(
    template.slots.map((s) => [
      s.blockId,
      { photoId: fotoDemoDelHueco(s.role) === "grupal" ? 2 : 1, crop: { zoom: 1, x: 0, y: 0 } },
    ]),
  );
  const values = valoresDeDemo(demo, hayLogo ? urlPublicaDeDemo(demo.archivos.logo) : null);
  if (!values[CLASS_LIST_VARIABLE_KEY]) {
    values[CLASS_LIST_VARIABLE_KEY] = serializeClassList([
      { firstName: demo.alumno.firstName, lastName: demo.alumno.lastName, isOwner: true },
    ]);
  }
  const data: DesignV2Data = {
    schemaVersion: DESIGN_V2_SCHEMA_VERSION,
    engine: "TEMPLATE_V2",
    templateV2Id: template.templateId,
    templateV2VersionId: template.versionId,
    photoIds: [1, 2],
    slots,
    values,
    export: null,
    exportError: null,
  };
  const r = await renderDesignV2({
    template,
    data,
    loadPhoto: async (id) => (id === 2 ? grupal : retrato) ?? deMuestra(),
    formats: { pdf: false, jpg: true },
    jpgMaxSide: LADO,
    fileBaseName: "miniatura",
  });
  const jpg = r.ok ? r.jpgs[0] : null;
  if (!jpg) {
    if (!r.ok) console.error("[miniatura] no se pudo dibujar", templateId, r.errors);
    return null;
  }
  try {
    await uploadToR2(Buffer.from(jpg), key, "image/jpeg", { type: "template_thumbnail", templateId });
  } catch (err) {
    console.error("[miniatura] no se pudo guardar", templateId, err);
  }
  return { jpg, completa };
}
