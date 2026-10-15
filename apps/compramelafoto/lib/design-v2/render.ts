import "server-only";
import sharp from "sharp";
import { emitDesign, type ResourceResolver, type VariableDeclaration } from "@repo/design-studio";
import { editorADocumento } from "@repo/template-editor-core/rendering";
import {
  CLASS_LIST_VARIABLE_KEY,
  isClassListConfig,
  parseClassListValue,
  resolveTemplateDocument,
  type LegacyTemplateV2Payload,
} from "@repo/template-engine";
import {
  clientPhotoSlotNumber,
  computeCoverCropRect,
  legacyPayloadToCore,
  resolveTemplateProduct,
  resolveTemplateVariablePlugin,
} from "@/lib/template-v2/server";
import type { DesignV2Data } from "./design-data";
import type { DesignTemplateVersion } from "./template";

/**
 * Dibuja un diseño V2 con las fotos del cliente: un PDF con todas las caras y/o un JPG por cara.
 *
 * Usa `design-studio` (sin navegador, corre en Vercel), el mismo motor del carnet de FOTOFFICE y
 * las placas de Clickatón. Cada hueco de foto se convierte en una imagen fija que apunta a
 * `design-photo:<blockId>`; el lector de recursos la resuelve con la foto original **ya
 * recortada** según el encuadre que eligió el fotógrafo, con la misma cuenta que usa la pantalla
 * (`computeCoverCropRect`). Así lo aprobado y lo impreso coinciden.
 */

const PHOTO_REF_PREFIX = "design-photo:";
/** Lado máximo de una foto ya recortada: más que eso no suma nada a 300 dpi en una carpeta. */
const MAX_PHOTO_SIDE_PX = 4000;
const IMAGE_BLOCK_TYPES = new Set(["IMAGE", "PHOTO"]);

export type DesignPhotoLoader = (photoId: number) => Promise<Uint8Array | null>;

export type RenderDesignV2Result =
  | {
      ok: true;
      pdf: Uint8Array | null;
      /** Uno por cara, en orden. */
      jpgs: Uint8Array[];
      warnings: string[];
    }
  | { ok: false; errors: string[] };

type EditorBlock = Parameters<typeof editorADocumento>[0]["blocks"][number];

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

/** Saca del bloque la referencia a variable: el puente le daría prioridad sobre `src`. */
function fixedImageConfig(config: Record<string, unknown>, src: string): Record<string, unknown> {
  const source = asRecord(config.source);
  delete source.variableKey;
  const fixed: Record<string, unknown> = { ...config, src, source };
  delete fixed.variableKey;
  return fixed;
}

/**
 * Prepara el documento del editor: los huecos con foto pasan a ser imágenes fijas, los huecos
 * vacíos se sacan (no se imprime un cuadro gris) y los vínculos de esos huecos se descartan.
 */
function withClientPhotos(legacy: LegacyTemplateV2Payload, data: DesignV2Data): LegacyTemplateV2Payload {
  const slotBlockIds = new Set<string>();
  const blocks: LegacyTemplateV2Payload["blocks"] = [];
  for (const block of legacy.blocks) {
    if (clientPhotoSlotNumber(block) == null) {
      blocks.push(block);
      continue;
    }
    slotBlockIds.add(block.id);
    const assignment = data.slots[block.id];
    if (!assignment || assignment.photoId == null) continue;
    blocks.push({
      ...block,
      type: "IMAGE",
      configJson: fixedImageConfig(asRecord(block.configJson), `${PHOTO_REF_PREFIX}${block.id}`),
    });
  }
  return {
    ...legacy,
    blocks,
    variableBindings: legacy.variableBindings.filter((b) => !slotBlockIds.has(b.blockId)),
  };
}

function publicBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://compramelafoto.com";
  return raw.replace(/\/$/, "");
}

/** Trae una imagen fija del diseño (fondo, marco, logo) y la deja en JPG o PNG. */
async function loadStaticImage(ref: string): Promise<Uint8Array | null> {
  let bytes: Uint8Array;
  try {
    if (ref.startsWith("data:")) {
      const comma = ref.indexOf(",");
      if (comma < 0) return null;
      bytes = new Uint8Array(Buffer.from(ref.slice(comma + 1), "base64"));
    } else {
      const url = ref.startsWith("/") ? `${publicBaseUrl()}${ref}` : ref;
      if (!/^https?:\/\//.test(url)) return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    return null;
  }
  try {
    const image = sharp(bytes, { failOn: "none" }).rotate();
    const { hasAlpha } = await image.metadata();
    const out = hasAlpha ? await image.png().toBuffer() : await image.jpeg({ quality: 90 }).toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

/** La foto del cliente recortada a su hueco, a la resolución del hueco (sin agrandar). */
export async function cropPhotoForSlot(input: {
  bytes: Uint8Array;
  slotWidth: number;
  slotHeight: number;
  crop: DesignV2Data["slots"][string]["crop"];
}): Promise<Uint8Array> {
  const rotated = await sharp(input.bytes, { failOn: "none" })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const rect = computeCoverCropRect({
    srcWidth: rotated.info.width,
    srcHeight: rotated.info.height,
    slotWidth: input.slotWidth,
    slotHeight: input.slotHeight,
    crop: input.crop,
  });
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  const width = Math.max(1, Math.min(rotated.info.width - left, Math.round(rect.width)));
  const height = Math.max(1, Math.min(rotated.info.height - top, Math.round(rect.height)));

  const targetWidth = Math.min(width, Math.round(input.slotWidth), MAX_PHOTO_SIDE_PX);
  const out = await sharp(rotated.data)
    .extract({ left, top, width, height })
    .resize({ width: Math.max(1, targetWidth), withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}

function editorBlocksFromResolved(
  document: ReturnType<typeof resolveTemplateDocument>["document"],
): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (const block of document.blocks) {
    let config = asRecord(block.config);
    let type: string = block.type;
    if (IMAGE_BLOCK_TYPES.has(type) || type === "BACKGROUND") {
      const src = typeof config.src === "string" ? config.src.trim() : "";
      if (src) config = fixedImageConfig(config, src);
      // Una imagen sin nada que mostrar (un logo que no se cargó) se saca: no frena el diseño.
      else if (IMAGE_BLOCK_TYPES.has(type)) continue;
      if (type === "PHOTO" && src) type = "IMAGE";
    }
    // El texto ya viene resuelto: si siguiera como variable, el puente reescribiría el marcador.
    // El listado del curso sigue como variable: el puente lo reparte con `listaDelCurso`.
    if (type === "VARIABLE_TEXT" && !isClassListConfig(config)) type = "TEXT";
    blocks.push({
      id: block.id,
      type,
      name: block.name ?? null,
      pageIndex: block.pageIndex ?? 0,
      x: block.layout.x,
      y: block.layout.y,
      width: block.layout.width,
      height: block.layout.height,
      rotation: block.layout.rotation ?? 0,
      zIndex: block.layout.zIndex ?? 0,
      opacity: block.layout.opacity ?? 1,
      locked: block.layout.locked ?? false,
      visible: block.layout.visible ?? true,
      configJson: config,
    } as EditorBlock);
  }
  return blocks;
}

export async function renderDesignV2(input: {
  template: DesignTemplateVersion;
  data: DesignV2Data;
  loadPhoto: DesignPhotoLoader;
  formats: { pdf: boolean; jpg: boolean };
  /** Para vistas rápidas: achica las caras a este lado mayor. Sin valor, la resolución del lienzo. */
  jpgMaxSide?: number;
  fileBaseName: string;
}): Promise<RenderDesignV2Result> {
  const { template, data } = input;
  const legacy = withClientPhotos(template.legacy, data);

  let resolvedDocument: ReturnType<typeof resolveTemplateDocument>["document"];
  try {
    const { document } = legacyPayloadToCore(legacy, { id: template.templateId, name: template.name });
    const product = resolveTemplateProduct(legacy.meta);
    const registry = resolveTemplateVariablePlugin(product === "unknown" ? "school" : product);
    resolvedDocument = resolveTemplateDocument({ template: document, data: data.values, registry }).document;
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : "La plantilla no se pudo leer."] };
  }

  const canvas = legacy.canvas as {
    width: number;
    height: number;
    background?: string | null;
    dpi?: number | null;
    bleedMm?: number | null;
    safeAreaMm?: number | null;
  };
  const puente = editorADocumento({
    canvas: {
      width: canvas.width,
      height: canvas.height,
      background: canvas.background ?? null,
      dpi: canvas.dpi ?? 300,
      bleedMm: canvas.bleedMm ?? 0,
      safeAreaMm: canvas.safeAreaMm ?? 0,
    },
    blocks: editorBlocksFromResolved(resolvedDocument),
    nombre: template.name,
    listaDelCurso: parseClassListValue(data.values[CLASS_LIST_VARIABLE_KEY]),
  });

  const slotSizeByBlock = new Map(
    template.legacy.blocks.map((b) => [b.id, { width: b.layout.width, height: b.layout.height }]),
  );
  const photoCache = new Map<number, Promise<Uint8Array | null>>();
  const resources: ResourceResolver = {
    async read(ref: string) {
      if (!ref.startsWith(PHOTO_REF_PREFIX)) return loadStaticImage(ref);
      const blockId = ref.slice(PHOTO_REF_PREFIX.length);
      const assignment = data.slots[blockId];
      const size = slotSizeByBlock.get(blockId);
      if (!assignment || assignment.photoId == null || !size) return null;
      let pending = photoCache.get(assignment.photoId);
      if (!pending) {
        pending = input.loadPhoto(assignment.photoId);
        photoCache.set(assignment.photoId, pending);
      }
      const bytes = await pending;
      if (!bytes) return null;
      try {
        return await cropPhotoForSlot({
          bytes,
          slotWidth: size.width,
          slotHeight: size.height,
          crop: assignment.crop,
        });
      } catch {
        return null;
      }
    },
  };

  const synthetic: VariableDeclaration[] = puente.variablesSinteticas.map((v) => ({
    key: v.key,
    type: "qrPayload" as const,
    label: v.label,
    required: true,
    sampleValue: v.value,
  }));
  const syntheticValues = Object.fromEntries(puente.variablesSinteticas.map((v) => [v.key, v.value]));

  const dpi = canvas.dpi ?? 300;
  const longest = Math.max(canvas.width, canvas.height);
  const pngDpi =
    input.jpgMaxSide && longest > input.jpgMaxSide ? Math.max(36, (dpi * input.jpgMaxSide) / longest) : dpi;

  const formats: ("PDF" | "PNG_PER_SIDE")[] = [];
  if (input.formats.pdf) formats.push("PDF");
  if (input.formats.jpg) formats.push("PNG_PER_SIDE");

  const out = await emitDesign({
    document: puente.document as never,
    contract: { variables: synthetic },
    values: syntheticValues,
    formats,
    pngDpi,
    includeBleed: false,
    resources,
    fileBaseName: input.fileBaseName,
  });
  if (!out.ok) return { ok: false, errors: out.errors };

  const pdfFile = out.files.find((f) => f.contentType === "application/pdf");
  const pngs = out.files.filter((f) => f.contentType === "image/png");
  const jpgs: Uint8Array[] = [];
  for (const png of pngs) {
    const jpg = await sharp(png.bytes).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    jpgs.push(new Uint8Array(jpg));
  }

  return { ok: true, pdf: pdfFile ? pdfFile.bytes : null, jpgs, warnings: puente.avisos };
}
