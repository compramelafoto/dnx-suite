import "server-only";
import { prisma } from "@repo/db";
import {
  FORMAS_ENTREGA,
  TIPOS_ENVOLTORIO,
  sugerirEntrega,
  type EntregaProducto,
  type FormaEntrega,
  type TipoEnvoltorio,
} from "./embalaje";

/**
 * Configuración del embalaje: los envoltorios del negocio y la forma de entrega de cada producto.
 * La pantalla está en Ventas → Stock → Embalaje.
 */

/** Sobre y bolsas negras de DNX Estudio. Sirven de ejemplo a cualquier negocio; se corrigen en pantalla. */
export const ENVOLTORIOS_DE_EJEMPLO: readonly {
  nombre: string;
  tipo: TipoEnvoltorio;
  admiteAnchoCm: number;
  admiteAltoCm: number;
  piezasPorUnidad: number | null;
  unidad: string;
}[] = [
  { nombre: "Sobre de papel 19x24", tipo: "SOBRE", admiteAnchoCm: 15, admiteAltoCm: 21, piezasPorUnidad: 100, unidad: "sobres" },
  { nombre: "Bolsa negra 20x30", tipo: "BOLSA", admiteAnchoCm: 20, admiteAltoCm: 30, piezasPorUnidad: null, unidad: "bolsas" },
  { nombre: "Bolsa negra 30x45", tipo: "BOLSA", admiteAnchoCm: 30, admiteAltoCm: 45, piezasPorUnidad: null, unidad: "bolsas" },
  { nombre: "Bolsa negra 35x45", tipo: "BOLSA", admiteAnchoCm: 35, admiteAltoCm: 45, piezasPorUnidad: null, unidad: "bolsas" },
];

const MEDIDA_MAXIMA_CM = 300;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Resultado = { ok: true } | { ok: false; error: string };

/** Crea el insumo de un envoltorio (existencia 0) y su ficha. Nunca escribe movimientos. */
async function crearInsumo(tx: Tx, workspaceId: string, nombre: string, unidad: string): Promise<string> {
  const nuevo = await tx.product.create({
    data: { workspaceId, kind: "INSUMO", name: nombre, priceArs: "0", tracksStock: true, stockQty: 0 },
    select: { id: true },
  });
  await tx.fotofficeInsumo.create({ data: { workspaceId, productId: nuevo.id, unidad } });
  return nuevo.id;
}

/**
 * Carga el sobre 19x24 y las bolsas negras. Idempotente (candado por negocio): un envoltorio con
 * ese nombre que ya existe no se repite. La existencia arranca en cero: el local la carga después.
 */
export async function asegurarEnvoltoriosDeEjemplo(workspaceId: string): Promise<{ creados: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-embalaje:${workspaceId}`}))`;
    const existentes = await tx.fotofficeEmbalaje.findMany({ where: { workspaceId }, select: { insumoId: true, orden: true } });
    const nombres = new Set(
      existentes.length > 0
        ? (
            await tx.product.findMany({
              where: { workspaceId, id: { in: existentes.map((e) => e.insumoId) } },
              select: { name: true },
            })
          ).map((p) => p.name)
        : [],
    );
    let orden = existentes.reduce((m, e) => Math.max(m, e.orden + 1), 0);
    let creados = 0;
    for (const e of ENVOLTORIOS_DE_EJEMPLO) {
      if (nombres.has(e.nombre)) continue;
      const previo = await tx.product.findFirst({ where: { workspaceId, kind: "INSUMO", name: e.nombre }, select: { id: true } });
      const insumoId = previo?.id ?? (await crearInsumo(tx, workspaceId, e.nombre, e.unidad));
      await tx.fotofficeEmbalaje.create({
        data: {
          workspaceId,
          insumoId,
          tipo: e.tipo,
          admiteAnchoCm: String(e.admiteAnchoCm),
          admiteAltoCm: String(e.admiteAltoCm),
          piezasPorUnidad: e.piezasPorUnidad,
          orden: orden++,
        },
      });
      creados++;
    }
    return { creados };
  });
}

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const medidaValida = (n: number | null) => n !== null && n > 0 && n <= MEDIDA_MAXIMA_CM;

/** Alta o edición de un envoltorio. Con `insumoId`, edita; sin él, crea el insumo y el envoltorio. */
export async function guardarEnvoltorio(workspaceId: string, datos: unknown): Promise<Resultado> {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const tipo = d.tipo as TipoEnvoltorio;
  const ancho = numero(d.admiteAnchoCm);
  const alto = numero(d.admiteAltoCm);
  const piezas = numero(d.piezasPorUnidad);
  if (!nombre) return { ok: false, error: "Poné un nombre." };
  if (!TIPOS_ENVOLTORIO.includes(tipo)) return { ok: false, error: "Elegí si es sobre o bolsa." };
  if (!medidaValida(ancho) || !medidaValida(alto)) return { ok: false, error: "La medida que entra tiene que ser mayor a 0 (en cm)." };
  if (piezas !== null && !(Number.isInteger(piezas) && piezas > 0)) return { ok: false, error: "«Uno más cada» tiene que ser un número entero." };
  const activo = d.activo !== false;
  const datosEnvoltorio = { tipo, admiteAnchoCm: String(ancho), admiteAltoCm: String(alto), piezasPorUnidad: piezas, activo };

  return prisma.$transaction(async (tx) => {
    if (typeof d.insumoId === "string" && d.insumoId) {
      const fila = await tx.fotofficeEmbalaje.findFirst({ where: { workspaceId, insumoId: d.insumoId }, select: { id: true } });
      if (!fila) return { ok: false as const, error: "Ese envoltorio no es de este negocio." };
      await tx.fotofficeEmbalaje.update({ where: { id: fila.id }, data: datosEnvoltorio });
      await tx.product.updateMany({ where: { id: d.insumoId, workspaceId, kind: "INSUMO" }, data: { name: nombre } });
      return { ok: true as const };
    }
    const orden = await tx.fotofficeEmbalaje.count({ where: { workspaceId } });
    const insumoId = await crearInsumo(tx, workspaceId, nombre, tipo === "SOBRE" ? "sobres" : "bolsas");
    await tx.fotofficeEmbalaje.create({ data: { workspaceId, insumoId, orden, ...datosEnvoltorio } });
    return { ok: true as const };
  });
}

type FilaEntrega = {
  productId: string;
  forma: FormaEntrega | null;
  anchoCm: number | null;
  altoCm: number | null;
  embalajeSiguiente: boolean;
  embalajeFijoId: string | null;
};

function leerFila(v: unknown): FilaEntrega | string {
  const d = (v ?? {}) as Record<string, unknown>;
  if (typeof d.productId !== "string" || !d.productId) return "Falta el producto.";
  const forma = d.forma === null || d.forma === "" ? null : (d.forma as FormaEntrega);
  if (forma !== null && !FORMAS_ENTREGA.includes(forma)) return "Forma de entrega desconocida.";
  const anchoCm = numero(d.anchoCm);
  const altoCm = numero(d.altoCm);
  if ((anchoCm === null) !== (altoCm === null)) return "Completá las dos medidas o ninguna.";
  if (anchoCm !== null && (!medidaValida(anchoCm) || !medidaValida(altoCm))) return "Las medidas tienen que ser mayores a 0 (en cm).";
  const embalajeFijoId = typeof d.embalajeFijoId === "string" && d.embalajeFijoId ? d.embalajeFijoId : null;
  if ((forma === "ENMARCADO" || forma === "VOLUMEN") && anchoCm === null && !embalajeFijoId) {
    return "Un portarretratos o un fotolibro necesita su medida (o un envoltorio fijo).";
  }
  return { productId: d.productId, forma, anchoCm, altoCm, embalajeSiguiente: d.embalajeSiguiente === true, embalajeFijoId };
}

/**
 * Guarda la forma de entrega de varios productos. Todo o nada: si una fila no se entiende, no se
 * guarda ninguna. `forma: null` borra la configuración del producto.
 */
export async function guardarEntregas(workspaceId: string, filas: unknown): Promise<{ ok: true; guardadas: number } | { ok: false; error: string }> {
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, error: "No hay nada para guardar." };
  const leidas: FilaEntrega[] = [];
  for (const f of filas) {
    const r = leerFila(f);
    if (typeof r === "string") return { ok: false, error: r };
    leidas.push(r);
  }
  const ids = [...new Set(leidas.map((f) => f.productId))];
  const vendibles = await prisma.product.findMany({
    where: { workspaceId, id: { in: ids }, kind: { not: "INSUMO" } },
    select: { id: true },
  });
  if (vendibles.length !== ids.length) return { ok: false, error: "Algún producto no es de este negocio o no se vende." };
  const fijos = [...new Set(leidas.map((f) => f.embalajeFijoId).filter((x): x is string => x !== null))];
  if (fijos.length > 0) {
    const propios = await prisma.fotofficeEmbalaje.count({ where: { workspaceId, id: { in: fijos } } });
    if (propios !== fijos.length) return { ok: false, error: "Ese envoltorio no es de este negocio." };
  }

  await prisma.$transaction(async (tx) => {
    for (const f of leidas) {
      if (f.forma === null) {
        await tx.fotofficeProductoEntrega.deleteMany({ where: { workspaceId, productId: f.productId } });
        continue;
      }
      const datos = {
        forma: f.forma,
        anchoCm: f.anchoCm === null ? null : String(f.anchoCm),
        altoCm: f.altoCm === null ? null : String(f.altoCm),
        embalajeSiguiente: f.embalajeSiguiente,
        embalajeFijoId: f.embalajeFijoId,
      };
      await tx.fotofficeProductoEntrega.upsert({
        where: { productId: f.productId },
        create: { workspaceId, productId: f.productId, ...datos },
        update: datos,
      });
    }
  });
  return { ok: true, guardadas: leidas.length };
}

/** Cuántos productos vendibles activos todavía no tienen forma de entrega. */
export async function productosSinEntrega(workspaceId: string): Promise<number> {
  const [vendibles, configurados] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, isActive: true, kind: { not: "INSUMO" } }, select: { id: true } }),
    prisma.fotofficeProductoEntrega.findMany({ where: { workspaceId }, select: { productId: true } }),
  ]);
  const con = new Set(configurados.map((c) => c.productId));
  return vendibles.filter((p) => !con.has(p.id)).length;
}

/** ¿El negocio ya tiene envoltorios? (para ofrecer el botón de los de ejemplo). */
export async function tieneEnvoltorios(workspaceId: string): Promise<boolean> {
  return (await prisma.fotofficeEmbalaje.count({ where: { workspaceId } })) > 0;
}

export type EnvoltorioEnPantalla = {
  filaId: string;
  insumoId: string;
  nombre: string;
  tipo: TipoEnvoltorio;
  admiteAnchoCm: number;
  admiteAltoCm: number;
  piezasPorUnidad: number | null;
  activo: boolean;
  stockQty: number;
};
export type ProductoEnPantalla = {
  id: string;
  nombre: string;
  categoria: string | null;
  entrega: EntregaProducto | null;
  sugerida: EntregaProducto | null;
};

/** Todo lo que muestra la pantalla de embalaje. */
export async function leerConfiguracionEmbalaje(workspaceId: string): Promise<{ envoltorios: EnvoltorioEnPantalla[]; productos: ProductoEnPantalla[] }> {
  const [filas, productos, entregas, categorias, producciones] = await Promise.all([
    prisma.fotofficeEmbalaje.findMany({ where: { workspaceId }, orderBy: { orden: "asc" } }),
    prisma.product.findMany({
      where: { workspaceId, isActive: true, kind: { not: "INSUMO" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, categoryId: true },
    }),
    prisma.fotofficeProductoEntrega.findMany({ where: { workspaceId } }),
    prisma.productCategory.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    prisma.fotofficeProductoProduccion.findMany({ where: { workspaceId }, select: { productId: true, tamanoHojaId: true } }),
  ]);
  const insumos = filas.length
    ? await prisma.product.findMany({ where: { workspaceId, id: { in: filas.map((f) => f.insumoId) } }, select: { id: true, name: true, stockQty: true } })
    : [];
  const tamanos = producciones.some((p) => p.tamanoHojaId)
    ? await prisma.fotofficeTamanoImpresion.findMany({
        where: { workspaceId, id: { in: producciones.flatMap((p) => (p.tamanoHojaId ? [p.tamanoHojaId] : [])) } },
        select: { id: true, anchoMm: true, altoMm: true },
      })
    : [];
  const insumo = new Map(insumos.map((p) => [p.id, p]));
  const categoria = new Map(categorias.map((c) => [c.id, c.name]));
  const entrega = new Map(entregas.map((e) => [e.productId, e]));
  const tamano = new Map(tamanos.map((t) => [t.id, t]));
  const hoja = new Map(producciones.map((p) => [p.productId, p.tamanoHojaId ? tamano.get(p.tamanoHojaId) : undefined]));

  return {
    envoltorios: filas.map((f) => ({
      filaId: f.id,
      insumoId: f.insumoId,
      nombre: insumo.get(f.insumoId)?.name ?? "(insumo borrado)",
      tipo: f.tipo as TipoEnvoltorio,
      admiteAnchoCm: Number(f.admiteAnchoCm),
      admiteAltoCm: Number(f.admiteAltoCm),
      piezasPorUnidad: f.piezasPorUnidad,
      activo: f.activo,
      stockQty: insumo.get(f.insumoId)?.stockQty ?? 0,
    })),
    productos: productos.map((p) => {
      const e = entrega.get(p.id);
      const h = hoja.get(p.id);
      const cat = p.categoryId ? (categoria.get(p.categoryId) ?? null) : null;
      return {
        id: p.id,
        nombre: p.name,
        categoria: cat,
        entrega: e
          ? {
              forma: e.forma as FormaEntrega,
              anchoCm: e.anchoCm === null ? null : Number(e.anchoCm),
              altoCm: e.altoCm === null ? null : Number(e.altoCm),
              embalajeSiguiente: e.embalajeSiguiente,
              embalajeFijoId: e.embalajeFijoId,
            }
          : null,
        sugerida: e
          ? null
          : sugerirEntrega({ nombre: p.name, categoria: cat, kind: p.kind, hojaMm: h ? { ancho: Number(h.anchoMm), alto: Number(h.altoMm) } : null }),
      };
    }),
  };
}
