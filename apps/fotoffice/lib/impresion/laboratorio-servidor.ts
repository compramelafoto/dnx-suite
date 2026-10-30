import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { leerProductosDeCopia, type ProductoCopia } from "@/lib/impresiones/catalogo-copias";
import { aspectoCoincide } from "./encuadre";
import { huellaDe } from "./huella";
import {
  CANTIDAD_MAX_LAB,
  medidaEnMm,
  opcionesDelCatalogo,
  renglonesDelPedido,
  type OpcionesLab,
  type PapelLab,
  type PiezaLab,
  type PlazoLab,
  type RenglonLab,
} from "./laboratorio";
import { borrarObjetos, enteroEntre, esId, preparacionPropia, type CtxImpresion, type R } from "./preparaciones";
import { validarReceta, type Receta } from "./receta";

/**
 * Preparar para laboratorio: cada foto de la preparación (destino LABORATORIO) lleva una pieza COPIA
 * con medida, plazo, papel y cantidad. No arma hojas: al cobrar, el pedido sale de estas piezas.
 */

const NO_EXISTE = { ok: false as const, error: "Esa preparación no existe." };
const FOTO_NO_EXISTE = { ok: false as const, error: "Esa foto no existe." };
const RECORTE_INVALIDO = { ok: false as const, error: "El recorte de una foto no es válido. Volvé a armarla." };

export type FotoLab = {
  originalId: string;
  nombre: string;
  vista: string | null;
  ancho: number;
  alto: number;
  pieza: (PiezaLab & { receta: Receta; revisada: boolean }) | null;
};
export type EstadoLab = { preparacionId: string; fotos: FotoLab[]; opciones: OpcionesLab };

export type PiezaLabEntrada = { originalId: string; medida: unknown; plazo: unknown; papel: unknown; cantidad: unknown; receta: unknown; revisada: boolean };

const PLAZOS: readonly string[] = ["MANANA", "SEMANA"];
const PAPELES: readonly string[] = ["MATE", "BRILLO"];

export async function crearPreparacionLaboratorio(ctx: CtxImpresion, d: { clientId: string | null }): Promise<R<{ id: string }>> {
  let clientId: string | null = null;
  if (esId(d.clientId)) {
    const cliente = await prisma.client.findFirst({ where: { id: d.clientId, workspaceId: ctx.workspaceId }, select: { id: true } });
    clientId = cliente?.id ?? null;
  }
  const p = await prisma.fotofficePreparacionImpresion.create({
    data: { workspaceId: ctx.workspaceId, productId: null, clientId, destino: "LABORATORIO", estado: "PREPARANDO", createdByUserId: ctx.userId },
    select: { id: true },
  });
  return { ok: true, id: p.id };
}

/** La preparación, si es de laboratorio y todavía se puede editar (ni anulada ni ya cobrada). */
async function preparacionLab(workspaceId: string, id: unknown) {
  const prep = await preparacionPropia(workspaceId, id);
  if (!prep || prep.destino !== "LABORATORIO" || prep.estado === "ANULADA" || prep.estado === "LISTA") return null;
  return prep;
}

/** Los productos de copias del catálogo (activos del negocio) y el laboratorio de cada uno. */
async function leerCatalogo(workspaceId: string): Promise<{ catalogo: ProductoCopia[]; proveedorDeProducto: Map<string, string | null>; nombres: Map<string, string> }> {
  const filas = await prisma.product.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, priceArs: true, costArs: true, preferredProveedorId: true },
  });
  const catalogo = leerProductosDeCopia(
    filas.map((p) => ({ id: p.id, name: p.name, priceArs: Number(p.priceArs), costArs: p.costArs === null ? null : Number(p.costArs), preferredProveedorId: p.preferredProveedorId })),
  );
  const ids = catalogo.map((p) => p.id);
  const reglas = ids.length
    ? await prisma.fotofficeProductoProyecto.findMany({ where: { workspaceId, productId: { in: ids } }, orderBy: { order: "asc" }, select: { productId: true, proveedorId: true } })
    : [];
  const proveedorDeProducto = new Map<string, string | null>();
  for (const r of reglas) if (r.proveedorId && !proveedorDeProducto.has(r.productId)) proveedorDeProducto.set(r.productId, r.proveedorId);
  return { catalogo, proveedorDeProducto, nombres: new Map(filas.map((p) => [p.id, p.name])) };
}

async function leerOpciones(workspaceId: string, catalogo: ProductoCopia[]): Promise<OpcionesLab> {
  const ajustes = await prisma.fotofficePrintSettings.findUnique({ where: { workspaceId }, select: { paperGlossy: true, paperMatte: true } });
  return opcionesDelCatalogo(catalogo, ajustes ? { mate: ajustes.paperMatte, brillo: ajustes.paperGlossy } : null);
}

export async function estadoLaboratorio(ctx: CtxImpresion, preparacionId: string): Promise<EstadoLab | null> {
  const prep = await preparacionLab(ctx.workspaceId, preparacionId);
  if (!prep) return null;
  const [{ catalogo }, originales, piezas] = await Promise.all([
    leerCatalogo(ctx.workspaceId),
    prisma.fotofficeOriginalImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, nombre: true, anchoPx: true, altoPx: true, previewKey: true },
    }),
    prisma.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA" },
      select: { originalId: true, receta: true, cantidad: true, revisadaAt: true, medida: true, plazo: true, papel: true },
    }),
  ]);
  const opciones = await leerOpciones(ctx.workspaceId, catalogo);
  const fotos = originales.map((o): FotoLab => {
    const p = piezas.find((x) => x.originalId === o.id);
    const receta = p ? validarReceta(p.receta) : null;
    const pieza =
      p && receta && p.medida && p.plazo && p.papel && PLAZOS.includes(p.plazo) && PAPELES.includes(p.papel)
        ? { originalId: o.id, medida: p.medida, plazo: p.plazo as PlazoLab, papel: p.papel as PapelLab, cantidad: p.cantidad, receta, revisada: p.revisadaAt !== null }
        : null;
    return { originalId: o.id, nombre: o.nombre, vista: o.previewKey ? `/api/impresion/vista/${o.id}` : null, ancho: o.anchoPx, alto: o.altoPx, pieza };
  });
  return { preparacionId: prep.id, fotos, opciones };
}

export async function guardarPiezasLaboratorio(ctx: CtxImpresion, preparacionId: string, items: PiezaLabEntrada[]): Promise<R<{ guardadas: number }>> {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "No hay fotos para guardar." };
  const prep = await preparacionLab(ctx.workspaceId, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!items.every((i) => i !== null && typeof i === "object")) return FOTO_NO_EXISTE;
  const ids = items.map((i) => i.originalId);
  if (!ids.every(esId) || new Set(ids).size !== ids.length) return FOTO_NO_EXISTE;
  const originales = await prisma.fotofficeOriginalImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", id: { in: ids } },
    select: { id: true, key: true, anchoPx: true, altoPx: true },
  });
  if (originales.length !== ids.length) return FOTO_NO_EXISTE;

  const { catalogo } = await leerCatalogo(ctx.workspaceId);
  const opciones = await leerOpciones(ctx.workspaceId, catalogo);

  const filas: { originalId: string; medida: string; plazo: PlazoLab; papel: PapelLab; receta: Receta; cantidad: number; revisada: boolean; huella: string }[] = [];
  for (const it of items) {
    const op = typeof it.medida === "string" ? opciones.medidas.find((m) => m.medida === it.medida) : undefined;
    const papelMm = op ? medidaEnMm(op.medida) : null;
    if (!op || !papelMm) return { ok: false, error: "Elegí un tamaño de la lista." };
    if (typeof it.plazo !== "string" || !PLAZOS.includes(it.plazo) || !op.plazos.includes(it.plazo as PlazoLab)) return { ok: false, error: "Elegí para cuándo la querés." };
    if (typeof it.papel !== "string" || !PAPELES.includes(it.papel) || !opciones.papeles.includes(it.papel as PapelLab)) return { ok: false, error: "Elegí el papel." };
    if (!enteroEntre(it.cantidad, 1, CANTIDAD_MAX_LAB)) return { ok: false, error: `Las copias de cada foto tienen que ser entre 1 y ${CANTIDAD_MAX_LAB}.` };
    const receta = validarReceta(it.receta);
    const o = originales.find((x) => x.id === it.originalId)!;
    if (!receta || !receta.orientacion || !aspectoCoincide({ ancho: o.anchoPx, alto: o.altoPx }, receta, papelMm)) return RECORTE_INVALIDO;
    filas.push({
      originalId: o.id,
      medida: op.medida,
      plazo: it.plazo as PlazoLab,
      papel: it.papel as PapelLab,
      receta,
      cantidad: it.cantidad,
      revisada: it.revisada === true,
      huella: huellaDe({ receta, originalKey: o.key, medida: op.medida, papel: it.papel }),
    });
  }

  const ahora = new Date();
  const error = await prisma.$transaction(async (tx) => {
    // Se vuelven a leer adentro: un `quitarFotoLaboratorio` simultáneo no deja una pieza sin original.
    const siguen = await tx.fotofficeOriginalImpresion.count({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", id: { in: ids } },
    });
    if (siguen !== ids.length) return FOTO_NO_EXISTE;
    const existentes = await tx.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId: { in: ids } },
      select: { id: true, originalId: true, huella: true, revisadaAt: true },
    });
    for (const f of filas) {
      const e = existentes.find((x) => x.originalId === f.originalId);
      const revisadaAt = f.revisada ? (e?.revisadaAt ?? ahora) : e && e.huella === f.huella ? e.revisadaAt : null;
      const data = {
        tamanoId: null,
        medida: f.medida,
        plazo: f.plazo,
        papel: f.papel,
        receta: f.receta as unknown as Prisma.InputJsonValue,
        huella: f.huella,
        cantidad: f.cantidad,
        revisadaAt,
      };
      if (e) await tx.fotofficePiezaImpresion.update({ where: { id: e.id }, data });
      else await tx.fotofficePiezaImpresion.create({ data: { workspaceId: ctx.workspaceId, preparacionId: prep.id, originalId: f.originalId, tipo: "COPIA", ...data } });
    }
    return null;
    // Hasta 200 fotos en una llamada: una ida y vuelta por fila supera los 5 s por omisión de Prisma.
  }, { timeout: 30_000, maxWait: 10_000 });
  if (error) return error;
  return { ok: true, guardadas: filas.length };
}

export async function quitarFotoLaboratorio(ctx: CtxImpresion, preparacionId: string, originalId: string): Promise<R> {
  const prep = await preparacionLab(ctx.workspaceId, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id },
    select: { id: true, key: true, previewKey: true, archivoTrabajoId: true },
  });
  if (!o) return FOTO_NO_EXISTE;
  await prisma.$transaction(async (tx) => {
    await tx.fotofficePiezaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, originalId: o.id } });
    await tx.fotofficeOriginalImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: o.id } });
  });
  // El original que vino de la carpeta de un trabajo no es nuestro: no se borra.
  await borrarObjetos([o.archivoTrabajoId ? null : o.key, o.previewKey]);
  return { ok: true };
}

export type PiezaDeRenglon = { id: string; originalId: string; medida: string; papel: PapelLab; cantidad: number };

/**
 * Los renglones del ticket de la preparación (uno por producto del catálogo). Exige al menos una
 * pieza y que TODA foto LISTO tenga la suya. Las subidas a medias (PENDIENTE) no cuentan.
 */
export async function renglonesDeLaPreparacion(
  workspaceId: string,
  preparacionId: string,
): Promise<{ ok: true; renglones: RenglonLab[]; plazoFinal: Map<string, PlazoLab>; piezas: PiezaDeRenglon[]; nombres: Map<string, string> } | { ok: false; error: string }> {
  const prep = await preparacionLab(workspaceId, preparacionId);
  if (!prep) return NO_EXISTE;
  const [originales, filas] = await Promise.all([
    prisma.fotofficeOriginalImpresion.findMany({ where: { workspaceId, preparacionId: prep.id, estado: "LISTO" }, select: { id: true } }),
    prisma.fotofficePiezaImpresion.findMany({
      where: { workspaceId, preparacionId: prep.id, tipo: "COPIA" },
      select: { id: true, originalId: true, medida: true, plazo: true, papel: true, cantidad: true },
    }),
  ]);
  const vigentes = new Set(originales.map((o) => o.id));
  const piezas = filas.filter((p) => vigentes.has(p.originalId));
  if (piezas.length === 0) return { ok: false, error: "Subí al menos una foto." };
  const validas = piezas.filter((p) => p.medida && p.plazo && PLAZOS.includes(p.plazo) && p.papel && PAPELES.includes(p.papel));
  if (validas.length !== piezas.length || originales.some((o) => !piezas.some((p) => p.originalId === o.id))) {
    return { ok: false, error: "Hay fotos sin tamaño: completalas o quitalas." };
  }
  const { catalogo, proveedorDeProducto, nombres } = await leerCatalogo(workspaceId);
  const r = renglonesDelPedido(
    validas.map((p) => ({ originalId: p.originalId, medida: p.medida!, plazo: p.plazo as PlazoLab, papel: p.papel as PapelLab, cantidad: p.cantidad })),
    catalogo,
    proveedorDeProducto,
  );
  if (!r.ok) return r;
  return {
    ok: true,
    renglones: r.renglones,
    plazoFinal: r.plazoFinal,
    piezas: validas.map((p) => ({ id: p.id, originalId: p.originalId, medida: p.medida!, papel: p.papel as PapelLab, cantidad: p.cantidad })),
    nombres,
  };
}
