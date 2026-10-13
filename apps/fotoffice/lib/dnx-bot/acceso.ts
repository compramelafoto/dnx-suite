import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede, type AccesoEfectivo } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { QUOTES_MODULE_KEY, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { leerConfigBot, MODULO_DNX_BOT, plataformaDe } from "./config";
import { avisarSinClave } from "./incidentes";

/**
 * Las puertas de DNX Bot en FOTOFFICE (spec §8), en una sola función que usan el panel, `estado`,
 * `chat` y `acciones`. Van en orden y la primera que falla corta: las dos primeras no tocan ni la
 * sesión ni la base (cada página del panel pasa por acá). El workspace sale SIEMPRE de la sesión
 * (`resolveActiveWorkspace`), nunca de lo que manda el navegador.
 *
 * Las capacidades se deciden con `puede` (el adaptador de permisos de main), no con el rol crudo:
 * - `configurar` (dueño o admin): etapa 1 y todo lo que calcula o muestra costos (R4);
 * - `gestionarPresupuestos`: «Gestionar» en Presupuestos (escrituras de presupuestos);
 * - `verConsultas`: «Ver» en Consultas.
 */

/** Empresas de fotografía: el bot no es para instituciones (decisión de Daniel, 12/10). */
export const TIPOS_DE_EMPRESA: readonly string[] = [
  "PHOTO_STUDIO",
  "PHOTOGRAPHY_COMPANY",
  "FREELANCE_PHOTOGRAPHER",
  "AGENCY_PRODUCTION",
];

export type Capacidades = { configurar: boolean; gestionarPresupuestos: boolean; verConsultas: boolean };

export type CtxBot = CtxPresupuestos & {
  email: string;
  nombre: string | null;
  workspaceNombre: string;
  capacidades: Capacidades;
  /** "FOTOFFICE:<workspaceId>". */
  plataforma: string;
};

export type MotivoApagado =
  | "interruptor"
  | "sin_clave"
  | "sin_sesion"
  | "sin_workspace"
  | "sin_piloto"
  | "tipo_de_organizacion"
  | "modulos"
  | "sin_permiso";

export type ResultadoPuertas = { ok: true; ctx: CtxBot } | { ok: false; motivo: MotivoApagado };

/** El tipo nuevo manda; si está vacío, se mira el `activityType` viejo normalizado. */
export function esEmpresaDeFotografia(organizationType: string | null | undefined, activityType: string | null | undefined): boolean {
  const tipo = normalizeFotofficeOrganizationType(organizationType) || normalizeFotofficeOrganizationType(activityType);
  return TIPOS_DE_EMPRESA.includes(tipo);
}

export function capacidadesDe(acceso: AccesoEfectivo): Capacidades {
  return {
    configurar: puede(acceso, "configurar"),
    gestionarPresupuestos: puede(acceso, "operar", QUOTES_MODULE_KEY),
    verConsultas: puede(acceso, "ver", SERVICE_LEADS_MODULE_KEY),
  };
}

const no = (motivo: MotivoApagado): ResultadoPuertas => ({ ok: false, motivo });

export async function resolverBot(): Promise<ResultadoPuertas> {
  // 1 y 2: sin sesión ni base.
  const cfg = leerConfigBot();
  if (!cfg.enabled) return no("interruptor");
  if (!cfg.anthropicApiKey) {
    await avisarSinClave();
    return no("sin_clave");
  }

  // 3: sesión, workspace activo y rol de equipo (un socio del portal no tiene rol en el workspace).
  const user = await getAuthUser();
  if (!user) return no("sin_sesion");
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return no("sin_workspace");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!acceso.role) return no("sin_workspace");

  // 4: piloto (fila oculta, fuera del registro de módulos).
  if (!(await isModuleEnabledForWorkspace(workspace.id, MODULO_DNX_BOT))) return no("sin_piloto");

  // 5: sólo empresas de fotografía.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { organizationType: true, activityType: true },
  });
  if (!esEmpresaDeFotografia(branding?.organizationType, branding?.activityType)) return no("tipo_de_organizacion");

  // 6: Consultas y Presupuestos encendidos.
  const [consultas, presupuestos] = await Promise.all([
    isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY),
    isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY),
  ]);
  if (!consultas || !presupuestos) return no("modulos");

  // 7: al menos «Ver» en Presupuestos.
  if (!puede(acceso, "ver", QUOTES_MODULE_KEY)) return no("sin_permiso");

  return {
    ok: true,
    ctx: {
      workspaceId: workspace.id,
      workspaceNombre: workspace.name,
      userId: user.id,
      userLabel: etiquetaDeUsuario(user),
      role: acceso.role,
      acceso,
      email: user.email,
      nombre: user.name,
      capacidades: capacidadesDe(acceso),
      plataforma: plataformaDe(workspace.id),
    },
  };
}
