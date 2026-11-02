import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CargarMarcos } from "@/components/probador/cargar-marcos";
import { requireSalesStaff } from "@/lib/sales/access";
import { marcosParaCargar } from "@/lib/probador/marcos.server";

export const dynamic = "force-dynamic";

/**
 * Los marcos reales del probador: por cada producto marco de Ventas y cada color, la foto de frente
 * que lo dibuja en la pared del cliente. El precio sale de Ventas (marco + ampliación de la foto).
 */
export default async function MarcosDelProbadorPage() {
  const { workspace } = await requireSalesStaff();
  const productos = await marcosParaCargar(workspace.id);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcos del probador"
        description="Cargá una foto de frente de cada marco y color. Desde ese momento el cliente lo ve en su pared, en todas las medidas que vendés. El precio es el del marco más el de la ampliación de la foto."
        actions={<Link href="/probador" className="fo-btn fo-btn-secondary">Volver al probador</Link>}
      />
      <CargarMarcos productos={productos} />
    </div>
  );
}
