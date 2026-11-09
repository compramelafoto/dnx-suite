import Link from "next/link";
import { prisma } from "@repo/db";
import { requireMembersManageContext } from "@/lib/members/access";
import { CajaForm } from "@/components/box-mensual/caja-form";

/** Alta de una caja. Sugiere el N° siguiente al último cargado. */
export default async function NuevaCajaPage() {
  const { workspace } = await requireMembersManageContext();
  const ultima = await prisma.fotofficeBox.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Nueva caja</h2>
        <Link href="/members/box/cajas" className="fo-btn fo-btn-secondary text-sm">
          Volver
        </Link>
      </div>
      <CajaForm numeroSugerido={(ultima?.number ?? 0) + 1} />
    </div>
  );
}
