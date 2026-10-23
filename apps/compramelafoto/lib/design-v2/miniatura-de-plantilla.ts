import "server-only";
import sharp from "sharp";
import { CLASS_LIST_VARIABLE_KEY, serializeClassList } from "@repo/template-engine";
import { clientPhotoSlotNumber } from "@/lib/template-v2/server";
import { fileExistsInR2, readFromR2, uploadToR2 } from "@/lib/r2-client";
import { DESIGN_V2_SCHEMA_VERSION, type DesignV2Data } from "./design-data";
import { renderDesignV2 } from "./render";
import { loadDesignTemplateVersion, type DesignTemplateVersion } from "./template";
import { archivosDeDemoSubidos, leerArchivoDeDemo, urlPublicaDeDemo } from "./demo-archivos";
import { FOTO_DE_MUESTRA_SVG, archivosNecesarios, demoDePlantilla, huecosDeDemo, selloDeDemo } from "./demo-de-plantilla";
import { valoresDeDemo } from "./demo-valores";

/**
 * Miniatura de una plantilla para los catálogos: la primera página, en JPG, con datos de demo.
 *
 * La dibuja el mismo motor que imprime (`renderDesignV2`), una sola vez por versión, y la guarda
 * en R2: la siguiente vez se sirve guardada. Cada hueco lleva la foto de demo que le toca (retrato,
 * grupal, con la maestra, con amigos o libre, según el nivel o el evento: ver
 * `demo-de-plantilla.ts`), los textos un alumno, curso y colegio de ejemplo, y el logo uno de
 * muestra. Si una foto de demo todavía no se subió, va un gris suave con una cámara.
 *
 * La clave guardada lleva un sello con las fotos de demo que había: cuando se suben las que
 * faltaban, la miniatura se vuelve a dibujar sola. También lleva la revisión de la versión, así
 * una plantilla editada en el lugar no sigue mostrando la miniatura de antes.
 */

const LADO = 720;
/** Los huecos que no son del cliente (maestra, amigos, libre) se dibujan como `photo_<n>` desde acá. */
const PRIMER_HUECO_EXTRA = 900;

function clave(templateId: string, versionId: string, revision: number, sello: string): string {
  return `template-thumbs/${templateId}/${versionId}-r${revision}-v2-${sello}.jpg`;
}

/** Foto de muestra para los huecos: gris suave con una cámara en el centro. */
async function fotoDeMuestra(): Promise<Uint8Array> {
  return new Uint8Array(await sharp(Buffer.from(FOTO_DE_MUESTRA_SVG)).jpeg({ quality: 80 }).toBuffer());
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

/**
 * Los huecos de maestra, amigos y libre no son fotos del cliente: el motor los dejaría vacíos. Para
 * la miniatura se los ata a un `photo_<n>` propio, así reciben su foto de demo como los demás.
 */
function conHuecosExtra(template: DesignTemplateVersion, blockIds: Set<string>): DesignTemplateVersion {
  let n = PRIMER_HUECO_EXTRA;
  const blocks = template.legacy.blocks.map((b) => {
    if (!blockIds.has(b.id) || clientPhotoSlotNumber(b) != null) return b;
    const config = asRecord(b.configJson);
    const source = asRecord(config.source);
    source.variableKey = `photo_${n++}`;
    delete config.variableKey;
    return { ...b, configJson: { ...config, source } };
  });
  return { ...template, legacy: { ...template.legacy, blocks } };
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
  const original = await loadDesignTemplateVersion({ templateId, versionId });
  if (!original) return null;

  const demo = demoDePlantilla({ templateId: original.templateId, meta: original.legacy.meta });
  const huecos = huecosDeDemo(original.legacy.blocks);
  const subidos = await archivosDeDemoSubidos(archivosNecesarios(demo, huecos));
  const completa = Object.values(subidos).every(Boolean);
  const key = clave(original.templateId, original.versionId, original.revision ?? 0, selloDeDemo(subidos));
  try {
    if (await fileExistsInR2(key)) return { jpg: new Uint8Array(await readFromR2(key)), completa };
  } catch {
    // Si no se puede leer la guardada, se vuelve a dibujar.
  }

  const template = conHuecosExtra(original, new Set(huecos.map((h) => h.blockId)));
  // Un photoId por archivo de demo (1, 2, …).
  const archivoPorFoto = [...new Set(huecos.map((h) => demo.archivos[h.ranura]))];
  const fotoDelArchivo = new Map(archivoPorFoto.map((a, i) => [a, i + 1]));
  const slots = Object.fromEntries(
    huecos.map((h) => [h.blockId, { photoId: fotoDelArchivo.get(demo.archivos[h.ranura])!, crop: { zoom: 1, x: 0, y: 0 } }]),
  );
  let muestra: Promise<Uint8Array> | null = null;
  const deMuestra = () => (muestra ??= fotoDeMuestra());
  const loadPhoto = async (id: number) => {
    const archivo = archivoPorFoto[id - 1];
    const bytes = archivo && subidos[archivo] ? await leerArchivoDeDemo(archivo) : null;
    return bytes ?? deMuestra();
  };

  const values = valoresDeDemo(demo, subidos[demo.archivos.logo] ? urlPublicaDeDemo(demo.archivos.logo) : null);
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
    photoIds: archivoPorFoto.map((_, i) => i + 1),
    slots,
    values,
    export: null,
    exportError: null,
  };
  const r = await renderDesignV2({
    template,
    data,
    loadPhoto,
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
