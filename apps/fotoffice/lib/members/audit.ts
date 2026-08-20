import type { AuthUser } from "@/lib/auth";
import type { MemberStatus } from "./status-labels";

/**
 * Snapshot legible del administrador que ejecuta la operación. Se guarda junto a la FK para
 * que el historial siga entendiéndose aunque después ese usuario cambie de nombre, se
 * desactive o su cuenta se elimine (la FK queda en null y el label sobrevive).
 *
 * Se prefiere el nombre visible; el email es el respaldo cuando el usuario no tiene nombre
 * cargado — por eso el historial queda restringido a OWNER/ADMIN, que ya pueden ver los datos
 * de contacto del padrón. Nunca se guardan tokens ni credenciales.
 */
export function auditActorFrom(user: AuthUser): { userId: number; label: string } {
  const name = user.name?.trim();
  return { userId: user.id, label: name || user.email };
}

/**
 * Estados que exigen justificar el porqué. Suspender o dar de baja a un socio tiene
 * consecuencias institucionales (pierde beneficios, carnet, acceso): el historial no sirve de
 * nada si no dice por qué se hizo. Reactivar no lo exige — devolver derechos no necesita
 * defensa, y forzar un motivo ahí solo produciría textos vacíos de relleno.
 */
const STATUS_REQUIRING_REASON: readonly MemberStatus[] = ["SUSPENDED", "INACTIVE"];

export function statusRequiresReason(status: MemberStatus): boolean {
  return STATUS_REQUIRING_REASON.includes(status);
}

/**
 * Un motivo de solo espacios es lo mismo que no haber puesto motivo. Devuelve el texto
 * recortado, o null si no hay nada real.
 */
export function normalizeReason(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}
