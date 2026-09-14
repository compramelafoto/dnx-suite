"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { parseProductForm } from "@/lib/sales/product-form";
import { parseCategoryForm } from "@/lib/sales/category-form";
import { findGlobalByBarcode, upsertGlobalProduct } from "@/lib/sales/global-catalog";
import { globalFieldsFromProduct, prefillFromGlobal, type ProductPrefill } from "@/lib/sales/global-catalog-fields";
import { requireSalesAdmin, requireSalesStaff } from "@/lib/sales/access";
import { findProductByCode, listProducts, type ProductRow } from "@/lib/sales/repository";
import { validateTicket } from "@/lib/sales/ticket";
import {
  buildTicketLines,
  resolveCheckoutClientInput,
  type RawCheckoutClient,
  type RawCheckoutLine,
} from "@/lib/sales/checkout";
import { recordSale } from "@/lib/sales/record-sale";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";

const CATALOGO = "/ventas/catalogo";

/**
 * Alta y edición de un producto.
 *
 * Cuando el formulario trae código de barras, la ficha del catálogo maestro se crea o se lee
 * DENTRO de la misma transacción que el alta o la edición del producto: si el producto no
 * llega a guardarse, tampoco tiene que quedar creada una ficha global huérfana. Los campos
 * que viajan al catálogo compartido salen exclusivamente de `globalFieldsFromProduct` —nunca
 * se arman a mano acá— para que un campo de plata no pueda colarse en una tabla que
 * comparten todos los negocios de la suite.
 */
export async function saveProductAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireSalesAdmin();

  const productId = String(formData.get("productId") ?? "").trim() || null;
  const destinoError = productId ? `${CATALOGO}/${productId}` : `${CATALOGO}/nuevo`;

  const parsed = parseProductForm(formData);
  if (!parsed.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (productId) {
    // El `where` de un update tiene que ser único, así que el workspace no puede viajar ahí.
    const propio = await prisma.product.count({ where: { id: productId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${CATALOGO}?error=${encodeURIComponent("Ese producto no existe.")}`);
  }

  // `ProductCategory` no tiene ninguna restricción que ate la categoría al workspace del
  // producto: sin este control, un `categoryId` de OTRO negocio se guarda sin problema, y
  // como `listProducts`/`getProduct` traen `category: { select: { name: true } }`, el nombre
  // de esa categoría ajena queda visible en la lista y en la ficha de este negocio. Vacío es
  // válido (un producto puede no tener categoría); lo que se rechaza es la categoría que
  // existe pero es de otro workspace.
  if (v.categoryId) {
    const propia = await prisma.productCategory.count({
      where: { id: v.categoryId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${destinoError}?error=${encodeURIComponent("Esa categoría no existe.")}`);
  }

  // La base guarda `Decimal(12,2)`; el formulario trabaja en centavos enteros. `priceMinor`
  // y `costMinor` no son columnas de `Product` —lo son `priceArs` y `costArs`— así que no se
  // puede volcar `v` entero en el `data` de Prisma sin antes convertirlos.
  const { priceMinor, costMinor, ...camposProducto } = v;
  const datosProducto = {
    ...camposProducto,
    priceArs: minorToDecimalString(priceMinor),
    costArs: costMinor === null ? null : minorToDecimalString(costMinor),
  };

  try {
    if (v.barcode) {
      const barcode = v.barcode;
      await prisma.$transaction(async (tx) => {
        const global = await upsertGlobalProduct(tx, {
          barcode,
          ...globalFieldsFromProduct(v),
          workspaceId: workspace.id,
          userId: user.id,
        });
        const data = { ...datosProducto, globalProductId: global.id };
        if (productId) {
          await tx.product.update({ where: { id: productId }, data });
        } else {
          await tx.product.create({
            data: { ...data, workspaceId: workspace.id, createdByUserId: user.id },
          });
        }
      });
    } else {
      // Sin código de barras no hay catálogo maestro que tocar. Si el producto tenía uno
      // antes y se lo borraron acá, `globalProductId` se limpia: no tiene sentido dejar
      // colgada la referencia a una ficha que este producto ya no reclama.
      const data = { ...datosProducto, globalProductId: null };
      if (productId) {
        await prisma.product.update({ where: { id: productId }, data });
      } else {
        await prisma.product.create({
          data: { ...data, workspaceId: workspace.id, createdByUserId: user.id },
        });
      }
    }
  } catch (e) {
    // P2002 = choque con un índice único. El único índice único de `Product` que un
    // formulario puede disparar es `[workspaceId, sku]`: el mensaje crudo de Prisma no le
    // dice nada a quien está cargando el producto.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`${destinoError}?error=${encodeURIComponent("Ya tenés un producto con ese código.")}`);
    }
    throw e;
  }

  revalidatePath(CATALOGO);
  redirect(productId ? `${CATALOGO}/${productId}?ok=1` : `${CATALOGO}?ok=1`);
}

/**
 * Activar o desactivar un producto.
 *
 * Nunca lo borra: las ventas viejas lo siguen nombrando (`SaleItem` guarda su nombre y su
 * precio de ese momento, pero también el `productId`), y borrar la fila dejaría esos
 * renglones apuntando a un producto que ya no existe.
 */
export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const productId = String(formData.get("productId") ?? "").trim();
  const activar = formData.get("active") === "on";

  await prisma.product.updateMany({
    where: { id: productId, workspaceId: workspace.id },
    data: { isActive: activar },
  });

  revalidatePath(CATALOGO);
  revalidatePath(`${CATALOGO}/${productId}`);
  redirect(`${CATALOGO}/${productId}?ok=${activar ? "activado" : "desactivado"}`);
}

/** Alta y edición de una categoría de productos. Igual que la de Caja, sin lado. */
export async function saveCategoryAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  const parsed = parseCategoryForm(formData);
  if (!parsed.ok) redirect(`${CATALOGO}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (categoryId) {
    const propia = await prisma.productCategory.count({
      where: { id: categoryId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${CATALOGO}?error=${encodeURIComponent("Esa categoría no existe.")}`);
    await prisma.productCategory.update({ where: { id: categoryId }, data: v });
  } else {
    try {
      await prisma.productCategory.create({ data: { ...v, workspaceId: workspace.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        redirect(`${CATALOGO}?error=${encodeURIComponent("Ya existe una categoría con ese nombre.")}`);
      }
      throw e;
    }
  }

  revalidatePath(CATALOGO);
  redirect(`${CATALOGO}?ok=1`);
}

/**
 * Busca el código escaneado en el catálogo maestro, para precargar el alta.
 *
 * No es la acción de un `<form>`: la pantalla de alta la llama directo, al apretar Enter en
 * el campo de código de barras, para no perder el resto de lo que la persona ya tipeó. Sólo
 * lee —nunca crea ni modifica la ficha global—, así que alcanza con el nivel de acceso de
 * catálogo: se usa exclusivamente desde una pantalla que ya exige `requireSalesAdmin`.
 */
export async function lookupGlobalProductAction(formData: FormData): Promise<ProductPrefill> {
  await requireSalesAdmin();
  const barcode = String(formData.get("barcode") ?? "");
  const global = await findGlobalByBarcode(barcode);
  return prefillFromGlobal(global);
}

/**
 * Busca UN producto por código exacto —sku o código de barras—, para cuando el Enter del
 * lector no encontró nada entre los productos que `page.tsx` ya precargó en pantalla.
 *
 * `listProducts` corta en 200 (ver el comentario en `lib/sales/repository.ts`) y la pantalla
 * nunca vuelve a pedir el catálogo entero: con más de 200 productos activos, el resto es
 * invisible para la grilla y para el lector por igual. `findProductByCode` —la interfaz que
 * la Tarea 6 construyó exactamente para este caso, con la normalización del código de barras
 * ya adentro— es la puerta más chica posible para tapar ese agujero: una acción de servidor
 * que la pantalla llama sólo cuando de verdad hace falta (no encontró nada localmente), no un
 * endpoint nuevo ni un cambio de arquitectura.
 */
export async function findProductByCodeAction(code: string): Promise<ProductRow | null> {
  const { workspace } = await requireSalesStaff();
  return findProductByCode(workspace.id, code);
}

/**
 * Busca productos por texto en el servidor, sin el techo de 200 de la precarga.
 *
 * Mismo motivo que `findProductByCodeAction`: un negocio con un catálogo mediano tiene
 * productos que la pantalla nunca llegó a traer. La pantalla dispara esto con lo que se va
 * tipeando (con una demora corta del lado del cliente, para no pegarle a la base en cada
 * tecla) y usa el resultado en vez de filtrar sólo el array precargado.
 */
export async function searchProductsAction(input: {
  search: string;
  categoryId?: string;
}): Promise<ProductRow[]> {
  const { workspace } = await requireSalesStaff();
  return listProducts(workspace.id, {
    search: input.search,
    categoryId: input.categoryId || undefined,
    onlyActive: true,
  });
}

export type CheckoutInput = {
  lines: RawCheckoutLine[];
  discountMinor: number;
  paymentMethod: string;
  note: string;
  client: RawCheckoutClient;
};

export type CheckoutResult =
  | { ok: true; saleNumber: number; deposited: boolean }
  | { ok: false; error: string };

/**
 * Cobrar. Es el botón que cierra el ticket, con gente esperando del otro lado del mostrador:
 * por eso no redirige ni recarga la pantalla —se llama directo desde `pos.tsx`, no desde un
 * `<form>`— y devuelve un resultado que el ticket usa para mostrar el número de venta o el
 * error sin perder lo que ya se había cargado.
 *
 * Vender es STAFF+, no ADMIN+ (`requireSalesStaff`, no `requireSalesAdmin`): es lo que hace
 * el mostrador todo el día.
 */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  const { workspace, user } = await requireSalesStaff();

  const paymentMethod = input.paymentMethod as SalePaymentMethod;
  if (!SALE_PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, error: "Elegí un medio de pago." };
  }

  if (!Number.isInteger(input.discountMinor) || input.discountMinor < 0) {
    return { ok: false, error: "El descuento no se entiende." };
  }

  // Cada `productId` del ticket se verifica contra ESTE workspace antes de escribir nada:
  // la misma fuga que se coló con una categoría en la tarea anterior, ahora con productos.
  // De paso, esta lectura trae el nombre y el costo de verdad —el costo ni siquiera viaja
  // hasta el mostrador— para que `buildTicketLines` no tenga que confiar en lo que mandó el
  // navegador.
  const productIds = [...new Set(input.lines.map((l) => l.productId).filter((id): id is string => id !== null))];
  const productos =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, workspaceId: workspace.id },
          select: { id: true, name: true, priceArs: true, costArs: true },
        })
      : [];
  const productMap = new Map(
    productos.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        priceMinor: decimalArsToMinor(p.priceArs),
        costMinor: p.costArs === null ? null : decimalArsToMinor(p.costArs),
      },
    ]),
  );

  const armado = buildTicketLines(input.lines, productMap);
  if (!armado.ok) return { ok: false, error: armado.error };

  const validacion = validateTicket(armado.lines, input.discountMinor);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  const client = resolveCheckoutClientInput(input.client);
  const note = input.note.trim();

  try {
    const venta = await prisma.$transaction((tx) =>
      recordSale(tx, {
        workspaceId: workspace.id,
        createdByUserId: user.id,
        occurredAt: new Date(),
        paymentMethod,
        discountMinor: input.discountMinor,
        note: note === "" ? null : note,
        client,
        lines: armado.lines,
      }),
    );
    revalidatePath("/ventas");
    return { ok: true, saleNumber: venta.saleNumber, deposited: venta.deposited };
  } catch (e) {
    console.error("[fotoffice][ventas] error al cobrar", e);
    return { ok: false, error: "No se pudo registrar la venta. Probá de nuevo." };
  }
}
