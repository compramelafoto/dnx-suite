import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { PolaroidEstudio } from "@/components/polaroid/polaroid-estudio";
import { requirePolaroid } from "@/lib/polaroid/acceso";
import { decimalArsToMinor } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

/**
 * Polaroid: el diseñador de CompraMeLaFoto (encuadre, textura del marco y textos) para armar las
 * planchas en el local. Cada polaroid se cobra con su producto del catálogo
 * (`lib/polaroid/productos.ts`); acá sólo se leen para mostrar el precio.
 */
export default async function PolaroidPage() {
  const { workspace, puedeCobrar } = await requirePolaroid();
  const productos = await prisma.product.findMany({
    where: { workspaceId: workspace.id, isActive: true, sku: { startsWith: "POL-" } },
    select: { sku: true, name: true, priceArs: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polaroid"
        description="Subí las fotos, encuadralas, elegí la textura del marco y sumá un texto. Bajás las planchas listas para imprimir."
      />
      <PolaroidEstudio
        productos={productos.flatMap((p) => (p.sku ? [{ sku: p.sku, nombre: p.name, precioMinor: decimalArsToMinor(p.priceArs) }] : []))}
        puedeCobrar={puedeCobrar}
      />
    </div>
  );
}
