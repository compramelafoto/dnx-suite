import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import type { VariantInput } from "./variant-form";

/**
 * Guardar la tabla de talles de un producto, dentro de la transacción de quien llama.
 *
 * Reglas (además de las de `parseVariantsForm`, que ya corrieron):
 *
 * 1. Un talle NUNCA se borra: puede tener ventas, movimientos o pedidos que lo nombran. Se
 *    desactiva, y sólo si su stock es cero — si no, `Product.stockQty` (que es la suma de sus
 *    talles, D4) contaría unidades de un talle que ya no se puede elegir en ningún lado. Un
 *    talle que no vino en el formulario queda como estaba.
 * 2. La primera vez que un producto con stock recibe talles, ese stock pasa al primer talle
 *    activo con dos ajustes (−stock sin talle, +stock con el talle), por `applyStockMovement`,
 *    la única puerta del stock. El total del producto no cambia y la suma cuadra desde el
 *    primer momento.
 *
 * Las validaciones devuelven `{ ok: false }` ANTES de escribir nada. Lo único que lanza es
 * perder una carrera por un código contra otro guardado simultáneo: ahí ya hubo escrituras y
 * la transacción entera tiene que volver atrás.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type SaveVariantsInput = {
  workspaceId: string;
  productId: string;
  userId: number | null;
  variants: readonly VariantInput[];
};

export type SaveVariantsResult = { ok: true } | { ok: false; error: string };

export const NOTA_PASO_DE_STOCK = "Paso del stock al primer talle";

export async function saveVariants(tx: Tx, input: SaveVariantsInput): Promise<SaveVariantsResult> {
  const { workspaceId, productId } = input;

  const producto = await tx.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true, stockQty: true },
  });
  if (!producto) return { ok: false, error: "Ese producto no existe." };

  const existentes = await tx.productVariant.findMany({
    where: { productId, workspaceId },
    select: { id: true, name: true, stockQty: true, isActive: true },
  });
  const porId = new Map(existentes.map((e) => [e.id, e]));

  for (const v of input.variants) {
    if (v.id === null) continue;
    const actual = porId.get(v.id);
    // Un id de otro producto o de otro negocio es, para este negocio, un talle que no existe.
    if (!actual) return { ok: false, error: "Ese talle no existe." };
    if (actual.isActive && !v.isActive && actual.stockQty !== 0) {
      return { ok: false, error: "Llevá el stock de este talle a cero antes de desactivarlo." };
    }
  }

  // Los talles que no vinieron en el formulario siguen existiendo (nunca se borran). Si uno
  // nuevo se llama igual, es casi seguro una pantalla vieja que reenvía un talle ya creado:
  // guardarlo dejaría dos "M" en el mismo producto.
  const idsEnviados = new Set(input.variants.map((v) => v.id).filter((id): id is string => id !== null));
  const nombresQueQuedan = new Set(
    existentes.filter((e) => !idsEnviados.has(e.id)).map((e) => e.name.toLocaleLowerCase("es")),
  );
  for (const v of input.variants) {
    if (v.id === null && nombresQueQuedan.has(v.name.toLocaleLowerCase("es"))) {
      return { ok: false, error: `Ya existe el talle ${v.name}. Recargá la página y probá de nuevo.` };
    }
  }

  // Los códigos son únicos por negocio en la base. Chequearlos acá da un error que se
  // entiende, y evita depender de un P2002 que dentro de una transacción interactiva la deja
  // inutilizable.
  const skus = input.variants.map((v) => v.sku).filter((s): s is string => s !== null);
  const barcodes = input.variants.map((v) => v.barcode).filter((b): b is string => b !== null);
  if (skus.length > 0 || barcodes.length > 0) {
    const idsDelFormulario = input.variants.map((v) => v.id).filter((id): id is string => id !== null);
    const OR: Prisma.ProductVariantWhereInput[] = [];
    if (skus.length > 0) OR.push({ sku: { in: skus } });
    if (barcodes.length > 0) OR.push({ barcode: { in: barcodes } });
    const chocan = await tx.productVariant.findMany({
      where: { workspaceId, id: { notIn: idsDelFormulario }, OR },
      select: { id: true, sku: true, barcode: true },
    });
    for (const otra of chocan) {
      if (otra.sku !== null && skus.includes(otra.sku)) {
        return { ok: false, error: `Ya tenés otro talle con el código ${otra.sku}.` };
      }
      if (otra.barcode !== null && barcodes.includes(otra.barcode)) {
        return { ok: false, error: `Ya tenés otro talle con el código de barras ${otra.barcode}.` };
      }
    }
  }

  const nuevos = input.variants.filter((v) => v.id === null);
  const primeraVez = existentes.length === 0 && nuevos.length > 0;
  const stockAPasar = primeraVez ? producto.stockQty : 0;
  // Se pasa también un stock negativo: es información (faltan entradas) y tiene que seguir
  // estando en algún lado para que la suma cuadre.
  const receptor = stockAPasar !== 0 ? nuevos.find((v) => v.isActive) : undefined;
  if (stockAPasar !== 0 && !receptor) {
    return {
      ok: false,
      error: "Para pasar el stock que ya tenía el producto, al menos un talle tiene que estar activo.",
    };
  }

  for (const v of input.variants) {
    if (v.id === null) continue;
    await tx.productVariant.updateMany({
      where: { id: v.id, productId, workspaceId },
      data: datosDelTalle(v),
    });
  }

  if (nuevos.length > 0) {
    // `createMany` + `skipDuplicates` compila a `ON CONFLICT DO NOTHING`: si otro guardado
    // tomó el mismo código entre el chequeo de arriba y acá, no revienta la transacción con
    // un P2002 sino que crea menos filas, y eso se detecta por la cuenta.
    const creados = await tx.productVariant.createMany({
      data: nuevos.map((v) => ({ workspaceId, productId, ...datosDelTalle(v) })),
      skipDuplicates: true,
    });
    if (creados.count !== nuevos.length) {
      throw new Error("Otro talle tomó ese código mientras guardabas. Probá de nuevo.");
    }
  }

  if (receptor) {
    // `createMany` no devuelve los ids: se relee por nombre, que es único dentro del producto
    // (lo garantiza `parseVariantsForm`).
    const primero = await tx.productVariant.findFirst({
      where: { productId, workspaceId, name: receptor.name },
      select: { id: true },
    });
    if (!primero) throw new Error("No se encontró el talle recién creado.");

    const movimiento = {
      workspaceId,
      productId,
      reason: "AJUSTE" as const,
      sourceModule: "sales",
      sourceRef: null,
      note: NOTA_PASO_DE_STOCK,
      unitCostArs: null,
      createdByUserId: input.userId,
    };
    await applyStockMovement(tx, { ...movimiento, variantId: null, qty: -stockAPasar });
    await applyStockMovement(tx, { ...movimiento, variantId: primero.id, qty: stockAPasar });
  }

  return { ok: true };
}

function datosDelTalle(v: VariantInput) {
  return {
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    priceArs: v.priceMinor === null ? null : minorToDecimalString(v.priceMinor),
    isActive: v.isActive,
    sortOrder: v.sortOrder,
  };
}
