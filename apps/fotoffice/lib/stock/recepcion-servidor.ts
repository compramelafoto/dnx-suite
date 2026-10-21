import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { findGlobalByBarcode } from "@/lib/sales/global-catalog";
import { nextSaleNumber } from "@/lib/sales/sale-number";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import { ORIGENES_LINEA, SOURCE_MODULE_RECEPCION, type EstadoRecepcion, type OrigenLinea } from "./recepcion-constantes";
import {
  lineaParaEscaneo,
  movimientoDeLinea,
  totalRecepcionMinor,
  validarParaConfirmar,
  type LineaBorrador,
} from "./recepcion";

/**
 * Recepción de un pedido contra la base: el borrador (encabezado y líneas), el lector de
 * códigos y la confirmación, que es lo único que mueve stock.
 *
 * Toda escritura pasa por `enBorrador`: abre una transacción, bloquea la fila de la recepción
 * (`FOR UPDATE`) y exige que sea de este negocio y siga en BORRADOR. Así una línea que se edita
 * en una pestaña mientras otra confirma no se cuela después de confirmada, y dos clics en
 * "Confirmar" no suman dos veces: el segundo espera al primero y ya lee CONFIRMADA.
 *
 * Todo `productId` que llega a una línea se verifica: activo, de este negocio y sin talles
 * (la etapa 2 no maneja talles: un movimiento sin talle en un producto con talles descuadra la
 * suma de sus talles).
 */

type Tx = Prisma.TransactionClient;

const ERROR_NO_EXISTE = "Esa recepción no existe.";
const ERROR_PRODUCTO = "Ese producto no existe o está dado de baja.";
const ERROR_CON_TALLES = "Ese producto tiene talles: cargalo desde Stock.";
const ERROR_TALLE = "Ese código es de un talle: cargalo desde Stock.";
const ERROR_PRODUCTOS_CONFIRMAR = "Hay productos que ya no existen o están dados de baja: revisá las líneas.";
const ERROR_TALLES_CONFIRMAR = "Hay productos con talles: cargalos desde Stock.";
const ERROR_DESCONOCIDO = "Ese código no está en tu catálogo: dalo de alta.";

function errorDeEstado(estado: string | null): string {
  if (estado === null) return ERROR_NO_EXISTE;
  if (estado === "CONFIRMADA") return "Esa recepción ya está confirmada.";
  if (estado === "DESCARTADA") return "Esa recepción está descartada.";
  return "Esa recepción no se puede modificar.";
}

// ---------------------------------------------------------------------------------------------
// Tipos de lectura

export type ProductoDeLinea = {
  id: string;
  nombre: string;
  kind: string;
  /** Unidad de stock: la de la ficha de insumo, o "unidades". */
  unidad: string;
  costMinor: number | null;
  priceMinor: number;
  unidadCompra: string | null;
  unidadesPorCompra: number | null;
};

export type LineaDetalle = LineaBorrador & { producto: ProductoDeLinea | null };

export type RecepcionDetalle = {
  id: string;
  numero: number;
  estado: EstadoRecepcion;
  proveedorId: string | null;
  proveedorNombre: string | null;
  fecha: Date;
  comprobante: string | null;
  preciosConIva: boolean;
  nota: string | null;
  archivoKey: string | null;
  createdByUserId: number | null;
  confirmedAt: Date | null;
  confirmedByUserId: number | null;
  /** Último cambio: en una DESCARTADA, cuándo se descartó. */
  updatedAt: Date;
  lineas: LineaDetalle[];
  totalMinor: number;
};

export type RecepcionFila = {
  id: string;
  numero: number;
  estado: EstadoRecepcion;
  fecha: Date;
  proveedorNombre: string | null;
  comprobante: string | null;
  totalMinor: number;
  lineas: number;
  createdByUserId: number | null;
  confirmedAt: Date | null;
  confirmedByUserId: number | null;
};

const SELECT_LINEA = {
  id: true,
  productId: true,
  descripcionOriginal: true,
  codigoBarras: true,
  cantidad: true,
  enUnidadDeCompra: true,
  unidadesPorCompra: true,
  costoUnitarioArs: true,
  origen: true,
} as const;

type FilaLinea = {
  id: string;
  productId: string | null;
  descripcionOriginal: string;
  codigoBarras: string | null;
  cantidad: number;
  enUnidadDeCompra: boolean;
  unidadesPorCompra: number | null;
  costoUnitarioArs: { toString(): string } | null;
  origen: string;
};

function aLinea(f: FilaLinea): LineaBorrador {
  return {
    id: f.id,
    productId: f.productId,
    descripcionOriginal: f.descripcionOriginal,
    codigoBarras: f.codigoBarras,
    cantidad: f.cantidad,
    enUnidadDeCompra: f.enUnidadDeCompra,
    unidadesPorCompra: f.unidadesPorCompra,
    costoUnitarioMinor: f.costoUnitarioArs === null ? null : decimalArsToMinor(f.costoUnitarioArs),
    origen: f.origen as OrigenLinea,
  };
}

// ---------------------------------------------------------------------------------------------
// Lecturas

export async function leerRecepcion(workspaceId: string, id: string): Promise<RecepcionDetalle | null> {
  const r = await prisma.fotofficeRecepcion.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      numero: true,
      estado: true,
      proveedorId: true,
      fecha: true,
      comprobante: true,
      preciosConIva: true,
      nota: true,
      archivoKey: true,
      createdByUserId: true,
      confirmedAt: true,
      confirmedByUserId: true,
      updatedAt: true,
      proveedor: { select: { name: true } },
      lineas: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          ...SELECT_LINEA,
          product: {
            select: {
              id: true,
              name: true,
              kind: true,
              costArs: true,
              priceArs: true,
              fotofficeInsumo: { select: { unidad: true, unidadCompra: true, unidadesPorCompra: true } },
            },
          },
        },
      },
    },
  });
  if (!r) return null;

  const lineas: LineaDetalle[] = r.lineas.map((f) => ({
    ...aLinea(f),
    producto: f.product
      ? {
          id: f.product.id,
          nombre: f.product.name,
          kind: f.product.kind,
          unidad: f.product.fotofficeInsumo?.unidad ?? "unidades",
          costMinor: f.product.costArs === null ? null : decimalArsToMinor(f.product.costArs),
          priceMinor: decimalArsToMinor(f.product.priceArs),
          unidadCompra: f.product.fotofficeInsumo?.unidadCompra ?? null,
          unidadesPorCompra: f.product.fotofficeInsumo?.unidadesPorCompra ?? null,
        }
      : null,
  }));

  return {
    id: r.id,
    numero: r.numero,
    estado: r.estado as EstadoRecepcion,
    proveedorId: r.proveedorId,
    proveedorNombre: r.proveedor?.name ?? null,
    fecha: r.fecha,
    comprobante: r.comprobante,
    preciosConIva: r.preciosConIva,
    nota: r.nota,
    archivoKey: r.archivoKey,
    createdByUserId: r.createdByUserId,
    confirmedAt: r.confirmedAt,
    confirmedByUserId: r.confirmedByUserId,
    updatedAt: r.updatedAt,
    lineas,
    totalMinor: totalRecepcionMinor(lineas),
  };
}

/** Las últimas 50 (borradores y confirmadas; las descartadas no se listan). */
export async function listarRecepciones(workspaceId: string): Promise<RecepcionFila[]> {
  const filas = await prisma.fotofficeRecepcion.findMany({
    where: { workspaceId, estado: { not: "DESCARTADA" } },
    orderBy: { numero: "desc" },
    take: 50,
    select: {
      id: true,
      numero: true,
      estado: true,
      fecha: true,
      comprobante: true,
      createdByUserId: true,
      confirmedAt: true,
      confirmedByUserId: true,
      proveedor: { select: { name: true } },
      lineas: { select: SELECT_LINEA },
    },
  });
  return filas.map((r) => ({
    id: r.id,
    numero: r.numero,
    estado: r.estado as EstadoRecepcion,
    fecha: r.fecha,
    proveedorNombre: r.proveedor?.name ?? null,
    comprobante: r.comprobante,
    totalMinor: totalRecepcionMinor(r.lineas.map(aLinea)),
    lineas: r.lineas.length,
    createdByUserId: r.createdByUserId,
    confirmedAt: r.confirmedAt,
    confirmedByUserId: r.confirmedByUserId,
  }));
}

/**
 * Qué es un código para la recepción. A diferencia del Cobrador, incluye insumos: busca el
 * código de barras exacto (normalizado) o el código interno exacto, en productos activos del
 * negocio. Si es de un talle, lo dice (acá no se cargan talles); si no está, mira el catálogo
 * global para precargar el alta.
 */
export async function buscarParaRecepcion(
  workspaceId: string,
  codigo: string,
): Promise<
  | { tipo: "producto"; productId: string }
  | { tipo: "talle" }
  | { tipo: "global"; nombre: string; marca: string | null }
  | { tipo: "nada" }
> {
  const texto = codigo.trim();
  if (texto === "") return { tipo: "nada" };
  const barras = normalizeBarcode(texto);

  if (barras !== null) {
    const p = await prisma.product.findFirst({
      where: { workspaceId, isActive: true, barcode: barras },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (p) return { tipo: "producto", productId: p.id };
  }
  const porSku = await prisma.product.findFirst({
    where: { workspaceId, isActive: true, sku: texto },
    select: { id: true },
  });
  if (porSku) return { tipo: "producto", productId: porSku.id };

  const talle = await prisma.productVariant.findFirst({
    where: { workspaceId, OR: [...(barras !== null ? [{ barcode: barras }] : []), { sku: texto }] },
    select: { id: true },
  });
  if (talle) return { tipo: "talle" };

  if (barras !== null) {
    const global = await findGlobalByBarcode(barras);
    if (global) return { tipo: "global", nombre: global.name, marca: global.brand };
  }
  return { tipo: "nada" };
}

// ---------------------------------------------------------------------------------------------
// Escrituras del borrador

export async function crearBorrador(workspaceId: string, userId: number | null): Promise<{ id: string; numero: number }> {
  // Mismo patrón que el número de venta (`record-sale.ts`): leer el último, sumar uno y crear
  // con `ON CONFLICT DO NOTHING` (`createMany` + `skipDuplicates`). Si otra pestaña tomó el
  // número un instante antes, no hay error de SQL: se relee y se reintenta.
  for (let intento = 0; intento < 3; intento++) {
    const ultima = await prisma.fotofficeRecepcion.findFirst({
      where: { workspaceId },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const numero = nextSaleNumber(ultima?.numero ?? null);
    const r = await prisma.fotofficeRecepcion.createMany({
      data: [{ workspaceId, numero, fecha: new Date(), createdByUserId: userId }],
      skipDuplicates: true,
    });
    if (r.count === 1) {
      return prisma.fotofficeRecepcion.findUniqueOrThrow({
        where: { workspaceId_numero: { workspaceId, numero } },
        select: { id: true, numero: true },
      });
    }
  }
  throw new Error("No se pudo asignar un número de recepción después de tres intentos.");
}

/**
 * Corre `fn` en una transacción con la recepción bloqueada y en BORRADOR. La fila de la
 * recepción se bloquea primero, antes que cualquier fila de stock (mismo orden que el resto:
 * la tabla propia primero, después `lockStockRows`).
 */
/**
 * Opciones de la transacción de la recepción. Confirmar una recepción grande (150–200 líneas:
 * un movimiento, un update de producto y a veces el costo por línea) no entra en los 5 s por
 * omisión de Prisma, y al pasarse fallaría siempre. Mismo aire que Pedidos
 * (`OPCIONES_TRANSACCION_PEDIDO` en `lib/pedidos/constantes.ts`).
 */
export const OPCIONES_TRANSACCION_RECEPCION = { timeout: 15_000, maxWait: 5_000 } as const;

export async function enBorrador<T>(
  workspaceId: string,
  recepcionId: string,
  fn: (tx: Tx) => Promise<T | { ok: false; error: string }>,
): Promise<T | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearRecepcion(tx, workspaceId, recepcionId);
    if (estado !== "BORRADOR") return { ok: false as const, error: errorDeEstado(estado) };
    return fn(tx);
  }, OPCIONES_TRANSACCION_RECEPCION);
}

async function bloquearRecepcion(tx: Tx, workspaceId: string, recepcionId: string): Promise<string | null> {
  const filas = await tx.$queryRaw<{ id: string; estado: string }[]>`
    SELECT "id", "estado" FROM "FotofficeRecepcion"
    WHERE "id" = ${recepcionId} AND "workspaceId" = ${workspaceId}
    FOR UPDATE`;
  return filas[0]?.estado ?? null;
}

/** Producto válido para una línea: activo, de este negocio y sin talles. */
async function productoParaLinea(
  tx: Tx,
  workspaceId: string,
  productId: string,
): Promise<
  | { ok: true; nombre: string; unidadesPorCompra: number | null }
  | { ok: false; error: string }
> {
  const p = await tx.product.findFirst({
    where: { id: productId, workspaceId, isActive: true },
    select: { id: true, name: true, fotofficeInsumo: { select: { unidadesPorCompra: true } } },
  });
  if (!p) return { ok: false, error: ERROR_PRODUCTO };
  const talle = await tx.productVariant.findFirst({ where: { workspaceId, productId }, select: { id: true } });
  if (talle) return { ok: false, error: ERROR_CON_TALLES };
  const upc = p.fotofficeInsumo?.unidadesPorCompra ?? null;
  return { ok: true, nombre: p.name, unidadesPorCompra: upc !== null && upc >= 1 ? upc : null };
}

async function siguienteOrden(tx: Tx, recepcionId: string): Promise<number> {
  const ultima = await tx.fotofficeRecepcionLinea.findFirst({
    where: { recepcionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (ultima?.order ?? -1) + 1;
}

export async function escanear(
  workspaceId: string,
  recepcionId: string,
  codigo: string,
): Promise<
  | { ok: true; resultado: "sumado" | "agregado" }
  | { ok: false; error: string; alta?: { codigo: string; nombre?: string; marca?: string | null } }
> {
  const texto = codigo.trim();
  if (texto === "") return { ok: false, error: "Escaneá o escribí un código." };
  const codigoLimpio = normalizeBarcode(texto) ?? texto;

  const hallado = await buscarParaRecepcion(workspaceId, texto);
  if (hallado.tipo === "talle") return { ok: false, error: ERROR_TALLE };
  if (hallado.tipo === "global") {
    return { ok: false, error: ERROR_DESCONOCIDO, alta: { codigo: codigoLimpio, nombre: hallado.nombre, marca: hallado.marca } };
  }
  if (hallado.tipo === "nada") return { ok: false, error: ERROR_DESCONOCIDO, alta: { codigo: codigoLimpio } };

  const productId = hallado.productId;
  return enBorrador(workspaceId, recepcionId, (tx) =>
    agregarProductoALaRecepcion(tx, { workspaceId, recepcionId, productId, codigo: normalizeBarcode(texto), origen: "LECTOR" }),
  );
}

/**
 * Suma una unidad del producto a la recepción (o abre su línea). Corre DENTRO de `enBorrador`
 * (la recepción ya está bloqueada y en BORRADOR). Lo comparten el lector y el alta rápida.
 */
export async function agregarProductoALaRecepcion(
  tx: Tx,
  args: { workspaceId: string; recepcionId: string; productId: string; codigo: string | null; origen: OrigenLinea },
): Promise<{ ok: true; resultado: "sumado" | "agregado" } | { ok: false; error: string }> {
  const { workspaceId, recepcionId, productId, codigo, origen } = args;
  const producto = await productoParaLinea(tx, workspaceId, productId);
  if (!producto.ok) return producto;

  const filas = await tx.fotofficeRecepcionLinea.findMany({
    where: { recepcionId, workspaceId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: SELECT_LINEA,
  });
  const lineas = filas.map(aLinea);

  // Un insumo con ficha de compra se escanea por bulto (la caja trae el código): el segundo
  // escaneo suma al bulto ya cargado, no abre otra línea. Lo demás va suelto, con la regla
  // de `lineaParaEscaneo`.
  const enBultos = producto.unidadesPorCompra !== null;
  const decision = enBultos
    ? (() => {
        const l = lineas.find(
          (x) => x.productId === productId && x.enUnidadDeCompra && x.unidadesPorCompra === producto.unidadesPorCompra,
        );
        return l ? { accion: "sumar" as const, lineaId: l.id } : { accion: "crear" as const };
      })()
    : lineaParaEscaneo(lineas, productId);

  if (decision.accion === "sumar") {
    await tx.fotofficeRecepcionLinea.update({
      where: { id: decision.lineaId },
      data: { cantidad: { increment: 1 } },
    });
    return { ok: true as const, resultado: "sumado" as const };
  }

  await tx.fotofficeRecepcionLinea.create({
    data: {
      recepcionId,
      workspaceId,
      productId,
      descripcionOriginal: producto.nombre,
      codigoBarras: codigo,
      cantidad: 1,
      enUnidadDeCompra: enBultos,
      unidadesPorCompra: producto.unidadesPorCompra,
      costoUnitarioArs: null,
      origen,
      order: await siguienteOrden(tx, recepcionId),
    },
  });
  return { ok: true as const, resultado: "agregado" as const };
}

/** Chequeos de los campos que vienen de la pantalla, antes de abrir la transacción. */
function validarCampos(l: Partial<LineaBorrador>): string | null {
  if (l.cantidad !== undefined && (!Number.isInteger(l.cantidad) || l.cantidad <= 0)) {
    return "La cantidad tiene que ser mayor que cero.";
  }
  if (
    l.unidadesPorCompra !== undefined &&
    l.unidadesPorCompra !== null &&
    (!Number.isInteger(l.unidadesPorCompra) || l.unidadesPorCompra < 1)
  ) {
    return "Las unidades por bulto tienen que ser un número entero mayor que cero.";
  }
  if (
    l.costoUnitarioMinor !== undefined &&
    l.costoUnitarioMinor !== null &&
    (!Number.isInteger(l.costoUnitarioMinor) || l.costoUnitarioMinor < 0)
  ) {
    return "El costo no se entiende.";
  }
  if (l.origen !== undefined && !(ORIGENES_LINEA as readonly string[]).includes(l.origen)) {
    return "El origen de la línea no se entiende.";
  }
  return null;
}

function textoONulo(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

/** Crea (sin `id`) o modifica (con `id`) una línea. Sólo se escriben los campos que vienen. */
export async function guardarLinea(
  workspaceId: string,
  recepcionId: string,
  linea: Partial<LineaBorrador> & { id?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const error = validarCampos(linea);
  if (error) return { ok: false, error };

  return enBorrador(workspaceId, recepcionId, async (tx) => {
    let nombreProducto: string | null = null;
    if (linea.productId) {
      const p = await productoParaLinea(tx, workspaceId, linea.productId);
      if (!p.ok) return p;
      nombreProducto = p.nombre;
    }

    const datos: Prisma.FotofficeRecepcionLineaUncheckedUpdateInput = {};
    if (linea.productId !== undefined) datos.productId = linea.productId;
    if (linea.descripcionOriginal !== undefined) {
      const d = textoONulo(linea.descripcionOriginal);
      if (d === null) return { ok: false as const, error: "Escribí qué producto es." };
      datos.descripcionOriginal = d;
    }
    if (linea.codigoBarras !== undefined) datos.codigoBarras = textoONulo(linea.codigoBarras);
    if (linea.cantidad !== undefined) datos.cantidad = linea.cantidad;
    if (linea.enUnidadDeCompra !== undefined) datos.enUnidadDeCompra = linea.enUnidadDeCompra;
    if (linea.unidadesPorCompra !== undefined) datos.unidadesPorCompra = linea.unidadesPorCompra;
    if (linea.costoUnitarioMinor !== undefined) {
      datos.costoUnitarioArs = linea.costoUnitarioMinor === null ? null : minorToDecimalString(linea.costoUnitarioMinor);
    }
    if (linea.origen !== undefined) datos.origen = linea.origen;

    if (linea.id) {
      const existente = await tx.fotofficeRecepcionLinea.findFirst({
        where: { id: linea.id, recepcionId, workspaceId },
        select: { id: true },
      });
      if (!existente) return { ok: false as const, error: "Esa línea no existe." };
      await tx.fotofficeRecepcionLinea.update({ where: { id: existente.id }, data: datos });
      return { ok: true as const };
    }

    const descripcion = (datos.descripcionOriginal as string | undefined) ?? nombreProducto;
    if (!descripcion) return { ok: false as const, error: "Escribí qué producto es." };
    await tx.fotofficeRecepcionLinea.create({
      data: {
        recepcionId,
        workspaceId,
        productId: linea.productId ?? null,
        descripcionOriginal: descripcion,
        codigoBarras: textoONulo(linea.codigoBarras),
        cantidad: linea.cantidad ?? 1,
        enUnidadDeCompra: linea.enUnidadDeCompra ?? false,
        unidadesPorCompra: linea.unidadesPorCompra ?? null,
        costoUnitarioArs:
          linea.costoUnitarioMinor === undefined || linea.costoUnitarioMinor === null
            ? null
            : minorToDecimalString(linea.costoUnitarioMinor),
        origen: linea.origen ?? "MANUAL",
        order: await siguienteOrden(tx, recepcionId),
      },
    });
    return { ok: true as const };
  });
}

/** Quita una línea del borrador. Sobre una recepción confirmada o descartada no hace nada y lo dice. */
export async function quitarLinea(
  workspaceId: string,
  recepcionId: string,
  lineaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return enBorrador(workspaceId, recepcionId, async (tx) => {
    await tx.fotofficeRecepcionLinea.deleteMany({ where: { id: lineaId, recepcionId, workspaceId } });
    return { ok: true as const };
  });
}

export async function guardarEncabezado(
  workspaceId: string,
  recepcionId: string,
  /** `nota` sin mandar (undefined) = no se toca la que ya tenía. */
  d: { proveedorId: string | null; fecha: Date; comprobante: string | null; preciosConIva: boolean; nota?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(d.fecha instanceof Date) || Number.isNaN(d.fecha.getTime())) {
    return { ok: false, error: "La fecha no se entiende." };
  }
  return enBorrador(workspaceId, recepcionId, async (tx) => {
    if (d.proveedorId !== null) {
      const proveedor = await tx.fotofficeProveedor.findFirst({
        where: { id: d.proveedorId, workspaceId },
        select: { id: true },
      });
      if (!proveedor) return { ok: false as const, error: "Ese proveedor no existe." };
    }
    await tx.fotofficeRecepcion.update({
      where: { id: recepcionId },
      data: {
        proveedorId: d.proveedorId,
        fecha: d.fecha,
        comprobante: textoONulo(d.comprobante),
        preciosConIva: d.preciosConIva,
        ...(d.nota !== undefined ? { nota: textoONulo(d.nota) } : {}),
      },
    });
    return { ok: true as const };
  });
}

/** Descarta el borrador. Una recepción confirmada no se descarta: se corrige con un ajuste. */
export async function descartar(
  workspaceId: string,
  recepcionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return enBorrador(workspaceId, recepcionId, async (tx) => {
    await tx.fotofficeRecepcion.update({ where: { id: recepcionId }, data: { estado: "DESCARTADA" } });
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------------------------
// Confirmar

/**
 * Confirma la recepción: una ENTRADA por línea, ya en unidad de stock, y el último costo por
 * unidad de stock en `Product.costArs` (el precio no se toca solo). Todo en una transacción:
 *
 *   1. bloquea la fila de la recepción y exige BORRADOR (el segundo clic lee CONFIRMADA);
 *   2. valida las líneas (`validarParaConfirmar`);
 *   3. un solo `lockStockRows` con todos los productos;
 *   4. ya con los productos bloqueados, verifica que sigan activos, sean de este negocio y no
 *      tengan talles. Si alguno falla, vuelve un error SIN haber escrito nada;
 *   5. recién ahí escribe.
 */
export async function confirmar(
  workspaceId: string,
  recepcionId: string,
  userId: number | null,
): Promise<{ ok: true; movimientos: number } | { ok: false; error: string }> {
  return enBorrador(workspaceId, recepcionId, async (tx) => {
    const filas = await tx.fotofficeRecepcionLinea.findMany({
      where: { recepcionId, workspaceId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: SELECT_LINEA,
    });
    const lineas = filas.map(aLinea);
    const valido = validarParaConfirmar(lineas);
    if (!valido.ok) return valido;

    const productIds = [...new Set(lineas.map((l) => l.productId as string))];
    await lockStockRows(tx, { workspaceId, productIds, variantIds: [] });

    const productos = await tx.product.findMany({
      where: { id: { in: productIds }, workspaceId, isActive: true },
      select: { id: true, costArs: true },
    });
    if (productos.length !== productIds.length) return { ok: false as const, error: ERROR_PRODUCTOS_CONFIRMAR };
    const conTalles = await tx.productVariant.findFirst({
      where: { workspaceId, productId: { in: productIds } },
      select: { id: true },
    });
    if (conTalles) return { ok: false as const, error: ERROR_TALLES_CONFIRMAR };

    // El último costo de cada producto (por orden de línea), por unidad de stock.
    const ultimoCosto = new Map<string, number>();
    for (const l of lineas) {
      const m = movimientoDeLinea(l);
      await applyStockMovement(tx, {
        workspaceId,
        productId: m.productId,
        variantId: null,
        qty: m.qty,
        reason: "ENTRADA",
        sourceModule: SOURCE_MODULE_RECEPCION,
        sourceRef: recepcionId,
        note: null,
        unitCostArs: m.unitCostMinor === null ? null : minorToDecimalString(m.unitCostMinor),
        createdByUserId: userId,
      });
      if (m.unitCostMinor !== null) ultimoCosto.set(m.productId, m.unitCostMinor);
    }

    const ahora = new Date();
    for (const p of productos) {
      const nuevo = ultimoCosto.get(p.id);
      if (nuevo === undefined) continue;
      const anterior = p.costArs === null ? null : decimalArsToMinor(p.costArs);
      if (anterior === nuevo) continue;
      await tx.product.update({
        where: { id: p.id },
        data: { costArs: minorToDecimalString(nuevo), costUpdatedAt: ahora },
      });
    }

    await tx.fotofficeRecepcion.update({
      where: { id: recepcionId },
      data: { estado: "CONFIRMADA", confirmedAt: ahora, confirmedByUserId: userId },
    });
    return { ok: true as const, movimientos: lineas.length };
  });
}
