/**
 * Dibuja cada plantilla con el mismo camino que la impresión (`editorADocumento` →
 * `emitDesign`), con fotos y datos de muestra, para revisarlas a ojo antes de cargarlas.
 *
 * Replica `lib/design-v2/render.ts` (que no se puede importar fuera de Next por `server-only`):
 * los huecos de foto pasan a ser imágenes fijas, las variables se resuelven con el registro
 * escolar y el listado del curso se reparte con la lista de muestra.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { emitDesign, type ResourceResolver } from "@repo/design-studio";
import { editorADocumento } from "@repo/template-editor-core/rendering";
import { legacyPayloadToCore, versionRowsToLegacyPayload } from "@repo/template-editor-core/services";
import { clientPhotoSlotNumber, computeCoverCropRect, resolveTemplateVariablePlugin } from "@repo/template-editor-core";
import {
  CLASS_LIST_VARIABLE_KEY,
  isClassListConfig,
  parseClassListValue,
  resolveTemplateDocument,
  serializeClassList,
  type LegacyTemplateV2Payload,
} from "@repo/template-engine";
import type { PlantillaSistema } from "./definiciones";
import { R2_BASE } from "./lienzo";

const FOTO = "muestra-foto:";
const BASE_FALSA = "https://fondos.local";

const ALUMNOS: Array<[string, string]> = [
  ["Sofía", "Acosta"], ["Mateo", "Benítez"], ["Valentina", "Castro"], ["Benjamín", "Díaz"],
  ["Emma", "Fernández"], ["Thiago", "Giménez"], ["Isabella", "Gómez"], ["Lautaro", "Herrera"],
  ["Martina", "López"], ["Joaquín", "Martínez"], ["Catalina", "Medina"], ["Santino", "Moreno"],
  ["Mía", "Núñez"], ["Felipe", "Pereyra"], ["Olivia", "Ramírez"], ["Bautista", "Romero"],
  ["Julieta", "Sánchez"], ["Tomás", "Sosa"], ["Lucía", "Suárez"], ["Bruno", "Torres"],
  ["Renata", "Vega"], ["Facundo", "Villalba"], ["Delfina", "Ruiz"], ["Agustín", "Molina"],
  ["Alma", "Ortiz"], ["Lorenzo", "Rojas"],
];

export const VALORES_DE_MUESTRA: Record<string, string> = {
  "student.fullName": "Martina López",
  "student.firstName": "Martina",
  "student.lastName": "López",
  "student.lastNameFirst": "López, Martina",
  "school.name": "Colegio San Martín de Tours",
  "course.displayName": "Sala de 5 · Turno mañana",
  "course.withSchool": "Sala de 5 · Turno mañana - Colegio San Martín de Tours",
  "school.withCourse": "Colegio San Martín de Tours - Sala de 5 · Turno mañana",
  "event.dateFormatted": "15/10/2026",
  "photographer.displayName": "Estudio de muestra",
  [CLASS_LIST_VARIABLE_KEY]: serializeClassList(
    ALUMNOS.map(([f, l]) => ({ firstName: f, lastName: l, isOwner: f === "Martina" })),
  ),
};

/** Foto de muestra: un retrato o un grupo de siluetas sobre un fondo de estudio. */
async function fotoDeMuestra(rol: "individual" | "grupal"): Promise<Buffer> {
  const [w, h] = rol === "individual" ? [1200, 1600] : [1800, 1200];
  let figuras = "";
  if (rol === "individual") {
    figuras = `<circle cx="600" cy="640" r="250" fill="#f1c7a8"/><path d="M 180 1600 C 220 1100, 980 1100, 1020 1600 Z" fill="#2e5aa8"/>`;
  } else {
    const filas = [[260, 760, 7], [420, 980, 6]] as const;
    for (const [yCab, yCuerpo, n] of filas) {
      for (let i = 0; i < n; i++) {
        const x = 200 + (i + 0.5) * (1400 / n);
        figuras += `<circle cx="${x}" cy="${yCab + 300}" r="80" fill="#f1c7a8"/><path d="M ${x - 130} ${yCuerpo + 300} C ${x - 120} ${yCuerpo + 60}, ${x + 120} ${yCuerpo + 60}, ${x + 130} ${yCuerpo + 300} Z" fill="${i % 2 ? "#c0392b" : "#2e5aa8"}"/>`;
      }
    }
  }
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#d9dde3"/><stop offset="1" stop-color="#8a929e"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${figuras}</svg>`;
  return sharp(Buffer.from(s)).jpeg({ quality: 85 }).toBuffer();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

function fixedImageConfig(config: Record<string, unknown>, src: string): Record<string, unknown> {
  const source = asRecord(config.source);
  delete source.variableKey;
  const fixed: Record<string, unknown> = { ...config, src, source };
  delete fixed.variableKey;
  return fixed;
}

/** Dibuja las dos páginas de una plantilla. Devuelve un PNG por página. */
export async function dibujarPlantilla(
  p: PlantillaSistema,
  carpetaFondos: string,
  dpi: number,
): Promise<{ pngs: Buffer[]; avisos: string[] }> {
  const legacy0 = versionRowsToLegacyPayload({
    canvasJson: p.canvasJson,
    metaJson: p.metaJson,
    blocks: p.bloques.map((b) => ({
      ...b,
      configJson: JSON.parse(JSON.stringify(b.configJson).split(R2_BASE).join(BASE_FALSA)),
    })),
    bindings: p.bindings.map((b) => ({ ...b, formatter: null, fallbackOverride: null })),
  });

  const rolDeBloque = new Map<string, "individual" | "grupal">();
  const blocks: LegacyTemplateV2Payload["blocks"] = legacy0.blocks.map((b) => {
    const n = clientPhotoSlotNumber(b);
    if (n == null) return b;
    rolDeBloque.set(b.id, n === -2 ? "individual" : "grupal");
    return { ...b, type: "IMAGE", configJson: fixedImageConfig(asRecord(b.configJson), `${FOTO}${b.id}`) };
  });
  const legacy: LegacyTemplateV2Payload = {
    ...legacy0,
    blocks,
    variableBindings: legacy0.variableBindings.filter((vb) => !rolDeBloque.has(vb.blockId)),
  };

  const { document } = legacyPayloadToCore(legacy, { id: p.templateId, name: p.nombre });
  const resuelto = resolveTemplateDocument({
    template: document,
    data: VALORES_DE_MUESTRA,
    registry: resolveTemplateVariablePlugin("school"),
  }).document;

  const editorBlocks = resuelto.blocks.flatMap((block) => {
    let config = asRecord(block.config);
    let type: string = block.type;
    if (type === "IMAGE" || type === "PHOTO" || type === "BACKGROUND") {
      const src = typeof config.src === "string" ? config.src.trim() : "";
      if (src) config = fixedImageConfig(config, src);
      else if (type !== "BACKGROUND") return [];
    }
    if (type === "VARIABLE_TEXT" && !isClassListConfig(config)) type = "TEXT";
    return [
      {
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
      },
    ];
  });

  const canvas = legacy.canvas;
  const puente = editorADocumento({
    canvas: { width: canvas.width, height: canvas.height, background: canvas.background ?? null, dpi: canvas.dpi ?? 300, bleedMm: 0, safeAreaMm: 0 },
    blocks: editorBlocks,
    nombre: p.nombre,
    listaDelCurso: parseClassListValue(VALORES_DE_MUESTRA[CLASS_LIST_VARIABLE_KEY]),
  });

  const tam = new Map(legacy.blocks.map((b) => [b.id, b.layout]));
  const fotos = { individual: await fotoDeMuestra("individual"), grupal: await fotoDeMuestra("grupal") };
  const resources: ResourceResolver = {
    async read(ref: string) {
      if (ref.startsWith(BASE_FALSA)) {
        return new Uint8Array(await readFile(path.join(carpetaFondos, path.basename(ref))));
      }
      if (!ref.startsWith(FOTO)) return null;
      const id = ref.slice(FOTO.length);
      const rol = rolDeBloque.get(id);
      const lay = tam.get(id);
      if (!rol || !lay) return null;
      const bytes = fotos[rol];
      const meta = await sharp(bytes).metadata();
      const r = computeCoverCropRect({ srcWidth: meta.width!, srcHeight: meta.height!, slotWidth: lay.width, slotHeight: lay.height });
      const out = await sharp(bytes)
        .extract({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width) - 1, height: Math.round(r.height) - 1 })
        .jpeg()
        .toBuffer();
      return new Uint8Array(out);
    },
  };

  const out = await emitDesign({
    document: puente.document as never,
    contract: { variables: [] },
    values: {},
    formats: ["PNG_PER_SIDE"],
    pngDpi: dpi,
    includeBleed: false,
    resources,
    fileBaseName: p.modelo.slug,
  });
  if (!out.ok) throw new Error(`${p.modelo.slug}: ${out.errors.join("; ")}`);
  const pngs = out.files.filter((f) => f.contentType === "image/png").map((f) => Buffer.from(f.bytes));
  return { pngs, avisos: puente.avisos };
}
