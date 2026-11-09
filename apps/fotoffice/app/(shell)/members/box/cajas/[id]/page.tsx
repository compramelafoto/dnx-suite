import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireMembersManageContext } from "@/lib/members/access";
import { etiquetaBox, leerMateriales } from "@/lib/box-mensual/secuencia";
import { CajaForm } from "@/components/box-mensual/caja-form";

export default async function EditarCajaPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireMembersManageContext();
  const { id } = await params;
  const caja = await prisma.fotofficeBox.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, number: true, name: true, description: true, isActive: true, materials: true },
  });
  if (!caja) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{`Editar ${etiquetaBox(caja)}`}</h2>
        <Link href="/members/box/cajas" className="fo-btn fo-btn-secondary text-sm">
          Volver
        </Link>
      </div>
      <CajaForm caja={{ ...caja, materials: leerMateriales(caja.materials) }} />
    </div>
  );
}
