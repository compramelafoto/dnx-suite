import { requireCommissionAdmin } from "@/lib/commission/access";
import { armarGrilla } from "../grilla";
import { RolForm } from "../rol-form";

export const dynamic = "force-dynamic";

/** Rol nuevo, con la grilla en "Sin acceso". Es una ruta fija: gana sobre `[roleId]`. */
export default async function NuevoRolPage() {
  const { workspaceId } = await requireCommissionAdmin();
  const { filas, extras } = await armarGrilla(workspaceId, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Nuevo rol</h2>
      <RolForm roleId={null} name="" description="" filas={filas} extras={extras} />
    </div>
  );
}
