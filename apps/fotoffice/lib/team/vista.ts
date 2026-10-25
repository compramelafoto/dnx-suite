import { etiquetaRol } from "@/lib/access/roles";
import { listModules } from "@/lib/modules/registry";
import { isModuleEffectivelyEnabled, legacyStaffLevel } from "@/lib/permissions/levels";

/**
 * Lo que muestra la pantalla Equipo, armado sin tocar la base ni Next: la página lee y esto
 * decide. Todas las fechas, en hora argentina (en Vercel el servidor está en UTC).
 */

const TZ = "America/Argentina/Buenos_Aires";
const dia = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

/** "17/10/2026". */
export function fechaEquipo(d: Date): string {
  return dia.format(d);
}

export type MiembroVista = {
  userId: number;
  nombre: string;
  email: string;
  role: string;
  rolEtiqueta: string;
  desde: string;
  esUnoMismo: boolean;
  /** Si se le puede dar de baja desde acá; si no, por qué no (para mostrarlo). */
  baja: { puede: true } | { puede: false; motivo: string | null };
};

export type InvitacionVista = {
  id: string;
  email: string;
  rolEtiqueta: string;
  enviada: string;
  vence: string;
  vencida: boolean;
  entrega: "ENVIADO" | "FALLO" | "SIN_ENVIAR";
};

export const ENTREGA_ETIQUETA: Record<InvitacionVista["entrega"], string> = {
  ENVIADO: "Correo enviado",
  FALLO: "El correo no salió",
  SIN_ENVIAR: "Correo sin enviar",
};

export const MOTIVO_COMISION =
  "Tiene roles de la Comisión directiva: se administra desde Comisión directiva.";

/**
 * Sólo se da de baja desde acá a alguien con rol Equipo que nunca tuvo roles de la comisión.
 * Dueños y administradores no se tocan (cambiar eso es otra decisión), y a quien tiene roles
 * de la comisión lo maneja esa pantalla: si se lo borrara desde acá, al volver a iniciar sesión
 * `syncStaffMembershipWithRoles` le devolvería la membresía y el acceso.
 */
export function motivoSinBaja(p: { role: string; esUnoMismo: boolean; tieneRolesComision: boolean }): string | null {
  if (p.esUnoMismo) return null;
  if (p.role !== "STAFF") return null;
  if (p.tieneRolesComision) return MOTIVO_COMISION;
  return "";
}

export function armarMiembros(
  filas: readonly {
    role: string;
    createdAt: Date;
    user: { id: number; name: string | null; email: string };
    tieneRolesComision: boolean;
  }[],
  actorUserId: number,
): MiembroVista[] {
  const orden: Record<string, number> = { WORKSPACE_OWNER: 0, WORKSPACE_ADMIN: 1, STAFF: 2, COLLABORATOR: 3 };
  return [...filas]
    .sort((a, b) => (orden[a.role] ?? 9) - (orden[b.role] ?? 9) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((f) => {
      const esUnoMismo = f.user.id === actorUserId;
      const motivo = motivoSinBaja({ role: f.role, esUnoMismo, tieneRolesComision: f.tieneRolesComision });
      return {
        userId: f.user.id,
        nombre: f.user.name?.trim() || f.user.email,
        email: f.user.email,
        role: f.role,
        rolEtiqueta: etiquetaRol(f.role),
        desde: fechaEquipo(f.createdAt),
        esUnoMismo,
        baja: motivo === "" ? { puede: true } : { puede: false, motivo },
      };
    });
}

export function armarInvitaciones(
  filas: readonly {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
    sentAt: Date | null;
    sendFailedAt: Date | null;
  }[],
  now: Date,
): InvitacionVista[] {
  return filas.map((i) => ({
    id: i.id,
    email: i.email,
    rolEtiqueta: etiquetaRol(i.role),
    enviada: fechaEquipo(i.sentAt ?? i.createdAt),
    vence: fechaEquipo(i.expiresAt),
    vencida: i.expiresAt.getTime() <= now.getTime(),
    // Un reintento que salió borra la marca de falla (`markTeamInvitationDelivery`).
    entrega: i.sentAt ? "ENVIADO" : i.sendFailedAt ? "FALLO" : "SIN_ENVIAR",
  }));
}

export type RolOfrecido = { value: string; label: string; descripcion: string };

/** Qué gestiona, qué sólo mira y qué no ve alguien con rol Equipo, con los módulos de ESTE espacio. */
export function resumenAccesoEquipo(
  enabled: ReadonlySet<string>,
  etiqueta: (label: string) => string = (l) => l,
): { gestiona: string[]; ve: string[] } {
  const gestiona: string[] = [];
  const ve: string[] = [];
  for (const m of listModules({ status: "AVAILABLE" })) {
    if (!isModuleEffectivelyEnabled(m.key, enabled)) continue;
    const nivel = legacyStaffLevel(m.key);
    if (nivel === "MANAGE") gestiona.push(etiqueta(m.label));
    else if (nivel === "VIEW") ve.push(etiqueta(m.label));
  }
  return { gestiona, ve };
}

function lista(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

/** Las opciones del selector de rol, con lo que puede cada una dicho en castellano llano. */
export function describirRoles(
  roles: readonly string[],
  resumen: { gestiona: string[]; ve: string[] },
): RolOfrecido[] {
  return roles.map((value) => {
    if (value === "WORKSPACE_ADMIN") {
      return {
        value,
        label: etiquetaRol(value),
        descripcion:
          "Puede todo, igual que el dueño: usar todos los módulos, cambiar la configuración e invitar o dar de baja a otras personas.",
      };
    }
    if (value === "STAFF") {
      const partes = [
        resumen.gestiona.length ? `Trabaja en ${lista(resumen.gestiona)}.` : "Todavía no hay módulos encendidos para trabajar.",
        resumen.ve.length ? `Sólo mira ${lista(resumen.ve)}.` : "",
        "No entra a la configuración ni gestiona el equipo.",
      ];
      return { value, label: etiquetaRol(value), descripcion: partes.filter(Boolean).join(" ") };
    }
    return {
      value,
      label: etiquetaRol(value),
      descripcion: "Sólo ve lo que le asignen desde Comisión directiva.",
    };
  });
}
