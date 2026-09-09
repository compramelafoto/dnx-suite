import { APERTURA_PERIOD, chargePeriodLabel } from "@/lib/membership/charge-labels";
import type { EntrantInput } from "./entrants";

/**
 * Quién entra en el padrón del sorteo.
 *
 * Módulo PURO: recibe los cargos ya leídos y decide. La consulta vive en `repository.ts`.
 *
 * La regla vive acá, tipada, y no como JSON de configuración: es la definición de "socio al
 * día" para este módulo, y una regla que se puede editar desde una pantalla es una regla que
 * se puede editar después de ver el número de drand.
 *
 * Todo se mide contra el CIERRE DEL PADRÓN, nunca contra "ahora". Son dos preguntas
 * distintas, y contestar la primera con la segunda haría que la lista congelada cambiara
 * según cuándo se la mire.
 *
 * ── Por qué la deuda de apertura no bloquea ──
 *
 * `APERTURA` es el saldo migrado del sistema anterior. Hay 48 socios cuya deuda todavía no se
 * pudo verificar contra el reporte de pagos previo a 10/2025. Dejarlos afuera del primer
 * sorteo por una cifra que la propia institución no puede justificar sería la peor manera de
 * estrenar el módulo. Las cuotas mensuales, las de ingreso y el carnet impreso sí bloquean.
 */

export type ChargeForRaffle = {
  period: string;
  dueDate: Date;
  balanceMinor: number;
};

export type MemberForRaffle = {
  memberId: string;
  memberNumber: string;
  fullName: string;
  /** `MemberStatus` como texto: ACTIVE | SUSPENDED | INACTIVE. */
  status: string;
  charges: ChargeForRaffle[];
};

export type Eligibility = {
  eligible: boolean;
  /** En castellano y listo para mostrarle al socio. `null` cuando participa. */
  reason: string | null;
};

export function isEligible(member: MemberForRaffle, closeAt: Date): Eligibility {
  if (member.status !== "ACTIVE") {
    return { eligible: false, reason: "Tu ficha de socio no está activa." };
  }

  const vencidas = member.charges
    .filter((c) => c.balanceMinor > 0)
    .filter((c) => c.period !== APERTURA_PERIOD)
    .filter((c) => c.dueDate.getTime() < closeAt.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (vencidas.length === 0) return { eligible: true, reason: null };

  // El nombre legible y no el período crudo: `chargePeriodLabel` es el mismo que usa la
  // cuenta del socio, así que dice "agosto de 2026" y nunca "2026-08".
  const masVieja = chargePeriodLabel(vencidas[0].period);
  const resto = vencidas.length > 1 ? ` y ${vencidas.length - 1} más` : "";
  return { eligible: false, reason: `Tenés pendiente ${masVieja}${resto}.` };
}

/** El padrón: los que participan, con lo mínimo que la huella necesita. */
export function selectEntrants(
  members: readonly MemberForRaffle[],
  closeAt: Date,
): EntrantInput[] {
  return members
    .filter((m) => isEligible(m, closeAt).eligible)
    .map((m) => ({ memberId: m.memberId, memberNumber: m.memberNumber, fullName: m.fullName }));
}
