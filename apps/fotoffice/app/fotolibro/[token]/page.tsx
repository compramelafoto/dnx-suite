import type { Metadata } from "next";
import { prisma } from "@repo/db";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import { revisionPorEnlace } from "@/lib/fotolibro/revision-cliente";
import { leerEstadoFotolibro } from "@/lib/fotolibro/modo/estado";
import { medidasDelLienzo } from "@/lib/fotolibro/modo/bloques";
import { bloquesDeTapa, tapaDelLibro } from "@/lib/fotolibro/tapa/bloques";
import { VisorCliente } from "./visor-cliente";

export const dynamic = "force-dynamic";
// Un libro privado: que no lo indexe nadie.
export const metadata: Metadata = { title: "Tu fotolibro", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

/**
 * Lo que el cliente ve desde el enlace: el libro para hojear, comentar y aprobar. Sin cuenta.
 *
 * Sólo viajan las copias livianas de las fotos (la vista de 1600 px): los originales para imprimir
 * no salen de acá, así el cliente no puede bajarse las fotos en alta antes de tiempo.
 */
export default async function Page({ params }: Props) {
  const { token } = await params;
  const r = await revisionPorEnlace(token);
  const libro = r?.revision.token === token ? await prisma.templateV2.findUnique({ where: { id: r.revision.fotolibroId }, select: { name: true, currentVersionId: true } }) : null;
  if (!r || !libro?.currentVersionId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#18191b] p-6 text-center text-white">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Este enlace ya no está disponible</h1>
          <p className="text-sm text-white/60">Pedile al estudio que te mande uno nuevo.</p>
        </div>
      </main>
    );
  }
  const version = await prisma.templateV2Version.findUnique({ where: { id: libro.currentVersionId }, select: { canvasJson: true, metaJson: true } });
  const filas = await prisma.templateV2Block.findMany({ where: { templateVersionId: libro.currentVersionId }, orderBy: [{ pageIndex: "asc" }, { zIndex: "asc" }] });
  const c = (version?.canvasJson ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const canvas: TemplateV2Canvas = { width: num(c.width, 1), height: num(c.height, 1), dpi: num(c.dpi, 300), background: typeof c.background === "string" ? c.background : "#ffffff" };
  const sinOriginal = (cfg: Record<string, unknown>) => {
    if (typeof cfg.previewSrc !== "string") return cfg;
    const { previewSrc, ...resto } = cfg;
    return { ...resto, src: previewSrc };
  };
  const bloques: TemplateV2Block[] = filas.map((b) => ({
    id: b.id,
    type: b.type,
    name: b.name ?? undefined,
    pageIndex: b.pageIndex,
    layout: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation, zIndex: b.zIndex, opacity: b.opacity, locked: true, visible: b.visible },
    configJson: sinOriginal((b.configJson ?? {}) as Record<string, unknown>),
  }));
  const meta = (version?.metaJson ?? {}) as Record<string, unknown>;
  const pliegos = Math.max(1, num(meta.templatePageCount, 1), ...bloques.map((b) => (b.pageIndex ?? 0) + 1));
  const estado = leerEstadoFotolibro(meta, pliegos);
  const armado = tapaDelLibro(estado, pliegos);
  const tapa = armado
    ? { canvas: { ...armado.lienzo, background: "#ffffff" }, bloques: bloquesDeTapa(estado, pliegos, medidasDelLienzo(canvas)).map((b) => ({ ...b, configJson: sinOriginal(b.configJson) })) }
    : null;

  return (
    <VisorCliente
      token={token}
      nombre={libro.name}
      canvas={canvas}
      bloques={bloques}
      pliegos={pliegos}
      tapa={tapa}
      comentarios={r.revision.comentarios}
      estado={r.revision.estado}
      aprobacion={r.revision.aprobacion}
    />
  );
}
