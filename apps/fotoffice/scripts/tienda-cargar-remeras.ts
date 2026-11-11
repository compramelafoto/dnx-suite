/**
 * Carga (o actualiza) las remeras de DNX Estudio en la tienda online: un producto por diseño y una
 * variante por modelo y talle ("Oversize negra / M"), producidas y enviadas por Dreamful.
 * Ver docs/superpowers/specs/2026-11-04-tienda-remeras-dreamful-design.md.
 *
 * Datos: scripts/datos/remeras-dnx.json (diseños, mockups y estampas en el Drive de Daniel).
 * Las fotos se sirven desde Drive (lh3.googleusercontent.com): la carpeta es pública. Los mockups
 * armados sobre las fotos de Dreamful traen `url` (viven en public/tienda-prendas/) en vez de `driveId`.
 * Los buzos, musculosas, crop e infantiles los carga scripts/tienda-cargar-prendas.ts.
 *
 * Variable obligatoria: DATABASE_URL_FOTOFFICE (no se usa DATABASE_URL: el cliente de @repo/db
 * puede cargar packages/db/.env, que apunta a otra base).
 *
 * Uso (desde apps/fotoffice):
 *   En seco:     DATABASE_URL_FOTOFFICE=... ../../packages/db/node_modules/.bin/tsx --import ./scripts/sin-server-only.mjs scripts/tienda-cargar-remeras.ts --workspace <id>
 *   Escribiendo: agregar --aplicar
 *
 * Idempotente por SKU: correrlo otra vez actualiza precios, textos, fotos y variantes.
 */
import { readFileSync } from "node:fs";
import { prisma, type PrismaClient } from "@repo/db";

const PRECIO = "35000";
/** Costo de Dreamful con 1 estampa, del modelo más caro (stone wash). Ver la spec. */
const COSTO = "18470";
const PROMO = { qty: 2, price: "60000", label: "Llevá 2 por $60.000" };
const CATEGORIA = "Remeras";
const PROVEEDOR = { name: "Dreamful", email: "info@dreamful.com.ar", phone: "+541124635008" };

const TALLES_OVERSIZE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const TALLES_CLASICA = ["S", "M", "L", "XL", "XXL"];

type Datos = {
  modelos: { codigo: string; nombre: string; oscura: boolean }[];
  disenos: {
    codigo: string;
    nombre: string;
    slug: string;
    activo: boolean;
    descripcion: string;
    estampaOscura: string | null;
    estampaClara: string | null;
    /** Archivo de impresión propio para algunos modelos (p. ej. líneas oscuras en colores claros). */
    estampaPorModelo?: Record<string, string>;
    mockups: { modelo: string; driveId?: string; url?: string }[];
  }[];
};

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function valorDe(args: string[], nombre: string): string | undefined {
  const i = args.indexOf(nombre);
  if (i < 0) return undefined;
  const valor = args[i + 1];
  if (valor === undefined || valor.startsWith("--")) salir(`Falta el valor de ${nombre}.`);
  return valor;
}

function abrirCliente(url: string): PrismaClient {
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  return new Clase({ datasourceUrl: url });
}

const foto = (m: { driveId?: string; url?: string }) =>
  m.url ?? `https://lh3.googleusercontent.com/d/${m.driveId ?? salir("Mockup sin driveId ni url.")}=w1600`;
/** Tabla de talles de Dreamful (oversize, clásica hombre y clásica mujer en una sola imagen). */
const TABLA_TALLES = "https://fotoffice.com/tienda-prendas/dnx-estudio/tabla-remera.webp?v=3";
const archivo = (driveId: string) => `https://drive.google.com/file/d/${driveId}/view`;
const talles = (codigoModelo: string) => (codigoModelo.startsWith("OV") ? TALLES_OVERSIZE : TALLES_CLASICA);

function descripcion(texto: string): string {
  return [
    texto,
    "",
    "Elegí el modelo y tu talle. Se estampa a pedido, especialmente para vos.",
    "Modelos: oversize unisex (negra, blanca o stone wash), clásica de hombre (negra, blanca o beige), clásica wash azul y clásica de mujer (negra o blanca).",
    "Se produce en 24 a 48 h hábiles y se envía a todo el país.",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--aplicar");
  const workspaceId = valorDe(args, "--workspace") ?? salir("Falta --workspace <id>.");
  const url = process.env.DATABASE_URL_FOTOFFICE ?? salir("Falta DATABASE_URL_FOTOFFICE.");
  const datos = JSON.parse(readFileSync(new URL("./datos/remeras-dnx.json", import.meta.url), "utf8")) as Datos;
  const db = abrirCliente(url);

  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  if (!ws) salir("No existe ese workspace.");
  console.log(`Workspace: ${ws.name} · ${aplicar ? "ESCRIBIENDO" : "en seco (agregá --aplicar)"}`);

  for (const d of datos.disenos) {
    const variantes = datos.modelos.flatMap((m) =>
      talles(m.codigo).map((t) => `${m.nombre} / ${t}`),
    );
    console.log(`- ${d.activo ? "" : "(oculto) "}Remera ${d.nombre}: ${variantes.length} variantes, ${d.mockups.length} fotos`);
  }
  if (!aplicar) {
    await db.$disconnect();
    return;
  }

  const categoria = await db.productCategory.upsert({
    where: { workspaceId_name: { workspaceId, name: CATEGORIA } },
    create: { workspaceId, name: CATEGORIA },
    update: { isActive: true },
    select: { id: true },
  });
  const proveedor = await db.fotofficeProveedor.upsert({
    where: { workspaceId_name: { workspaceId, name: PROVEEDOR.name } },
    create: { workspaceId, ...PROVEEDOR, notes: "Produce y envía las remeras de la tienda online (sin stock)." },
    update: { active: true },
    select: { id: true },
  });

  for (const [orden, d] of datos.disenos.entries()) {
    const sku = `DNX-${d.codigo}`;
    const nombre = `Remera ${d.nombre}`;
    const comunes = {
      name: nombre,
      description: descripcion(d.descripcion),
      brand: "DNX Estudio",
      categoryId: categoria.id,
      priceArs: PRECIO,
      costArs: COSTO,
      tracksStock: false,
      supplierName: PROVEEDOR.name,
      preferredProveedorId: proveedor.id,
      imageUrl: foto(d.mockups[0]),
      isActive: d.activo,
    };
    const producto = await db.product.upsert({
      where: { workspaceId_sku: { workspaceId, sku } },
      create: { workspaceId, sku, kind: "PRODUCTO", ...comunes },
      update: comunes,
      select: { id: true },
    });

    const listing = {
      sellOnline: d.activo,
      sellAtCounter: false,
      onlineTitle: nombre,
      onlineDescription: descripcion(d.descripcion),
      weightGrams: 250,
      lengthCm: 30,
      widthCm: 25,
      heightCm: 3,
      // De a 10 por diseño: tienda-cargar-prendas.ts pone el crop, el infantil, el buzo y la
      // musculosa del mismo diseño a continuación (orden*10 + 1, 2, ...).
      sortOrder: orden * 10,
      sizeChartImageUrl: TABLA_TALLES,
      fulfillmentProveedorId: proveedor.id,
      printFileUrl: d.estampaOscura ? archivo(d.estampaOscura) : null,
    };
    await db.productStoreListing.upsert({
      where: { productId: producto.id },
      create: { workspaceId, productId: producto.id, slug: `remera-${d.slug}`, ...listing },
      update: listing,
    });

    // Fotos: una por modelo, con el modelo en `alt` (la ficha salta a la foto del modelo elegido).
    await db.productImage.deleteMany({ where: { productId: producto.id } });
    await db.productImage.createMany({
      data: d.mockups.map((m, i) => ({ workspaceId, productId: producto.id, url: foto(m), alt: m.modelo, sortOrder: i })),
    });

    let sortOrder = 0;
    const vigentes: string[] = [];
    for (const m of datos.modelos) {
      const estampa = m.oscura ? d.estampaOscura : d.estampaClara;
      for (const t of talles(m.codigo)) {
        const vSku = `${sku}-${m.codigo}-${t}`;
        vigentes.push(vSku);
        const v = {
          name: `${m.nombre} / ${t}`,
          sortOrder: sortOrder++,
          isActive: true,
          priceArs: null,
          printFileUrl: d.estampaPorModelo?.[m.codigo] ?? (estampa ? archivo(estampa) : null),
        };
        await db.productVariant.upsert({
          where: { workspaceId_sku: { workspaceId, sku: vSku } },
          create: { workspaceId, productId: producto.id, sku: vSku, ...v },
          update: v,
        });
      }
    }
    // Una variante que ya no está en los datos se apaga (no se borra: puede tener pedidos).
    await db.productVariant.updateMany({
      where: { productId: producto.id, sku: { notIn: vigentes } },
      data: { isActive: false },
    });
  }

  await db.storeSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      bundleCategoryId: categoria.id,
      bundleQty: PROMO.qty,
      bundlePriceArs: PROMO.price,
      bundleLabel: PROMO.label,
    },
    update: {
      bundleCategoryId: categoria.id,
      bundleQty: PROMO.qty,
      bundlePriceArs: PROMO.price,
      bundleLabel: PROMO.label,
    },
  });

  console.log("Listo.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
