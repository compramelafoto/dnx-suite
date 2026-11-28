import "server-only";
import { Prisma, prisma } from "@/lib/prisma";
import { productsForAlbum } from "@/lib/pricing/album-scoped-products";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import { loadDesignTemplateVersion, type DesignTemplateVersion } from "@/lib/design-v2/template";
import type { CanjePhotoInput } from "@/lib/preventa-canjeable/preventa-canje-slots";
import { claveDeProducto, DIGITAL_KEY, type PlantillaDeProducto, type ProductoDeCompra } from "./compra-directa";

/**
 * Plantilla de cada producto con diseño del álbum (el librito).
 *
 * `PhotographerProduct` no tiene columna de plantilla: agregarla obliga a aplicar la migración en
 * las cuatro bases antes de publicar, y si falta en una se cae todo lo que lee productos (el
 * checkout entero). La plantilla ya está atada al producto en la preventa del álbum: el
 * beneficio del pack («Librito: 2 fotos») dice qué producto es y con qué plantilla se arma. Se
 * toma de ahí: primero de la definición del pack y, si no la tiene, de los packs ya vendidos
 * (el snapshot de cada pedido guarda la plantilla con que se vendió). Si hay más de una, la del
 * pedido más nuevo.
 */
export async function plantillasDeProductosDelAlbum(albumId: number): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const definiciones = await prisma.benefitDefinition.findMany({
    where: {
      packDefinition: { albumId },
      photographerProductId: { not: null },
      templateV2Id: { not: null },
      templatePolicy: "REQUIRED",
    },
    select: { photographerProductId: true, templateV2Id: true },
    orderBy: { id: "desc" },
  });
  for (const d of definiciones) {
    if (d.photographerProductId != null && d.templateV2Id && !out.has(d.photographerProductId)) {
      out.set(d.photographerProductId, d.templateV2Id);
    }
  }
  const vendidos = await prisma.$queryRaw<Array<{ productId: number; templateId: string }>>(Prisma.sql`
    SELECT (b->>'photographerProductId')::int AS "productId", b->>'templateV2Id' AS "templateId"
    FROM "Order" o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o."preventaPackSnapshotJson"->'benefits') = 'array'
        THEN o."preventaPackSnapshotJson"->'benefits' ELSE '[]'::jsonb END
    ) AS b
    WHERE o."albumId" = ${albumId}
      AND o."preventaPackSnapshotJson" IS NOT NULL
      AND b->>'templatePolicy' = 'REQUIRED'
      AND coalesce(b->>'templateV2Id', '') <> ''
      AND (b->>'photographerProductId') ~ '^[0-9]+$'
    GROUP BY 1, 2
    ORDER BY max(o.id) DESC
  `);
  for (const v of vendidos) {
    if (!out.has(v.productId)) out.set(v.productId, v.templateId);
  }
  return out;
}

/** Cuántas fotos distintas pide la plantilla (los huecos que comparten foto cuentan una vez). */
export function fotosDeLaPlantilla(template: Pick<DesignTemplateVersion, "slots">): number {
  return new Set(template.slots.map((s) => s.slotNumber)).size;
}

/**
 * Qué pide cada lugar del librito. Si la plantilla nombra sus huecos se usa ese nombre; si son
 * huecos numerados ("Foto 1") se dice la forma, que es lo que la familia tiene que mirar al
 * elegir: una foto vertical para la tapa, una horizontal para la contratapa.
 */
export function lugaresDeLaPlantilla(template: Pick<DesignTemplateVersion, "slots">): CanjePhotoInput[] {
  const vistos = new Set<number>();
  const out: CanjePhotoInput[] = [];
  for (const s of [...template.slots].sort((a, b) => a.slotNumber - b.slotNumber)) {
    if (vistos.has(s.slotNumber)) continue;
    vistos.add(s.slotNumber);
    const generico = !s.label || /^foto\s*\d+$/i.test(s.label.trim());
    const forma = s.width > 0 && s.height > 0 ? (s.height >= s.width ? "vertical" : "horizontal") : null;
    out.push({ label: generico ? (forma ? `Foto ${forma}` : `Foto ${out.length + 1}`) : s.label, role: s.role });
  }
  return out;
}

export type PlantillaCargada = PlantillaDeProducto & { template: DesignTemplateVersion };

/** Las plantillas de los productos del álbum, ya cargadas, sólo si se pueden usar. */
export async function plantillasCargadasDelAlbum(albumId: number, productIds?: number[]): Promise<Map<number, PlantillaCargada>> {
  const ids = await plantillasDeProductosDelAlbum(albumId);
  const out = new Map<number, PlantillaCargada>();
  for (const [productId, templateId] of ids) {
    if (productIds && !productIds.includes(productId)) continue;
    const template = await loadDesignTemplateVersion({ templateId }).catch(() => null);
    if (!template || template.slots.length === 0) continue;
    out.set(productId, { templateId, photoCount: fotosDeLaPlantilla(template), template });
  }
  return out;
}

type AlbumParaVender = {
  id: number;
  userId: number;
  enableDigitalPhotos: boolean | null;
  enablePrintedPhotos: boolean | null;
  photos: Array<{ id: number; sellDigital: boolean | null; sellPrint: boolean | null }>;
};

/** Precio final de una unidad, con la misma cuenta que el pedido (`computeCheckoutTotals`). */
async function precioDeUnaUnidad(
  albumId: number,
  item: { fileKey: string; tipo: "digital" | "impresa"; size: string; finish: string | null; productId: number | null; productName: string | null }
): Promise<number | null> {
  // Un reintento: un corte de conexión con la base no tiene que dejar el precio en blanco.
  for (let intento = 0; intento < 2; intento++) {
    try {
      const totals = await computeCheckoutTotals({
        flow: "ALBUM_ORDER",
        albumId,
        items: [{ ...item, quantity: 1, includedWithPrint: false, uploaderId: null, uploaderDigitalPriceCents: null }],
      });
      const v = Math.round(Number(totals.displayTotalCents));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch (err) {
      if (intento === 1) console.error("[compra-directa] no se pudo cotizar", { albumId, item: item.productId ?? "digital", err });
    }
  }
  return null;
}

/**
 * Lo que se ofrece en «¿Qué querés llevar?»: la copia digital, las impresas del álbum y el
 * librito, cada uno con su precio final a la familia. Se cotiza en el servidor con una foto
 * cualquiera del álbum (el precio no depende de la foto) para mostrarlo antes de la selfie sin
 * mostrar ninguna foto.
 */
export async function productosParaLlevar(album: AlbumParaVender): Promise<{
  productos: ProductoDeCompra[];
  plantillas: Map<number, PlantillaCargada>;
}> {
  const productos: ProductoDeCompra[] = [];
  const fotoDigital = album.photos.find((p) => p.sellDigital !== false);
  const fotoImpresa = album.photos.find((p) => p.sellPrint !== false);

  if (album.enableDigitalPhotos !== false && fotoDigital) {
    productos.push({
      key: DIGITAL_KEY,
      kind: "DIGITAL",
      productId: null,
      name: "Copia digital",
      size: null,
      finish: null,
      unitPriceArs: await precioDeUnaUnidad(album.id, {
        fileKey: albumPhotoFileKey(fotoDigital.id),
        tipo: "digital",
        size: "DIGITAL",
        finish: null,
        productId: null,
        productName: null,
      }),
      photosPerUnit: 1,
      templateId: null,
    });
  }

  if (album.enablePrintedPhotos === false || !fotoImpresa) return { productos, plantillas: new Map() };

  const delAlbum = productsForAlbum(
    await prisma.photographerProduct.findMany({
      where: { userId: album.userId, isActive: true },
      select: { id: true, name: true, size: true, acabado: true, albumId: true },
      orderBy: { id: "asc" },
    }),
    album.id
  ).filter((p) => p.size?.trim());
  const plantillas = await plantillasCargadasDelAlbum(
    album.id,
    delAlbum.map((p) => p.id)
  );

  for (const p of delAlbum) {
    const plantilla = plantillas.get(p.id);
    productos.push({
      key: claveDeProducto(p.id),
      kind: "PHYSICAL",
      productId: p.id,
      name: p.name,
      size: p.size,
      finish: p.acabado,
      unitPriceArs: await precioDeUnaUnidad(album.id, {
        fileKey: albumPhotoFileKey(fotoImpresa.id),
        tipo: "impresa",
        size: p.size ?? "",
        finish: p.acabado,
        productId: p.id,
        productName: p.name,
      }),
      photosPerUnit: plantilla ? plantilla.photoCount : 1,
      templateId: plantilla?.templateId ?? null,
      photoInputs: plantilla ? lugaresDeLaPlantilla(plantilla.template) : null,
    });
  }
  return { productos, plantillas };
}
