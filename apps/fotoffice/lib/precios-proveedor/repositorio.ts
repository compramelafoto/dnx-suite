import "server-only";
import { prisma, Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { normalizarTexto } from "./clave";
import type { AnalisisLista, RenglonLista } from "./csv";
import { emparejarSugeridos, proveedorDesdeTexto } from "./emparejar";
import { calibrarMargenPct, precioSugeridoMinor } from "./margen";
import { leerTramos, validarTramos, type TramoRedondeo } from "./redondeo";
import { armarVistaPrevia, type FilaVistaPrevia, type ProductoParaVista } from "./vista-previa";

/**
 * Costos, márgenes y listas de proveedores contra la base.
 *
 * Todo lleva `workspaceId` en el `where`. Los importes salen en centavos (`decimalArsToMinor`)
 * y el margen como número (`170` = costo × 2,7). Quien llama ya pasó por `requireSalesAdmin`.
 */

export const MARGEN_MAXIMO = 9999;

function aNumero(d: { toString(): string } | null): number | null {
  return d === null ? null : Number(d.toString());
}

function minorODecimal(d: { toString(): string } | null): number | null {
  return d === null ? null : decimalArsToMinor(d);
}

// ── Reglas del workspace ─────────────────────────────────────────────────────────────────

export async function leerTramosWorkspace(workspaceId: string): Promise<TramoRedondeo[]> {
  const r = await prisma.fotofficeReglaPrecios.findUnique({ where: { workspaceId }, select: { redondeo: true } });
  return leerTramos(r?.redondeo ?? null);
}

export async function guardarTramos(workspaceId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validarTramos(raw);
  if (!v.ok) return v;
  const redondeo = v.tramos as unknown as Prisma.InputJsonValue;
  await prisma.fotofficeReglaPrecios.upsert({
    where: { workspaceId },
    create: { workspaceId, redondeo },
    update: { redondeo },
  });
  return { ok: true };
}

// ── Costos y márgenes ────────────────────────────────────────────────────────────────────

export type FilaCosto = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  supplierName: string | null;
  preferredProveedorId: string | null;
  costMinor: number | null;
  priceMinor: number;
  marginPct: number | null;
  precioSugeridoMinor: number | null;
  variantesConPrecio: boolean;
};

const SELECT_COSTO = {
  id: true,
  name: true,
  categoryId: true,
  category: { select: { name: true } },
  supplierName: true,
  preferredProveedorId: true,
  costArs: true,
  priceArs: true,
  marginPct: true,
  variants: { where: { isActive: true, priceArs: { not: null } }, select: { id: true }, take: 1 },
} as const;

type RegistroCosto = Prisma.ProductGetPayload<{ select: typeof SELECT_COSTO }>;

function aFilaCosto(r: RegistroCosto, tramos: readonly TramoRedondeo[]): FilaCosto {
  const costMinor = minorODecimal(r.costArs);
  const marginPct = aNumero(r.marginPct);
  return {
    id: r.id,
    name: r.name,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    supplierName: r.supplierName,
    preferredProveedorId: r.preferredProveedorId,
    costMinor,
    priceMinor: decimalArsToMinor(r.priceArs),
    marginPct,
    precioSugeridoMinor: costMinor !== null && marginPct !== null ? precioSugeridoMinor(costMinor, marginPct, tramos) : null,
    variantesConPrecio: r.variants.length > 0,
  };
}

export async function listarFilasCosto(
  workspaceId: string,
  f: { categoryId?: string; proveedorId?: string; soloSinCosto?: boolean } = {},
): Promise<FilaCosto[]> {
  const [tramos, filas] = await Promise.all([
    leerTramosWorkspace(workspaceId),
    prisma.product.findMany({
      where: {
        workspaceId,
        isActive: true,
        ...(f.categoryId ? { categoryId: f.categoryId } : {}),
        ...(f.proveedorId === "ninguno" ? { preferredProveedorId: null } : f.proveedorId ? { preferredProveedorId: f.proveedorId } : {}),
        ...(f.soloSinCosto ? { costArs: null } : {}),
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: SELECT_COSTO,
    }),
  ]);
  return filas.map((r) => aFilaCosto(r, tramos));
}

async function proveedorPropio(workspaceId: string, proveedorId: string | null): Promise<boolean> {
  if (proveedorId === null) return true;
  return (await prisma.fotofficeProveedor.count({ where: { id: proveedorId, workspaceId } })) > 0;
}

export type CambiosFilaCosto = {
  preferredProveedorId?: string | null;
  costMinor?: number | null;
  marginPct?: number | null;
  priceMinor?: number;
};

/**
 * Editar una fila de la tabla. La regla (spec §14):
 * - cambiar costo o margen con los dos cargados recalcula el precio;
 * - cambiar el precio a mano con costo cargado recalcula el margen (es una recalibración).
 */
export async function guardarFilaCosto(
  workspaceId: string,
  productId: string,
  cambios: CambiosFilaCosto,
): Promise<{ ok: true; fila: FilaCosto } | { ok: false; error: string }> {
  const actual = await prisma.product.findFirst({ where: { id: productId, workspaceId }, select: SELECT_COSTO });
  if (!actual) return { ok: false, error: "Ese producto no existe." };
  if (cambios.preferredProveedorId !== undefined && !(await proveedorPropio(workspaceId, cambios.preferredProveedorId))) {
    return { ok: false, error: "Ese proveedor no existe." };
  }
  if (cambios.marginPct != null && (!Number.isFinite(cambios.marginPct) || cambios.marginPct < 0 || cambios.marginPct > MARGEN_MAXIMO)) {
    return { ok: false, error: `El margen tiene que estar entre 0 y ${MARGEN_MAXIMO} %.` };
  }
  if (cambios.costMinor != null && (!Number.isInteger(cambios.costMinor) || cambios.costMinor < 0)) {
    return { ok: false, error: "El costo no se entiende." };
  }
  if (cambios.priceMinor !== undefined && (!Number.isInteger(cambios.priceMinor) || cambios.priceMinor < 0)) {
    return { ok: false, error: "El precio no se entiende." };
  }

  const tramos = await leerTramosWorkspace(workspaceId);
  let costMinor = cambios.costMinor !== undefined ? cambios.costMinor : minorODecimal(actual.costArs);
  let marginPct = cambios.marginPct !== undefined ? (cambios.marginPct === null ? null : Math.round(cambios.marginPct * 100) / 100) : aNumero(actual.marginPct);
  let priceMinor = decimalArsToMinor(actual.priceArs);

  if (cambios.priceMinor !== undefined) {
    priceMinor = cambios.priceMinor;
    const calibrado = calibrarMargenPct(priceMinor, costMinor);
    if (calibrado !== null && marginPct !== null) marginPct = calibrado;
  } else if ((cambios.costMinor !== undefined || cambios.marginPct !== undefined) && costMinor !== null && marginPct !== null) {
    priceMinor = precioSugeridoMinor(costMinor, marginPct, tramos);
  }
  costMinor = costMinor ?? null;

  const costoCambio = cambios.costMinor !== undefined && cambios.costMinor !== minorODecimal(actual.costArs);
  const r = await prisma.product.update({
    where: { id: actual.id },
    data: {
      ...(cambios.preferredProveedorId !== undefined ? { preferredProveedorId: cambios.preferredProveedorId } : {}),
      costArs: costMinor === null ? null : minorToDecimalString(costMinor),
      marginPct: marginPct === null ? null : marginPct.toFixed(2),
      priceArs: minorToDecimalString(priceMinor),
      ...(costoCambio ? { costUpdatedAt: new Date() } : {}),
    },
    select: SELECT_COSTO,
  });
  return { ok: true, fila: aFilaCosto(r, tramos) };
}

export async function asignarProveedorMasivo(workspaceId: string, productIds: string[], proveedorId: string | null): Promise<number> {
  if (!(await proveedorPropio(workspaceId, proveedorId))) return 0;
  const r = await prisma.product.updateMany({ where: { workspaceId, id: { in: productIds } }, data: { preferredProveedorId: proveedorId } });
  return r.count;
}

/** Deduce el margen de cada producto desde su precio actual. No cambia ningún precio. */
export async function calibrarMargenes(workspaceId: string, productIds: string[]): Promise<{ calibrados: number; sinCosto: number }> {
  const productos = await prisma.product.findMany({
    where: { workspaceId, id: { in: productIds } },
    select: { id: true, costArs: true, priceArs: true },
  });
  let sinCosto = 0;
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const p of productos) {
    const m = calibrarMargenPct(decimalArsToMinor(p.priceArs), minorODecimal(p.costArs));
    if (m === null) {
      sinCosto += 1;
      continue;
    }
    updates.push(prisma.product.update({ where: { id: p.id }, data: { marginPct: Math.min(m, MARGEN_MAXIMO).toFixed(2) } }));
  }
  if (updates.length > 0) await prisma.$transaction(updates);
  return { calibrados: updates.length, sinCosto };
}

/** Lleva el precio al sugerido (costo × margen, redondeado) en los productos elegidos que tienen los dos. */
export async function aplicarPrecioSugerido(workspaceId: string, productIds: string[]): Promise<number> {
  const tramos = await leerTramosWorkspace(workspaceId);
  const productos = await prisma.product.findMany({
    where: { workspaceId, id: { in: productIds }, costArs: { not: null }, marginPct: { not: null } },
    select: { id: true, costArs: true, marginPct: true },
  });
  const updates = productos.map((p) =>
    prisma.product.update({
      where: { id: p.id },
      data: { priceArs: minorToDecimalString(precioSugeridoMinor(decimalArsToMinor(p.costArs!), aNumero(p.marginPct)!, tramos)) },
    }),
  );
  if (updates.length > 0) await prisma.$transaction(updates);
  return updates.length;
}

// ── Unir el texto libre con Proveedores ──────────────────────────────────────────────────

export type SugerenciaUnion = { texto: string; productos: number; proveedorId: string | null };

export async function sugerenciasUnionProveedores(workspaceId: string): Promise<SugerenciaUnion[]> {
  const [grupos, proveedores] = await Promise.all([
    prisma.product.groupBy({
      by: ["supplierName"],
      where: { workspaceId, isActive: true, preferredProveedorId: null, supplierName: { not: null } },
      _count: { _all: true },
    }),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
  ]);
  return grupos
    .filter((g) => g.supplierName && g.supplierName.trim() !== "")
    .map((g) => ({ texto: g.supplierName!, productos: g._count._all, proveedorId: proveedorDesdeTexto(g.supplierName, proveedores) }))
    .sort((a, b) => b.productos - a.productos);
}

/**
 * Para cada texto ("LA ISLA"), los productos SIN preferido que lo tienen pasan a ese proveedor.
 * `crear` da de alta el proveedor con ese nombre si no existe. `null` deja el texto sin unir.
 */
export async function unirProveedores(
  workspaceId: string,
  pares: { texto: string; proveedorId: string | null; crear?: boolean }[],
): Promise<number> {
  let total = 0;
  for (const par of pares) {
    let proveedorId = par.proveedorId;
    if (par.crear) {
      const nombre = par.texto.trim();
      const existentes = await prisma.fotofficeProveedor.findMany({ where: { workspaceId }, select: { id: true, name: true } });
      proveedorId =
        proveedorDesdeTexto(nombre, existentes) ??
        (await prisma.fotofficeProveedor.create({ data: { workspaceId, name: nombre }, select: { id: true } })).id;
    }
    if (!proveedorId || !(await proveedorPropio(workspaceId, proveedorId))) continue;
    const r = await prisma.product.updateMany({
      where: { workspaceId, preferredProveedorId: null, supplierName: par.texto },
      data: { preferredProveedorId: proveedorId },
    });
    total += r.count;
  }
  return total;
}

// ── Listas de proveedores ────────────────────────────────────────────────────────────────

/** Con código del proveedor, el código manda (sobrevive a cambios de nombre en la lista). */
export function claveEquivalencia(r: Pick<RenglonLista, "clave" | "codigoProveedor">): string {
  return r.codigoProveedor ? `cod:${normalizarTexto(r.codigoProveedor)}` : r.clave;
}

export async function crearLista(
  workspaceId: string,
  userId: number,
  proveedorId: string,
  nombreArchivo: string | null,
  analisis: AnalisisLista,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (analisis.errorGeneral) return { ok: false, error: analisis.errorGeneral };
  if (analisis.renglones.length === 0) return { ok: false, error: "La lista no tiene ningún renglón válido." };
  const proveedor = await prisma.fotofficeProveedor.findFirst({ where: { id: proveedorId, workspaceId }, select: { id: true } });
  if (!proveedor) return { ok: false, error: "Ese proveedor no existe." };

  const [equivalencias, productos] = await Promise.all([
    prisma.fotofficeEquivalenciaProveedor.findMany({
      where: { workspaceId, proveedorId, product: { isActive: true } },
      select: { clave: true, productId: true, factor: true },
    }),
    prisma.product.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
  ]);

  // Primero lo recordado de listas anteriores; después, sugerencias para lo que quede.
  const porClave = new Map<string, { productId: string; factor: string }[]>();
  for (const e of equivalencias) porClave.set(e.clave, [...(porClave.get(e.clave) ?? []), { productId: e.productId, factor: e.factor.toString() }]);
  const tomados = new Set<string>();
  const asignado = new Map<string, { productId: string; factor: string }[]>();
  for (const r of analisis.renglones) {
    const recordados = (porClave.get(claveEquivalencia(r)) ?? []).filter((e) => !tomados.has(e.productId));
    if (recordados.length === 0) continue;
    asignado.set(r.clave, recordados);
    for (const e of recordados) tomados.add(e.productId);
  }
  const sugeridos = emparejarSugeridos(
    analisis.renglones.filter((r) => !asignado.has(r.clave)),
    productos.map((p) => ({ id: p.id, name: p.name, categoryName: p.category?.name ?? null })),
    tomados,
  );
  for (const [clave, ids] of sugeridos) asignado.set(clave, ids.map((productId) => ({ productId, factor: "1" })));

  const lista = await prisma.$transaction(
    async (tx) => {
      const l = await tx.fotofficeListaProveedor.create({
        data: {
          workspaceId,
          proveedorId,
          vigencia: analisis.vigencia ?? new Date().toISOString().slice(0, 7),
          nombreArchivo,
          creadaPorUserId: userId,
        },
        select: { id: true },
      });
      const items = await tx.fotofficeListaProveedorItem.createManyAndReturn({
        data: analisis.renglones.map((r) => ({
          listaId: l.id,
          fila: r.fila,
          tipo: r.tipo,
          categoria: r.categoria,
          producto: r.producto,
          modelo: r.modelo,
          medida: r.medida,
          variante: r.variante,
          cantidadMinima: r.cantidadMinima,
          unidad: r.unidad,
          costoArs: minorToDecimalString(r.costoMinor),
          codigoProveedor: r.codigoProveedor,
          notas: r.notas,
          clave: r.clave,
        })),
        select: { id: true, clave: true },
      });
      const emparejamientos = items.flatMap((it) =>
        (asignado.get(it.clave) ?? []).map((a) => ({ listaId: l.id, itemId: it.id, productId: a.productId, factor: a.factor })),
      );
      if (emparejamientos.length > 0) await tx.fotofficeListaProveedorEmparejamiento.createMany({ data: emparejamientos, skipDuplicates: true });
      return l;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return { ok: true, id: lista.id };
}

export type ResumenLista = {
  id: string;
  proveedorId: string;
  proveedor: string;
  vigencia: string;
  estado: string;
  nombreArchivo: string | null;
  createdAt: Date;
  aplicadaAt: Date | null;
  renglones: number;
  productos: number;
};

export async function listarListas(workspaceId: string): Promise<ResumenLista[]> {
  const listas = await prisma.fotofficeListaProveedor.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      proveedorId: true,
      proveedor: { select: { name: true } },
      vigencia: true,
      estado: true,
      nombreArchivo: true,
      createdAt: true,
      aplicadaAt: true,
      _count: { select: { items: true, emparejamientos: true } },
    },
  });
  return listas.map((l) => ({
    id: l.id,
    proveedorId: l.proveedorId,
    proveedor: l.proveedor.name,
    vigencia: l.vigencia,
    estado: l.estado,
    nombreArchivo: l.nombreArchivo,
    createdAt: l.createdAt,
    aplicadaAt: l.aplicadaAt,
    renglones: l._count.items,
    productos: l._count.emparejamientos,
  }));
}

export type EmparejamientoItem = { productId: string; factor: number; recordado: boolean };

export type ItemLista = {
  id: string;
  fila: number;
  tipo: string;
  categoria: string;
  producto: string;
  modelo: string | null;
  medida: string | null;
  variante: string | null;
  cantidadMinima: number | null;
  unidad: string;
  costoMinor: number;
  codigoProveedor: string | null;
  notas: string | null;
  productos: EmparejamientoItem[];
};

export type DetalleLista = {
  id: string;
  proveedorId: string;
  proveedor: string;
  vigencia: string;
  estado: string;
  nombreArchivo: string | null;
  aplicadaAt: Date | null;
  items: ItemLista[];
};

export async function leerLista(workspaceId: string, listaId: string): Promise<DetalleLista | null> {
  const l = await prisma.fotofficeListaProveedor.findFirst({
    where: { id: listaId, workspaceId },
    select: {
      id: true,
      proveedorId: true,
      proveedor: { select: { name: true } },
      vigencia: true,
      estado: true,
      nombreArchivo: true,
      aplicadaAt: true,
      items: { orderBy: { fila: "asc" }, include: { emparejamientos: { select: { productId: true, factor: true } } } },
    },
  });
  if (!l) return null;
  const equivalencias = await prisma.fotofficeEquivalenciaProveedor.findMany({
    where: { workspaceId, proveedorId: l.proveedorId },
    select: { clave: true, productId: true },
  });
  const recordadas = new Set(equivalencias.map((e) => `${e.clave}→${e.productId}`));
  return {
    id: l.id,
    proveedorId: l.proveedorId,
    proveedor: l.proveedor.name,
    vigencia: l.vigencia,
    estado: l.estado,
    nombreArchivo: l.nombreArchivo,
    aplicadaAt: l.aplicadaAt,
    items: l.items.map((i) => ({
      id: i.id,
      fila: i.fila,
      tipo: i.tipo,
      categoria: i.categoria,
      producto: i.producto,
      modelo: i.modelo,
      medida: i.medida,
      variante: i.variante,
      cantidadMinima: i.cantidadMinima,
      unidad: i.unidad,
      costoMinor: decimalArsToMinor(i.costoArs),
      codigoProveedor: i.codigoProveedor,
      notas: i.notas,
      productos: i.emparejamientos.map((e) => ({
        productId: e.productId,
        factor: Number(e.factor.toString()),
        recordado: recordadas.has(`${claveEquivalencia(i)}→${e.productId}`),
      })),
    })),
  };
}

async function itemEditable(workspaceId: string, itemId: string) {
  const item = await prisma.fotofficeListaProveedorItem.findFirst({
    where: { id: itemId, lista: { workspaceId } },
    select: { id: true, listaId: true, lista: { select: { estado: true } } },
  });
  if (!item) return { ok: false as const, error: "Ese renglón no existe." };
  if (item.lista.estado !== "BORRADOR") return { ok: false as const, error: "Esta lista ya no se puede cambiar." };
  return { ok: true as const, item };
}

/**
 * Suma un producto a un renglón (o le cambia el factor). Un producto toma su costo de un solo
 * renglón por lista: si estaba en otro renglón, pasa a éste.
 */
export async function emparejarProducto(
  workspaceId: string,
  itemId: string,
  productId: string,
  factor: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 100_000) return { ok: false, error: "El factor tiene que ser mayor que cero." };
  const e = await itemEditable(workspaceId, itemId);
  if (!e.ok) return e;
  if ((await prisma.product.count({ where: { id: productId, workspaceId } })) === 0) return { ok: false, error: "Ese producto no existe." };
  await prisma.fotofficeListaProveedorEmparejamiento.upsert({
    where: { listaId_productId: { listaId: e.item.listaId, productId } },
    create: { listaId: e.item.listaId, itemId, productId, factor: factor.toFixed(4) },
    update: { itemId, factor: factor.toFixed(4) },
  });
  return { ok: true };
}

export async function soltarProducto(workspaceId: string, itemId: string, productId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = await itemEditable(workspaceId, itemId);
  if (!e.ok) return e;
  await prisma.fotofficeListaProveedorEmparejamiento.deleteMany({ where: { listaId: e.item.listaId, itemId, productId } });
  return { ok: true };
}

type EmparejamientoConCosto = { productId: string; factor: { toString(): string }; item: { costoArs: { toString(): string } } };

async function vistaPreviaCon(
  db: Prisma.TransactionClient | typeof prisma,
  workspaceId: string,
  proveedorId: string,
  emparejamientos: EmparejamientoConCosto[],
): Promise<FilaVistaPrevia[]> {
  const [tramos, productos] = await Promise.all([
    leerTramosWorkspace(workspaceId),
    db.product.findMany({
      where: { workspaceId, id: { in: emparejamientos.map((e) => e.productId) } },
      select: SELECT_COSTO,
    }),
  ]);
  const mapa = new Map<string, ProductoParaVista>(
    productos.map((p) => [
      p.id,
      {
        name: p.name,
        costMinor: minorODecimal(p.costArs),
        priceMinor: decimalArsToMinor(p.priceArs),
        marginPct: aNumero(p.marginPct),
        preferredProveedorId: p.preferredProveedorId,
        variantesConPrecio: p.variants.length > 0,
      },
    ]),
  );
  return armarVistaPrevia(
    emparejamientos.map((e) => ({ productId: e.productId, costoMinor: decimalArsToMinor(e.item.costoArs), factor: Number(e.factor.toString()) })),
    mapa,
    proveedorId,
    tramos,
  );
}

const SELECT_EMPAREJAMIENTO = { productId: true, factor: true, item: { select: { costoArs: true, clave: true, codigoProveedor: true } } } as const;

export async function vistaPreviaLista(workspaceId: string, listaId: string): Promise<FilaVistaPrevia[]> {
  const l = await prisma.fotofficeListaProveedor.findFirst({
    where: { id: listaId, workspaceId },
    select: { proveedorId: true, emparejamientos: { select: SELECT_EMPAREJAMIENTO } },
  });
  if (!l) return [];
  return vistaPreviaCon(prisma, workspaceId, l.proveedorId, l.emparejamientos);
}

/**
 * Aplicar la lista: actualiza costo (y precio, si hay margen) de los productos cuyo preferido
 * es este proveedor, y recuerda todos los emparejamientos para la próxima lista.
 */
export async function aplicarLista(
  workspaceId: string,
  listaId: string,
  userId: number,
): Promise<{ ok: true; actualizados: number } | { ok: false; error: string }> {
  return prisma.$transaction(
    async (tx) => {
      const l = await tx.fotofficeListaProveedor.findFirst({
        where: { id: listaId, workspaceId },
        select: { id: true, estado: true, proveedorId: true, emparejamientos: { select: SELECT_EMPAREJAMIENTO } },
      });
      if (!l) return { ok: false as const, error: "Esa lista no existe." };
      // Que otra pestaña no la aplique dos veces: el cambio de estado va primero y condicionado.
      const marcada = await tx.fotofficeListaProveedor.updateMany({
        where: { id: l.id, estado: "BORRADOR" },
        data: { estado: "APLICADA", aplicadaAt: new Date(), aplicadaPorUserId: userId },
      });
      if (marcada.count === 0) return { ok: false as const, error: "Esta lista ya fue aplicada o descartada." };

      const filas = await vistaPreviaCon(tx, workspaceId, l.proveedorId, l.emparejamientos);
      const ahora = new Date();
      let actualizados = 0;
      for (const f of filas) {
        if (!f.aplica) continue;
        await tx.product.update({
          where: { id: f.productId },
          data: {
            costArs: minorToDecimalString(f.costoNuevoMinor),
            priceArs: minorToDecimalString(f.precioNuevoMinor),
            ...(f.costoAntesMinor !== f.costoNuevoMinor ? { costUpdatedAt: ahora } : {}),
          },
        });
        actualizados += 1;
      }

      for (const e of l.emparejamientos) {
        const clave = claveEquivalencia(e.item);
        await tx.fotofficeEquivalenciaProveedor.upsert({
          where: { workspaceId_proveedorId_productId: { workspaceId, proveedorId: l.proveedorId, productId: e.productId } },
          create: { workspaceId, proveedorId: l.proveedorId, clave, productId: e.productId, factor: e.factor.toString() },
          update: { clave, factor: e.factor.toString() },
        });
      }
      return { ok: true as const, actualizados };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

export async function descartarLista(workspaceId: string, listaId: string): Promise<boolean> {
  const r = await prisma.fotofficeListaProveedor.updateMany({ where: { id: listaId, workspaceId, estado: "BORRADOR" }, data: { estado: "DESCARTADA" } });
  return r.count > 0;
}
