"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { requireSalesAdmin } from "@/lib/sales/access";
import { isAcceptableImageUrl, parseListingForm } from "@/lib/store/listing-form";
import { slugify, uniqueSlug } from "@/lib/store/slug";
import { parseVariantsForm } from "@/lib/store/variant-form";
import { saveVariants } from "@/lib/store/save-variants";

/**
 * Lo que la ficha de un producto agrega para la tienda online: dónde se vende, cómo se
 * muestra, su galería y sus talles.
 *
 * Todas exigen `sales.catalog` (`requireSalesAdmin`): editar la ficha online es editar el
 * catálogo (§6.4 del diseño). No exigen que el módulo `store` esté encendido: se puede dejar
 * todo cargado antes de abrir la tienda, y la pantalla avisa que todavía no se ve.
 *
 * Devuelven un resultado en vez de redirigir porque las llama la ficha desde el navegador,
 * sección por sección, sin perder lo que se está escribiendo en las otras.
 */

export type StoreActionResult = { ok: true } | { ok: false; error: string };

const CATALOGO = "/ventas/catalogo";
const STOCK = "/ventas/stock";
// No se exporta: un archivo "use server" sólo puede exportar funciones asíncronas.
const MAX_PRODUCT_IMAGES = 12;

function refrescar(productId: string) {
  revalidatePath(CATALOGO);
  revalidatePath(`${CATALOGO}/${productId}`);
}

/** Un producto de otro negocio es, para éste, un producto que no existe. */
async function productoPropio(workspaceId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true, name: true, storeListing: { select: { slug: true } } },
  });
}

async function slugsTomados(workspaceId: string, productId: string): Promise<Set<string>> {
  const otros = await prisma.productStoreListing.findMany({
    where: { workspaceId, productId: { not: productId } },
    select: { slug: true },
  });
  return new Set(otros.map((o) => o.slug));
}

function esChoqueDeUnicidad(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const NO_EXISTE: StoreActionResult = { ok: false, error: "Ese producto no existe." };

export async function saveListingAction(productId: string, formData: FormData): Promise<StoreActionResult> {
  const { workspace } = await requireSalesAdmin();
  const producto = await productoPropio(workspace.id, productId);
  if (!producto) return NO_EXISTE;

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return parsed;
  const v = parsed.values;

  const tomados = await slugsTomados(workspace.id, productId);
  let slug = v.slug;
  if (slug === "") {
    // La dirección es un compromiso público: vacía no la cambia; la primera vez se arma con
    // el nombre.
    slug = producto.storeListing?.slug ?? uniqueSlug(slugify(producto.name), tomados);
  } else if (tomados.has(slug)) {
    return { ok: false, error: "Ya tenés otro producto con esa dirección." };
  }

  const datos = { ...v, slug };
  try {
    // Fuera de una transacción interactiva: acá sí se puede atrapar el P2002 de una carrera
    // por la misma dirección.
    await prisma.productStoreListing.upsert({
      where: { productId },
      create: { workspaceId: workspace.id, productId, ...datos },
      update: datos,
    });
  } catch (e) {
    if (esChoqueDeUnicidad(e)) return { ok: false, error: "Ya tenés otro producto con esa dirección." };
    throw e;
  }

  refrescar(productId);
  return { ok: true };
}

export async function saveVariantsAction(productId: string, formData: FormData): Promise<StoreActionResult> {
  const { workspace, user } = await requireSalesAdmin();

  const parsed = parseVariantsForm(formData);
  if (!parsed.ok) return parsed;

  let resultado: StoreActionResult;
  try {
    resultado = await prisma.$transaction((tx) =>
      saveVariants(tx, {
        workspaceId: workspace.id,
        productId,
        userId: user.id,
        variants: parsed.variants,
      }),
    );
  } catch (e) {
    // La transacción ya volvió atrás entera; acá afuera sí se puede mirar qué pasó.
    if (e instanceof Error && e.message.startsWith("Otro talle tomó ese código")) {
      return { ok: false, error: e.message };
    }
    if (esChoqueDeUnicidad(e)) return { ok: false, error: "Ya tenés otro talle con ese código." };
    throw e;
  }
  if (!resultado.ok) return resultado;

  refrescar(productId);
  revalidatePath(STOCK);
  return { ok: true };
}

export async function addProductImageAction(productId: string, url: string): Promise<StoreActionResult> {
  const { workspace } = await requireSalesAdmin();
  if (!(await productoPropio(workspace.id, productId))) return NO_EXISTE;
  if (!isAcceptableImageUrl(url)) return { ok: false, error: "Esa imagen no se pudo guardar." };

  const fotos = await prisma.productImage.findMany({
    where: { productId, workspaceId: workspace.id },
    select: { sortOrder: true },
  });
  if (fotos.length >= MAX_PRODUCT_IMAGES) {
    return { ok: false, error: `Un producto puede tener hasta ${MAX_PRODUCT_IMAGES} fotos.` };
  }
  const ultimo = fotos.reduce((max, f) => Math.max(max, f.sortOrder), -1);

  await prisma.productImage.create({
    data: { workspaceId: workspace.id, productId, url, sortOrder: ultimo + 1 },
  });

  refrescar(productId);
  return { ok: true };
}

/** Quita la foto de la galería. El archivo queda en el bucket, igual que la foto del mostrador. */
export async function removeProductImageAction(imageId: string): Promise<StoreActionResult> {
  const { workspace } = await requireSalesAdmin();
  const foto = await prisma.productImage.findFirst({
    where: { id: imageId, workspaceId: workspace.id },
    select: { productId: true },
  });
  if (!foto) return { ok: false, error: "Esa foto no existe." };

  await prisma.productImage.deleteMany({ where: { id: imageId, workspaceId: workspace.id } });

  refrescar(foto.productId);
  return { ok: true };
}

/** `ids` es la galería entera en el orden nuevo: la primera queda como principal. */
export async function reorderProductImagesAction(productId: string, ids: string[]): Promise<StoreActionResult> {
  const { workspace } = await requireSalesAdmin();
  if (!(await productoPropio(workspace.id, productId))) return NO_EXISTE;

  const fotos = await prisma.productImage.findMany({
    where: { productId, workspaceId: workspace.id },
    select: { id: true },
  });
  const actuales = new Set(fotos.map((f) => f.id));
  // Tiene que ser exactamente la misma galería: ni una de más (ajena), ni una de menos, ni
  // repetidas. Si no coincide, alguien la cambió en otra pestaña.
  const mismaGaleria =
    ids.length === actuales.size && new Set(ids).size === ids.length && ids.every((id) => actuales.has(id));
  if (!mismaGaleria) return { ok: false, error: "Las fotos cambiaron mientras tanto: recargá la página." };

  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.productImage.updateMany({
        where: { id, productId, workspaceId: workspace.id },
        data: { sortOrder: i },
      }),
    ),
  );

  refrescar(productId);
  return { ok: true };
}

/** `null` quita la tabla de talles. */
export async function setSizeChartAction(productId: string, url: string | null): Promise<StoreActionResult> {
  const { workspace } = await requireSalesAdmin();
  const producto = await productoPropio(workspace.id, productId);
  if (!producto) return NO_EXISTE;
  if (url !== null && !isAcceptableImageUrl(url)) return { ok: false, error: "Esa imagen no se pudo guardar." };

  try {
    if (producto.storeListing) {
      await prisma.productStoreListing.update({ where: { productId }, data: { sizeChartImageUrl: url } });
    } else {
      // La tabla de talles vive en la ficha online. Si todavía no hay ficha, se crea con los
      // valores de siempre —sólo mostrador—, que es exactamente cómo se vendía sin ficha.
      const slug = uniqueSlug(slugify(producto.name), await slugsTomados(workspace.id, productId));
      await prisma.productStoreListing.upsert({
        where: { productId },
        create: { workspaceId: workspace.id, productId, slug, sizeChartImageUrl: url },
        update: { sizeChartImageUrl: url },
      });
    }
  } catch (e) {
    if (esChoqueDeUnicidad(e)) return { ok: false, error: "No se pudo guardar: probá de nuevo." };
    throw e;
  }

  refrescar(productId);
  return { ok: true };
}
