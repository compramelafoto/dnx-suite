import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { armarGrilla } from "../grilla";
import { RolForm } from "../rol-form";

export const dynamic = "force-dynamic";

/** Editor de un rol: nombre, descripción y grilla de permisos. */
export default async function RolPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const { workspaceId } = await requireCommissionAdmin();

  const role = await prisma.workspaceCustomRole.findFirst({
    where: { id: roleId, workspaceId, archivedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: { select: { moduleKey: true, level: true, actions: true } },
    },
  });
  if (!role) notFound();

  const { filas, fueraDeLaGrilla, extras } = await armarGrilla(workspaceId, role.permissions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{role.name}</h2>
      <RolForm
        roleId={role.id}
        name={role.name}
        description={role.description ?? ""}
        filas={filas}
        extras={extras}
      />
      {fueraDeLaGrilla.length > 0 ? (
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          También tiene permisos en módulos que todavía no activaste: {fueraDeLaGrilla.join(", ")}. Se
          conservan y empiezan a valer cuando los actives.
        </p>
      ) : null}
    </div>
  );
}
