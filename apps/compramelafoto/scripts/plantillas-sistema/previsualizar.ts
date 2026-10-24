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
import {
  clientPhotoSlotNumber,
  computeCoverCropRect,
  imageBlockVariableKey,
  resolveTemplateVariablePlugin,
} from "@repo/template-editor-core";
import {
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_SAMPLE,
  COURSE_MOSAIC_VARIABLE_KEY,
  isClassListConfig,
  isCourseMosaicConfig,
  parseClassListGroups,
  parseCourseMosaic,
  resolveTemplateDocument,
  serializeCourseMosaic,
  serializeClassList,
  type LegacyTemplateV2Payload,
} from "@repo/template-engine";
import type { PlantillaSistema } from "./definiciones";
import { R2_BASE } from "./lienzo";

const FOTO = "muestra-foto:";
const BASE_FALSA = "https://fondos.local";
/** El logo ficticio del colegio (un escudo genérico, sin marcas reales). */
const LOGO_DE_MUESTRA = "https://logo.local/escudo.png";

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
  [COURSE_MOSAIC_VARIABLE_KEY]: serializeCourseMosaic(COURSE_MOSAIC_SAMPLE),
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
  "branding.schoolLogoUrl": LOGO_DE_MUESTRA,
  [CLASS_LIST_VARIABLE_KEY]: serializeClassList(
    ALUMNOS.map(([f, l]) => ({ firstName: f, lastName: l, isOwner: f === "Martina" })),
  ),
};

type Muestra = "individual" | "grupal" | "maestra" | "amigos" | "libre";

const MUESTRA_POR_VARIABLE: Record<string, Muestra> = {
  photo_individual: "individual",
  photo_group: "grupal",
  photo_teacher: "maestra",
  photo_friends: "amigos",
  photo_extra: "libre",
};

/** Una persona de siluetas: cabeza y torso. */
const persona = (x: number, yCabeza: number, r: number, color: string, piel = "#f1c7a8") =>
  `<circle cx="${x}" cy="${yCabeza}" r="${r}" fill="${piel}"/><path d="M ${x - r * 1.7} ${yCabeza + r * 4.2} C ${x - r * 1.6} ${yCabeza + r * 1.2}, ${x + r * 1.6} ${yCabeza + r * 1.2}, ${x + r * 1.7} ${yCabeza + r * 4.2} Z" fill="${color}"/>`;

/** Foto de muestra: siluetas genéricas sobre un fondo de estudio (o de patio, la libre). */
async function fotoDeMuestra(rol: Muestra): Promise<Buffer> {
  const [w, h] = rol === "individual" ? [1200, 1600] : [1800, 1200];
  let figuras = "";
  let fondo = `<radialGradient id="g" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#d9dde3"/><stop offset="1" stop-color="#8a929e"/></radialGradient>`;
  if (rol === "individual") {
    figuras = `<circle cx="600" cy="640" r="250" fill="#f1c7a8"/><path d="M 180 1600 C 220 1100, 980 1100, 1020 1600 Z" fill="#2e5aa8"/>`;
  } else if (rol === "grupal") {
    const filas = [[260, 760, 7], [420, 980, 6]] as const;
    for (const [yCab, yCuerpo, n] of filas) {
      for (let i = 0; i < n; i++) {
        const x = 200 + (i + 0.5) * (1400 / n);
        figuras += `<circle cx="${x}" cy="${yCab + 300}" r="80" fill="#f1c7a8"/><path d="M ${x - 130} ${yCuerpo + 300} C ${x - 120} ${yCuerpo + 60}, ${x + 120} ${yCuerpo + 60}, ${x + 130} ${yCuerpo + 300} Z" fill="${i % 2 ? "#c0392b" : "#2e5aa8"}"/>`;
      }
    }
  } else if (rol === "maestra") {
    // La maestra (más alta, de verde) y el alumno al lado.
    figuras = persona(760, 380, 150, "#2f8f6b", "#e8b896") + persona(1120, 640, 120, "#2e5aa8");
    figuras += `<path d="M 900 1000 q 80 -60 150 -10" stroke="#e8b896" stroke-width="44" fill="none" stroke-linecap="round"/>`;
  } else if (rol === "amigos") {
    // Tres amigos abrazados, apretados.
    figuras = persona(560, 560, 130, "#e67e22") + persona(900, 500, 140, "#8e44ad") + persona(1240, 570, 130, "#16a085");
    figuras += `<path d="M 600 900 Q 900 760 1200 900" stroke="#f1c7a8" stroke-width="50" fill="none" stroke-linecap="round"/>`;
  } else {
    fondo = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f5"/><stop offset="0.62" stop-color="#e9f6fb"/><stop offset="0.62" stop-color="#9ccf7a"/><stop offset="1" stop-color="#6fae55"/></linearGradient>`;
    figuras = `<circle cx="1500" cy="230" r="110" fill="#ffd34d"/>` + persona(820, 470, 120, "#d35400") + `<circle cx="1180" cy="1010" r="90" fill="#ffffff" stroke="#333" stroke-width="10"/>`;
  }
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${fondo}</defs><rect width="${w}" height="${h}" fill="url(#g)"/>${figuras}</svg>`;
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

/**
 * Escudo genérico de muestra, en PNG transparente y más alto que ancho (como casi todos los
 * escudos): sirve para ver que el logo entra entero en su recuadro.
 */
async function logoDeMuestra(): Promise<Buffer> {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960">
    <path d="M 80 60 L 720 60 L 720 470 C 720 700 560 840 400 920 C 240 840 80 700 80 470 Z" fill="#1f4e8c" stroke="#c9a227" stroke-width="34"/>
    <path d="M 400 60 L 400 905 M 80 360 L 720 360" stroke="#c9a227" stroke-width="22"/>
    <circle cx="240" cy="210" r="70" fill="#ffffff"/>
    <path d="M 500 150 L 640 150 L 640 280 L 500 280 Z" fill="#ffffff"/>
    <path d="M 170 470 L 330 470 L 250 650 Z" fill="#ffffff"/>
    <path d="M 470 560 q 70 -90 140 0 q -70 90 -140 0 Z" fill="#ffffff"/>
  </svg>`;
  return sharp(Buffer.from(s)).png().toBuffer();
}

/** Dibuja las dos páginas de una plantilla. Devuelve un PNG por página. */
export async function dibujarPlantilla(
  p: PlantillaSistema,
  carpetaFondos: string,
  dpi: number,
  opciones: { sinLogo?: boolean } = {},
): Promise<{ pngs: Buffer[]; avisos: string[] }> {
  const valores = { ...VALORES_DE_MUESTRA };
  if (opciones.sinLogo) delete valores["branding.schoolLogoUrl"];
  const legacy0 = versionRowsToLegacyPayload({
    canvasJson: p.canvasJson,
    metaJson: p.metaJson,
    blocks: p.bloques.map((b) => ({
      ...b,
      configJson: JSON.parse(JSON.stringify(b.configJson).split(R2_BASE).join(BASE_FALSA)),
    })),
    bindings: p.bindings.map((b) => ({ ...b, formatter: null, fallbackOverride: null })),
  });

  const rolDeBloque = new Map<string, Muestra>();
  const blocks: LegacyTemplateV2Payload["blocks"] = legacy0.blocks.map((b) => {
    const n = clientPhotoSlotNumber(b);
    if (n == null) return b;
    rolDeBloque.set(b.id, MUESTRA_POR_VARIABLE[imageBlockVariableKey(b.configJson) ?? ""] ?? "libre");
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
    data: valores,
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
    if (type === "VARIABLE_TEXT" && !isClassListConfig(config) && !isCourseMosaicConfig(config)) type = "TEXT";
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
    cursosDelListado: parseClassListGroups(VALORES_DE_MUESTRA[CLASS_LIST_VARIABLE_KEY], VALORES_DE_MUESTRA["course.displayName"]),
    mosaicoDelCurso: parseCourseMosaic(VALORES_DE_MUESTRA[COURSE_MOSAIC_VARIABLE_KEY]),
    colegioDelListado: VALORES_DE_MUESTRA["school.name"] ?? null,
  });

  const tam = new Map(legacy.blocks.map((b) => [b.id, b.layout]));
  const fotos = Object.fromEntries(
    await Promise.all((Object.values(MUESTRA_POR_VARIABLE)).map(async (m) => [m, await fotoDeMuestra(m)] as const)),
  ) as Record<Muestra, Buffer>;
  const resources: ResourceResolver = {
    async read(ref: string) {
      if (ref === LOGO_DE_MUESTRA) return new Uint8Array(await logoDeMuestra());
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
