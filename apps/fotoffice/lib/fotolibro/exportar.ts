import "server-only";
import { prisma } from "@repo/db";
import { emitDesign, type ResourceResolver } from "@repo/design-studio";
import { editorADocumento } from "@repo/template-editor-core/rendering";

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

export async function exportarPliego(templateId: string, pliego: number): Promise<ResultadoExportacion> {
  const t = await prisma.templateV2.findUnique({
    where: { id: templateId },
    select: { name: true, currentVersionId: true },
  });
  if (!t?.currentVersionId) return { ok: false, error: "El fotolibro no tiene una versión guardada." };
  const version = await prisma.templateV2Version.findUnique({
    where: { id: t.currentVersionId },
    select: { canvasJson: true },
  });
  const bloques = await prisma.templateV2Block.findMany({
    where: { templateVersionId: t.currentVersionId, pageIndex: pliego },
    orderBy: { zIndex: "asc" },
  });
  if (bloques.length === 0) return { ok: false, error: `El pliego ${pliego + 1} no existe o está vacío.` };

  const c = (version?.canvasJson ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const dpi = num(c.dpi, 300);
  const puente = editorADocumento({
    canvas: {
      width: num(c.width, 0),
      height: num(c.height, 0),
      background: typeof c.background === "string" ? c.background : null,
      dpi,
      bleedMm: 0,
      safeAreaMm: 0,
    },
    // Una sola cara: el pliego pedido, como si fuera la primera.
    blocks: bloques.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      pageIndex: 0,
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
    nombre: t.name,
  });

  const salida = await emitDesign({
    document: puente.document,
    contract: { variables: [] },
    values: {},
    formats: ["JPG_PER_SIDE"],
    pngDpi: dpi,
    jpgQuality: 95,
    includeBleed: false,
    resources: recursos,
    fileBaseName: "pliego",
  });
  if (!salida.ok) return { ok: false, error: salida.errors.join(" · ") };
  const archivo = salida.files[0];
  if (!archivo) return { ok: false, error: "No se generó el archivo del pliego." };
  return { ok: true, jpg: archivo.bytes, nombre: `pliego-${String(pliego + 1).padStart(2, "0")}.jpg` };
}
