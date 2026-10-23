import "server-only";
import { prisma } from "@repo/db";
import { emitDesign, type ResourceResolver } from "@repo/design-studio";
import { editorADocumento } from "@repo/template-editor-core/rendering";
import type { TemplateV2Block } from "@repo/template-editor-core";
import { leerEstadoFotolibro } from "./modo/estado";
import { medidasDelLienzo } from "./modo/bloques";
import { bloquesDeTapa, tapaDelLibro } from "./tapa/bloques";

/**
 * El archivo que se manda al laboratorio: un pliego del fotolibro en JPG, a la resolución del
 * libro (300 ppp) y en RGB, que es lo que piden La Isla y Copy Express ("JPG, 300 ppp, sRGB").
 *
 * Se arma con el mismo motor que la vista previa y el PDF: fotos originales con su encuadre,
 * fondo del estilo y títulos con su tipografía. Lo que se ve en pantalla es lo que se imprime.
 */

/** Las fotos y fondos viven en el almacenamiento con dirección pública: se bajan acá. */
const recursos: ResourceResolver = {
  async read(ref: string) {
    if (!/^https?:\/\//.test(ref)) return null;
    try {
      const r = await fetch(ref);
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  },
};

export type ResultadoExportacion = { ok: true; jpg: Uint8Array; nombre: string } | { ok: false; error: string };

type Cara = { width: number; height: number; dpi: number; background?: string | null };
type BloquePlano = Omit<Parameters<typeof editorADocumento>[0]["blocks"][number], "pageIndex">;

/** Una cara (un pliego o la tapa) en JPG, con el motor de impresión. */
async function rasterizar(lienzo: Cara, bloques: BloquePlano[], nombre: string): Promise<Uint8Array | string> {
  const puente = editorADocumento({
    canvas: { width: lienzo.width, height: lienzo.height, background: lienzo.background ?? null, dpi: lienzo.dpi, bleedMm: 0, safeAreaMm: 0 },
    // Una sola cara, como si fuera la primera.
    blocks: bloques.map((b) => ({ ...b, pageIndex: 0 })),
    nombre,
  });
  const salida = await emitDesign({
    document: puente.document,
    contract: { variables: [] },
    values: {},
    formats: ["JPG_PER_SIDE"],
    pngDpi: lienzo.dpi,
    jpgQuality: 95,
    includeBleed: false,
    resources: recursos,
    fileBaseName: "cara",
  });
  if (!salida.ok) return salida.errors.join(" · ");
  return salida.files[0]?.bytes ?? "No se generó el archivo.";
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

async function versionActual(templateId: string) {
  const t = await prisma.templateV2.findUnique({ where: { id: templateId }, select: { name: true, currentVersionId: true } });
  if (!t?.currentVersionId) return null;
  const version = await prisma.templateV2Version.findUnique({
    where: { id: t.currentVersionId },
    select: { canvasJson: true, metaJson: true },
  });
  return { nombre: t.name, versionId: t.currentVersionId, canvas: (version?.canvasJson ?? {}) as Record<string, unknown>, meta: version?.metaJson ?? {} };
}

export async function exportarPliego(templateId: string, pliego: number): Promise<ResultadoExportacion> {
  const v = await versionActual(templateId);
  if (!v) return { ok: false, error: "El fotolibro no tiene una versión guardada." };
  const bloques = await prisma.templateV2Block.findMany({
    where: { templateVersionId: v.versionId, pageIndex: pliego },
    orderBy: { zIndex: "asc" },
  });
  if (bloques.length === 0) return { ok: false, error: `El pliego ${pliego + 1} no existe o está vacío.` };
  const c = v.canvas;
  const jpg = await rasterizar(
    { width: num(c.width, 0), height: num(c.height, 0), dpi: num(c.dpi, 300), background: typeof c.background === "string" ? c.background : null },
    bloques.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: b.rotation,
      zIndex: b.zIndex,
      opacity: b.opacity,
      locked: b.locked,
      visible: b.visible,
      configJson: b.configJson,
    })),
    v.nombre,
  );
  if (typeof jpg === "string") return { ok: false, error: jpg };
  return { ok: true, jpg, nombre: `pliego-${String(pliego + 1).padStart(2, "0")}.jpg` };
}

/** La tapa, a la medida de la pieza del laboratorio (con su demasía y, si tiene, el lomo). */
export async function exportarTapa(templateId: string): Promise<ResultadoExportacion> {
  const v = await versionActual(templateId);
  if (!v) return { ok: false, error: "El fotolibro no tiene una versión guardada." };
  const c = v.canvas;
  const meta = v.meta as Record<string, unknown>;
  const hojas = num(meta.templatePageCount, 1);
  const estado = leerEstadoFotolibro(meta, hojas);
  const armado = tapaDelLibro(estado, hojas);
  if (!armado) return { ok: false, error: "El fotolibro todavía no tiene tapa elegida." };
  const medidas = medidasDelLienzo({ width: num(c.width, 0), height: num(c.height, 0), dpi: num(c.dpi, 300) });
  const bloques = bloquesDeTapa(estado, hojas, medidas).map(({ layout, pageIndex: _p, ...b }: TemplateV2Block) => ({
    ...b,
    name: b.name ?? null,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    rotation: layout.rotation ?? 0,
    zIndex: layout.zIndex ?? 0,
    opacity: layout.opacity ?? 1,
    locked: layout.locked ?? false,
    visible: layout.visible ?? true,
  }));
  const jpg = await rasterizar(armado.lienzo, bloques, v.nombre);
  if (typeof jpg === "string") return { ok: false, error: jpg };
  return { ok: true, jpg, nombre: "tapa.jpg" };
}
