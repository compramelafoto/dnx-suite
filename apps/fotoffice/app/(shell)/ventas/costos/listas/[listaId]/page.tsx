import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { leerLista, vistaPreviaLista } from "@/lib/precios-proveedor/repositorio";
import { EmparejarLista } from "./emparejar-lista";

export const dynamic = "force-dynamic";

export default async function ListaProveedorPage({ params }: { params: Promise<{ listaId: string }> }) {
  const { workspace } = await requireSalesAdmin();
  const { listaId } = await params;
  const [lista, vista, productos] = await Promise.all([
    leerLista(workspace.id, listaId),
    vistaPreviaLista(workspace.id, listaId),
    prisma.product.findMany({
      where: { workspaceId: workspace.id, isActive: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, preferredProveedorId: true, category: { select: { name: true } } },
    }),
  ]);
  if (!lista) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${lista.proveedor} · ${lista.vigencia}`}
        description={
          lista.estado === "BORRADOR"
            ? "Revisá con qué producto va cada renglón, mirá la vista previa y aplicá."
            : lista.estado === "APLICADA"
              ? "Esta lista ya se aplicó. Queda como historial de costos del proveedor."
              : "Esta lista se descartó."
        }
        actions={
          <Link href="/ventas/costos/listas" className="fo-btn fo-btn-ghost text-sm">
            Volver a las listas
          </Link>
        }
      />
      <EmparejarLista
        lista={lista}
        vistaInicial={vista}
        productos={productos.map((p) => ({
          id: p.id,
          name: p.name,
          categoryName: p.category?.name ?? null,
          deEsteProveedor: p.preferredProveedorId === lista.proveedorId,
        }))}
      />
    </div>
  );
}
