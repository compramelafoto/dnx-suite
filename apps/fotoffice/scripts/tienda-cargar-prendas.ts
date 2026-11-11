/**
 * Carga (o actualiza) en la tienda de DNX Estudio las prendas de Dreamful que no son remeras clásicas
 * u oversize: remera crop, remera infantil, buzo y musculosa. Un producto por diseño y tipo de prenda
 * ("Buzo The Camera Sutra"), con una variante por modelo y talle ("Buzo con capucha negro / M").
 * Las remeras de siempre las carga scripts/tienda-cargar-remeras.ts; los diseños se leen de ahí.
 *
 * Datos: scripts/datos/prendas-dnx.json (tipos, modelos, precios y talles) y
 * scripts/datos/remeras-dnx.json (diseños y estampas). Los mockups se armaron sobre las fotos lisas de
 * Dreamful y viven en public/tienda-prendas/dnx-estudio/<diseño>-<modelo>.webp, igual que las tablas
 * de talles (tabla-<tipo>.webp, copiadas de las fichas de Dreamful).
 *
 * Orden: cada diseño ocupa un bloque de 10 en `sortOrder` (la remera es orden*10); acá van +1, +2...
 * Así la vitrina muestra juntas las prendas de una misma estampa, y los chips de categoría
 * (Remeras, Buzos, Musculosas) filtran por tipo de prenda.
 *
 * Variable obligatoria: DATABASE_URL_FOTOFFICE (ver tienda-cargar-remeras.ts).
 *
 * Uso (desde apps/fotoffice):
 *   En seco:     DATABASE_URL_FOTOFFICE=... ../../packages/db/node_modules/.bin/tsx --import ./scripts/sin-server-only.mjs scripts/tienda-cargar-prendas.ts --workspace <id>
 *   Escribiendo: agregar --aplicar
 *
 * Idempotente por SKU: correrlo otra vez actualiza precios, textos, fotos y variantes.
 */
import { readFileSync } from "node:fs";
import { prisma, type PrismaClient } from "@repo/db";

const PROVEEDOR = { name: "Dreamful", email: "info@dreamful.com.ar", phone: "+541124635008" };
/** Orden de las categorías nuevas: después de "Remeras" (que tiene order 0). */
const ORDEN_CATEGORIA: Record<string, number> = { Remeras: 0, Buzos: 1, Musculosas: 2 };

type Modelo = { codigo: string; nombre: string; oscura: boolean; costo: string; precio: string; talles: string[] };
type Tipo = {
  codigo: string;
  nombre: string;
  slug: string;
  categoria: string;
  tabla: string;
  pesoGramos: number;
  texto: string;
  modelos: Modelo[];
};
type Prendas = { baseFotos: string; versionFotos?: string; tipos: Tipo[] };
type Disenos = {
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

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(new URL(`./datos/${archivo}`, import.meta.url), "utf8")) as T;
const archivo = (driveId: string) => `https://drive.google.com/file/d/${driveId}/view`;

function descripcion(tipo: Tipo, texto: string): string {
  return [
    texto,
    "",
    tipo.texto,
    "Elegí el modelo y tu talle. Se estampa a pedido, especialmente para vos.",
    "Se produce en 24 a 48 h hábiles y se envía a todo el país.",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--aplicar");
  const workspaceId = valorDe(args, "--workspace") ?? salir("Falta --workspace <id>.");
  const url = process.env.DATABASE_URL_FOTOFFICE ?? salir("Falta DATABASE_URL_FOTOFFICE.");
  const prendas = leer<Prendas>("prendas-dnx.json");
  const { disenos } = leer<Disenos>("remeras-dnx.json");
  const db = abrirCliente(url);

  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  if (!ws) salir("No existe ese workspace.");
  console.log(`Workspace: ${ws.name} · ${aplicar ? "ESCRIBIENDO" : "en seco (agregá --aplicar)"}`);

  const activos = disenos.filter((d) => d.activo);
  for (const t of prendas.tipos) {
    const variantes = t.modelos.reduce((n, m) => n + m.talles.length, 0);
    const precios = [...new Set(t.modelos.map((m) => m.precio))].join(" / ");
    console.log(`- ${t.nombre} (${t.categoria}): ${activos.length} diseños × ${variantes} variantes · $${precios}`);
  }
  if (!aplicar) {
    await db.$disconnect();
    return;
  }

  const proveedor = await db.fotofficeProveedor.upsert({
    where: { workspaceId_name: { workspaceId, name: PROVEEDOR.name } },
    create: { workspaceId, ...PROVEEDOR, notes: "Produce y envía las prendas de la tienda online (sin stock)." },
    update: { active: true },
    select: { id: true },
  });
  const categorias = new Map<string, string>();
  for (const nombre of new Set(prendas.tipos.map((t) => t.categoria))) {
    const c = await db.productCategory.upsert({
      where: { workspaceId_name: { workspaceId, name: nombre } },
      create: { workspaceId, name: nombre, order: ORDEN_CATEGORIA[nombre] ?? 99 },
      update: { isActive: true, order: ORDEN_CATEGORIA[nombre] ?? 99 },
      select: { id: true },
    });
    categorias.set(nombre, c.id);
  }

  for (const [orden, d] of disenos.entries()) {
    // Un diseño oculto (sin estampa final) no tiene mockups de estas prendas: no se crea nada.
    if (!d.activo) continue;
    for (const [it, t] of prendas.tipos.entries()) {
      const sku = `DNX-${d.codigo}-${t.codigo}`;
      const nombre = `${t.nombre} ${d.nombre}`;
      // `?v=` cambia cuando se rehacen los mockups: las URLs son las mismas y el CDN y los navegadores las cachean.
      const version = prendas.versionFotos ? `?v=${prendas.versionFotos}` : "";
      const foto = (m: Modelo) =>
        `${prendas.baseFotos}/${d.codigo.toLowerCase()}-${m.codigo.toLowerCase()}.webp${version}`;
      const precioBase = t.modelos.map((m) => Number(m.precio)).reduce((a, b) => Math.min(a, b));
      const costoMax = t.modelos.map((m) => Number(m.costo)).reduce((a, b) => Math.max(a, b));
      const texto = descripcion(t, d.descripcion);
      const comunes = {
        name: nombre,
        description: texto,
        brand: "DNX Estudio",
        categoryId: categorias.get(t.categoria)!,
        priceArs: String(precioBase),
        costArs: String(costoMax),
        tracksStock: false,
        supplierName: PROVEEDOR.name,
        preferredProveedorId: proveedor.id,
        imageUrl: foto(t.modelos[0]),
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
        onlineDescription: texto,
        sizeChartImageUrl: `${prendas.baseFotos}/${t.tabla}${version}`,
        weightGrams: t.pesoGramos,
        lengthCm: 30,
        widthCm: 25,
        heightCm: t.pesoGramos > 400 ? 6 : 3,
        sortOrder: orden * 10 + it + 1,
        fulfillmentProveedorId: proveedor.id,
        printFileUrl: d.estampaOscura ? archivo(d.estampaOscura) : null,
      };
      await db.productStoreListing.upsert({
        where: { productId: producto.id },
        create: { workspaceId, productId: producto.id, slug: `${t.slug}-${d.slug}`, ...listing },
        update: listing,
      });

      // Una foto por modelo, con el modelo en `alt` (la ficha salta a la foto del modelo elegido).
      await db.productImage.deleteMany({ where: { productId: producto.id } });
      await db.productImage.createMany({
        data: t.modelos.map((m, i) => ({ workspaceId, productId: producto.id, url: foto(m), alt: m.nombre, sortOrder: i })),
      });

      let sortOrder = 0;
      const vigentes: string[] = [];
      for (const m of t.modelos) {
        const estampa = m.oscura ? d.estampaOscura : d.estampaClara;
        for (const talle of m.talles) {
          const vSku = `${sku}-${m.codigo}-${talle}`;
          vigentes.push(vSku);
          const v = {
            name: `${m.nombre} / ${talle}`,
            sortOrder: sortOrder++,
            isActive: true,
            // Sin precio propio cuando coincide con el del producto: así la tarjeta no dice "desde".
            priceArs: Number(m.precio) === precioBase ? null : m.precio,
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
      console.log(`  ${d.activo ? "✓" : "(oculto)"} ${nombre}`);
    }
  }

  console.log("Listo.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
