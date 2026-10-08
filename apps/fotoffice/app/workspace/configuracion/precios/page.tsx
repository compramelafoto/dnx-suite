import { INITIAL_CUANTO_COBRO_PROFILE } from "@repo/cuanto-cobro-core";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { PerfilForm } from "./perfil-form";

export const dynamic = "force-dynamic";

/**
 * Configuración → Precios: el perfil de ¿Cuánto Cobro? del workspace (costos, horas y valor de la
 * hora). Permiso: `configurar`, antes de cualquier lectura.
 */
export default async function ConfiguracionPreciosPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Precios" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los precios.</p>
      </div>
    );
  }

  const guardado = await leerPerfilPrecios({
    workspaceId: workspace.id,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Precios"
        description="Tus costos, tus horas y tu forma de trabajar. Con esto ¿Cuánto Cobro? calcula tus presupuestos."
      />
      {guardado?.source === "clf-import" ? (
        <p role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Importado de ¿Cuánto Cobro? de CompraMeLaFoto.
        </p>
      ) : null}
      <PerfilForm inicial={guardado?.perfil ?? INITIAL_CUANTO_COBRO_PROFILE} />
    </div>
  );
}
