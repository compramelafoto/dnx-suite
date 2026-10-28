import { INITIAL_CUANTO_COBRO_PROFILE, normalizeStudioStructure } from "@repo/cuanto-cobro-core";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { botEnPanel } from "@/lib/dnx-bot/panel";
import { datosDeMiEstudio } from "@/lib/precios/estudio-servidor";
import { hayPerfilDelPortalParaCopiar } from "@/lib/cuanto-cobro-socio/perfil";
import { PerfilForm } from "./perfil-form";
import { CopiarPerfilDelPortal } from "./copiar-perfil-del-portal";

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

  const ctx = { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
  const [[guardado, estudio], bot, copiable] = await Promise.all([
    // Mi estudio: sólo se ofrece a workspaces de tipo estudio; los miembros, para vincular a cada persona.
    // Va después del perfil: con el local separado, las ventas del local salen de las categorías guardadas.
    leerPerfilPrecios(ctx).then(async (g) => {
      const estructura = normalizeStudioStructure(g?.perfil.studioStructure);
      return [g, await datosDeMiEstudio(workspace.id, estructura?.enabled && estructura.separateLocal ? estructura : null)] as const;
    }),
    // DNX Bot: el formulario es el camino principal; armarlo conversando se ofrece sólo si la persona
    // parece trabada (`OfertaArmarConversando`, dentro del formulario) y el bot está encendido.
    botEnPanel(),
    // Quien creó su negocio desde el portal de socio y ya había armado su ¿Cuánto Cobro? ahí.
    hayPerfilDelPortalParaCopiar(ctx),
  ]);

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
      {guardado?.source === "portal" ? (
        <p role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Copiado de tu ¿Cuánto Cobro? del portal de socio.
        </p>
      ) : null}
      {copiable ? <CopiarPerfilDelPortal /> : null}
      {guardado?.source === "dnx-bot" ? (
        <p role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Armado con DNX Bot.
        </p>
      ) : null}
      <PerfilForm
        // Al copiar el perfil del portal cambia la versión: el formulario arranca de nuevo con él.
        key={guardado ? guardado.actualizado.toISOString() : "sin-perfil"}
        inicial={guardado?.perfil ?? INITIAL_CUANTO_COBRO_PROFILE}
        version={guardado ? guardado.actualizado.toISOString() : null}
        bot={bot ? { workspaceId: workspace.id } : null}
        estudio={estudio}
      />
    </div>
  );
}
