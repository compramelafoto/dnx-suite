import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolveEnabledNavModules } from "@/lib/modules/nav";
import { submodulesFor } from "@/lib/modules/submodules";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { getModuleLevels, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CASH_CONFIGURE_ACTION, COVERAGES_COORDINATE_ACTION } from "@/lib/permissions/actions";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { loadWorkspaceHome } from "@/lib/workspace-home/load";
import { WorkspaceHome } from "@/components/workspace-home/workspace-home";

export const dynamic = "force-dynamic";

/**
 * El inicio de la institución: cómo viene todo, de un vistazo.
 *
 * Arriba lo que espera una acción del equipo; después los cuatro números que dicen si la
 * institución está bien (socios, deuda, lo cobrado en el mes, la caja); después el detalle por
 * módulo. Al pie, todas las pantallas, para quien vino a buscar una en particular.
 *
 * Antes esta pantalla era una lista de módulos con sus pantallas: un índice, no un tablero.
 * Para saber cuánto se había cobrado había que entrar a Cuotas; para saber si había altas
 * esperando, a Solicitudes. Ahora se ve sin entrar a ningún lado.
 */
export default async function WorkspaceHomePage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  // La misma institución que muestra el encabezado y que usan las pantallas de cada módulo:
  // si el inicio leyera otra, sus números no coincidirían con los de la pantalla a la que llevan.
  const activa = await resolveActiveWorkspace(user.id);
  const workspaceId = activa?.id ?? ensured.workspaceId;
  const now = new Date();

  const [branding, profile, enabled, vocabulary, role, levels] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId } }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
    getEnabledModuleKeysForWorkspace(workspaceId),
    loadPersonVocabulary(workspaceId),
    resolveWorkspaceRole(user.id, workspaceId),
    getModuleLevels(user.id, workspaceId),
  ]);
  const [datos, puedeConfigurarCaja, puedeCoordinarCoberturas] = await Promise.all([
    loadWorkspaceHome({ workspaceId, levels, now }),
    hasModuleAction(user.id, workspaceId, CASH_MODULE_KEY, CASH_CONFIGURE_ACTION),
    hasModuleAction(user.id, workspaceId, COVERAGES_MODULE_KEY, COVERAGES_COORDINATE_ACTION),
  ]);
  const acceso = {
    levels,
    actions: [
      ...(puedeConfigurarCaja ? [CASH_CONFIGURE_ACTION] : []),
      ...(puedeCoordinarCoberturas ? [COVERAGES_COORDINATE_ACTION] : []),
    ],
  };
  // Sólo para el aviso "Completar los datos de la institución", que lleva a Configuración.
  const admin = canManageWorkspaceSettings(role);
  // Una tarjeta por módulo que esta persona puede al menos ver: las de un módulo en NONE
  // llevarían a un "no tenés permiso".
  const modulos = resolveEnabledNavModules(enabled, vocabulary).filter((m) =>
    hasLevel(levels[m.key] ?? "NONE", "VIEW"),
  );
  const puedeAdministrarSocios = levels[MEMBERS_MODULE_KEY] === "MANAGE";

  const nombre = (profile?.displayName ?? user.name ?? "").split(" ")[0] || "equipo";
  const institucion = branding?.commercialName?.trim() || activa?.name || "tu institución";
  const faltaConfigurar: string[] = [];
  if (admin) {
    if (!profile?.displayName) faltaConfigurar.push("tu nombre visible");
    if (!branding?.city) faltaConfigurar.push("la ciudad");
    if (!branding?.logoUrl) faltaConfigurar.push("el logo");
  }

  return (
    <WorkspaceHome
      now={now}
      nombre={nombre}
      institucion={institucion}
      publicSlug={branding?.publicSlug ?? null}
      datos={datos}
      vocabulary={vocabulary}
      admin={admin}
      puedeCrearSocio={puedeAdministrarSocios && enabled.has(MEMBERS_MODULE_KEY)}
      faltaConfigurar={faltaConfigurar}
      modulos={modulos.map((m) => ({
        ...m,
        // Las mismas pantallas, con la misma regla, que muestra el menú lateral.
        pantallas: submodulesFor(m.key, acceso, vocabulary),
      }))}
    />
  );
}
