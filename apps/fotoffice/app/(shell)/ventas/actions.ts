"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { parseProductForm } from "@/lib/sales/product-form";
import { parseCategoryForm } from "@/lib/sales/category-form";
import { findGlobalByBarcode, upsertGlobalProduct } from "@/lib/sales/global-catalog";
import { globalFieldsFromProduct, prefillFromGlobal, type ProductPrefill } from "@/lib/sales/global-catalog-fields";
import { requireSalesAdmin } from "@/lib/sales/access";

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
