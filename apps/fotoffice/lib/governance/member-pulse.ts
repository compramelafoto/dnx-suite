import type { ProjectStatus } from "./constants";

/**
 * Lo que piensan los socios de un proyecto visible. Módulo PURO.
 *
 * No es la votación de la comisión ni decide nada: es una encuesta para que la comisión sepa a
 * qué darle importancia. Es privada: ninguna pantalla dice quién votó qué. El socio ve sólo su
 * propio voto; la comisión, sólo los totales.
 */

/** Mientras el proyecto siga vivo: antes de decidirlo y también en marcha. */
const ABIERTA: ReadonlySet<ProjectStatus> = new Set(["PROPOSED", "IN_REVIEW", "POSTPONED", "APPROVED", "IN_PROGRESS"]);

export function isMemberPollOpen(project: { status: string; visibleToMembers: boolean }): boolean {
  return project.visibleToMembers && ABIERTA.has(project.status as ProjectStatus);
}

/** Opiniones abiertas por socio y proyecto: alcanza para decir lo suyo sin llenar la pantalla. */
export const MAX_MEMBER_COMMENTS_PER_PROJECT = 10;

export type MemberPulse = { for: number; against: number; total: number; percentFor: number };

export function memberPulse(counts: { for: number; against: number }): MemberPulse {
  const total = counts.for + counts.against;
  return { ...counts, total, percentFor: total === 0 ? 0 : Math.round((counts.for / total) * 100) };
}

export function memberPulseLabel(p: MemberPulse): string {
  if (p.total === 0) return "Ningún socio votó todavía";
  const apoyan = p.for === 1 ? "lo apoya" : "lo apoyan";
  return `${p.for} de ${p.total} socio${p.total === 1 ? "" : "s"} ${apoyan} (${p.percentFor} %)`;
}

/** Color para la lista: verde si lo apoya la mayoría clara, rojo si la mayoría no. */
export function memberPulseTone(p: MemberPulse): "neutral" | "success" | "warning" | "danger" {
  if (p.total === 0) return "neutral";
  if (p.percentFor >= 66) return "success";
  if (p.percentFor < 40) return "danger";
  return "warning";
}

/**
 * Los proyectos que más apoyan los socios: primero por cantidad de apoyos (un 100 % de 2 votos
 * pesa menos que un 80 % de 40) y, a igual cantidad, por porcentaje. Sin votos, no entran.
 */
export function rankByMemberSupport<T extends { pulse: MemberPulse }>(items: readonly T[]): T[] {
  return items
    .filter((i) => i.pulse.total > 0)
    .sort((a, b) => b.pulse.for - a.pulse.for || b.pulse.percentFor - a.pulse.percentFor);
}
