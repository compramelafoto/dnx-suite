import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Qué hay que crear para dar de alta SOYBELUZ, a partir de lo que ya existe. PURO: no toca la base
 * (eso lo hace `scripts/alta-soybeluz.ts`). Idempotente y sin pisar:
 *   - lo que ya existe se saltea;
 *   - a quien ya está en la institución no se le cambia el rol;
 *   - el sitio se carga sólo si no tiene páginas: una vez creado, es de Belén.
 */

export const WORKSPACE_ID = "ws_soybeluz";
export const SLUG = "soybeluz";
export const NOMBRE = "Soy Beluz";

/** Pedido de Daniel (4/11/2026): Belén es la dueña y Daniel administra. */
export const ADMINISTRADORES = [
  { email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
  { email: "dnxfotografia@gmail.com", role: "WORKSPACE_ADMIN" },
] as const;

/** Sitio, cursos y el padrón con su cuota (la suscripción se enciende de verdad en la Etapa 2). */
export const MODULOS = [WEBSITE_MODULE_KEY, COURSES_SALES_MODULE_KEY, MEMBERS_MODULE_KEY, MEMBERSHIP_DUES_MODULE_KEY] as const;

export type EstadoActual = {
  workspace: boolean;
  branding: boolean;
  membresias: { email: string; role: string }[];
  vocabulario: boolean;
  modulos: string[];
  /** `null` = no hay registro del sitio. */
  sitio: { tienePaginas: boolean } | null;
};

export type Accion =
  | { tipo: "crearWorkspace" }
  | { tipo: "crearBranding" }
  | { tipo: "crearMembresia"; email: string; role: (typeof ADMINISTRADORES)[number]["role"] }
  | { tipo: "crearVocabulario" }
  | { tipo: "encenderModulo"; key: string }
  | { tipo: "crearSitio" }
  | { tipo: "saltear"; motivo: string };

export function planDeAlta(estado: EstadoActual): Accion[] {
  const acciones: Accion[] = [];
  acciones.push(estado.workspace ? { tipo: "saltear", motivo: `ya existe la institución ${WORKSPACE_ID}` } : { tipo: "crearWorkspace" });
  acciones.push(estado.branding ? { tipo: "saltear", motivo: "ya tiene marca" } : { tipo: "crearBranding" });

  const yaEstan = new Set(estado.membresias.map((m) => m.email.trim().toLowerCase()));
  for (const admin of ADMINISTRADORES) {
    acciones.push(yaEstan.has(admin.email) ? { tipo: "saltear", motivo: `${admin.email} ya está en la institución` } : { tipo: "crearMembresia", email: admin.email, role: admin.role });
  }

  acciones.push(estado.vocabulario ? { tipo: "saltear", motivo: "ya tiene vocabulario" } : { tipo: "crearVocabulario" });

  const encendidos = new Set(estado.modulos);
  for (const key of MODULOS) {
    acciones.push(encendidos.has(key) ? { tipo: "saltear", motivo: `el módulo ${key} ya está encendido` } : { tipo: "encenderModulo", key });
  }

  acciones.push(estado.sitio?.tienePaginas ? { tipo: "saltear", motivo: "el sitio ya tiene páginas: no se pisa" } : { tipo: "crearSitio" });
  return acciones;
}
