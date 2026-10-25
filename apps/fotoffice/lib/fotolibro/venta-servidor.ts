import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { templateV2EditorPath } from "@repo/template-editor-ui";
import { FOTOLIBRO_TEMPLATE_KEY, FOTOLIBROS_BASE_PATH } from "./constantes";
import { crearFotolibro } from "./crear";
import { HOJAS_MAX } from "./limites";
import { templateKeyOf } from "@/lib/template-v2/keyed-template";
import { medidaPliegoDe, type FotolibroVendido } from "./venta";

/**
 * El fotolibro que se vende en el Cobrador: se crea (antes de cobrar, con el botón del renglón, o
 * solo al cobrar) y queda atado al trabajo del pedido. El vínculo vive en `metaJson.fotolibro.venta`
 * de la versión con la que nació el fotolibro: las versiones nuevas que guarda el editor no lo
 * necesitan, y la primera no se borra.
 */

export type VentaDelFotolibro = { pedidoId: string; pedidoNumero: string; proyectoId: string };

const pesos = (minor: number) => (Math.round(minor) / 100).toFixed(2);

function nombreDelFotolibro(e: Pick<FotolibroVendido, "modelo" | "medida">, cliente: string | null): string {
  return `Fotolibro ${e.modelo} ${e.medida}${cliente ? ` · ${cliente}` : ""}`;
}

/** Crea el fotolibro vacío con la medida, las hojas y el laboratorio elegidos en la calculadora. */
export async function crearFotolibroDeVenta(input: {
  workspaceId: string;
  userId: number;
  eleccion: Pick<FotolibroVendido, "proveedorId" | "modelo" | "medida" | "hojas">;
  cliente: string | null;
}): Promise<{ ok: true; templateId: string; url: string } | { ok: false; error: string }> {
  const medidaId = medidaPliegoDe(input.eleccion.modelo, input.eleccion.medida);
  if (!medidaId) return { ok: false, error: `El editor todavía no tiene la medida ${input.eleccion.medida}.` };
  if (input.eleccion.hojas > HOJAS_MAX) return { ok: false, error: `El editor arma hasta ${HOJAS_MAX} hojas.` };
  const r = await crearFotolibro({
    workspaceId: input.workspaceId,
    userId: input.userId,
    medidaId,
    hojas: input.eleccion.hojas,
    proveedorId: input.eleccion.proveedorId,
    nombre: nombreDelFotolibro(input.eleccion, input.cliente),
  });
  if (!r.ok) return r;
  return { ok: true, templateId: r.templateId, url: templateV2EditorPath(FOTOLIBROS_BASE_PATH, r.templateId, r.versionId) };
}

/** La primera versión del fotolibro, si es un fotolibro de este workspace. */
async function versionInicial(workspaceId: string, templateId: string) {
  const t = await prisma.templateV2.findFirst({ where: { id: templateId, workspaceId }, select: { id: true } });
  if (!t) return null;
  const v = await prisma.templateV2Version.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "asc" },
    select: { id: true, metaJson: true },
  });
  return v && templateKeyOf(v.metaJson) === FOTOLIBRO_TEMPLATE_KEY ? v : null;
}

/**
 * Después de crear el pedido: cada libro vendido se ata a su trabajo. Si no se creó antes de
 * cobrar, se crea ahora. El trabajo queda con el laboratorio, el costo (libro + caja) y la
 * descripción de lo vendido. No corta el cobro: lo que falle vuelve como aviso.
 */
export async function atarFotolibrosAlPedido(input: {
  workspaceId: string;
  userId: number;
  pedidoId: string;
  pedidoNumero: string;
  cliente: string | null;
  libros: { itemIndex: number; fotolibro: FotolibroVendido }[];
}): Promise<string[]> {
  const avisos: string[] = [];
  for (const { itemIndex, fotolibro: f } of input.libros) {
    const trabajo = await prisma.fotofficeProyecto.findFirst({
      where: { workspaceId: input.workspaceId, pedidoId: input.pedidoId, pedidoItemIndex: itemIndex },
      orderBy: { createdAt: "asc" },
      select: { id: true, description: true },
    });
    if (!trabajo) {
      avisos.push(`El fotolibro ${f.modelo} ${f.medida} no tiene trabajo en el pedido ${input.pedidoNumero}: revisá que el producto genere un trabajo.`);
      continue;
    }

    let templateId = f.templateId;
    let version = templateId ? await versionInicial(input.workspaceId, templateId) : null;
    if (!version) {
      const c = await crearFotolibroDeVenta({ workspaceId: input.workspaceId, userId: input.userId, eleccion: f, cliente: input.cliente });
      if (!c.ok) {
        avisos.push(`No se pudo crear el fotolibro del pedido ${input.pedidoNumero}: ${c.error}`);
        templateId = null;
      } else {
        templateId = c.templateId;
        version = await versionInicial(input.workspaceId, templateId);
      }
    }

    if (templateId && version) {
      const meta = (version.metaJson ?? {}) as Record<string, unknown>;
      const anterior = (meta.fotolibro ?? {}) as Record<string, unknown>;
      const venta: VentaDelFotolibro = { pedidoId: input.pedidoId, pedidoNumero: input.pedidoNumero, proyectoId: trabajo.id };
      await prisma.templateV2Version.update({
        where: { id: version.id },
        data: { metaJson: { ...meta, fotolibro: { ...anterior, venta, fotos: f.fotos } } as Prisma.InputJsonValue },
      });
      await prisma.templateV2.update({
        where: { id: templateId },
        data: { name: `${nombreDelFotolibro(f, input.cliente)} · Pedido ${input.pedidoNumero}`.slice(0, 200) },
      });
    }

    const proveedor = await prisma.fotofficeProveedor.findFirst({ where: { id: f.proveedorId, workspaceId: input.workspaceId }, select: { id: true } });
    const costo = f.costoMinor === null ? null : f.costoMinor + (f.cajaCostoMinor ?? 0);
    const detalle = `${f.modelo} ${f.medida} · ${f.hojas} ${f.hojas === 1 ? "hoja" : "hojas"}${f.fotos ? ` · ${f.fotos} fotos` : ""}${f.cajaCostoMinor !== null ? " · con caja" : ""}`;
    await prisma.fotofficeProyecto.update({
      where: { id: trabajo.id },
      data: {
        ...(proveedor ? { proveedorId: proveedor.id } : {}),
        ...(costo !== null ? { proveedorCostoArs: pesos(costo) } : {}),
        ...(trabajo.description ? {} : { description: `Fotolibro ${detalle}` }),
      },
    });
  }
  return avisos;
}

/** El fotolibro atado a un trabajo, para abrirlo desde su ficha. */
export async function fotolibroDelTrabajo(workspaceId: string, proyectoId: string): Promise<{ templateId: string; nombre: string; url: string } | null> {
  const versiones = await prisma.templateV2Version.findMany({
    where: { metaJson: { path: ["fotolibro", "venta", "proyectoId"], equals: proyectoId } },
    select: { templateId: true },
    take: 10,
  });
  if (versiones.length === 0) return null;
  const t = await prisma.templateV2.findFirst({
    where: { id: { in: versiones.map((v) => v.templateId) }, workspaceId, status: { not: "ARCHIVED" }, currentVersionId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, currentVersionId: true },
  });
  if (!t?.currentVersionId) return null;
  return { templateId: t.id, nombre: t.name, url: templateV2EditorPath(FOTOLIBROS_BASE_PATH, t.id, t.currentVersionId) };
}
