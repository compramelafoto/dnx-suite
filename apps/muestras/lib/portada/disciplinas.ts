import { DISCIPLINE_LABELS, PHOTOGRAPHY, disciplinesPresent, temporalStatus, type Discipline } from "@repo/muestras";
import type { MuestraDeGrilla } from "@/components/portada/grilla-arte";
import { esUrlWeb } from "@/lib/url";

/** Sólo en Muestras de Arte: la portada filtra por disciplina con `?disciplina=PINTURA`. */

export type ChipDisciplina = { etiqueta: string; href: string; activo: boolean };

type ConDisciplinas = { primaryDiscipline?: string | null; otherDisciplines?: readonly string[] | null };

/** Arma `/?…#muestras` con los filtros que tienen valor, en el orden en que vienen. */
export function hrefPortada(filtros: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams(
    Object.entries(filtros).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
  ).toString();
  return `/${q ? `?${q}` : ""}#muestras`;
}

/**
 * «Todas» y después las disciplinas presentes en la lista (principal o secundaria), en el orden
 * de `DISCIPLINES`. La elegida aparece aunque ya no quede ninguna muestra con ella. Cada chip
 * conserva los demás filtros.
 */
export function chipsDeDisciplina(
  lista: readonly ConDisciplinas[],
  filtros: Record<string, string | null | undefined>,
  actual: Discipline | null,
): ChipDisciplina[] {
  const presentes = disciplinesPresent(actual ? [...lista, { primaryDiscipline: actual }] : lista);
  return [
    { etiqueta: "Todas", href: hrefPortada(filtros), activo: actual === null },
    ...presentes.map((d) => ({ etiqueta: DISCIPLINE_LABELS[d], href: hrefPortada({ ...filtros, disciplina: d }), activo: d === actual })),
  ];
}

type ParaGrilla = MuestraDeGrilla & { type: string; isCancelled: boolean; primaryDiscipline: string | null; startsAt: Date; endsAt: Date };

/** La grilla de arte: hasta 8 muestras que no son de fotografía, abiertas o próximas y con portada. */
export function muestrasParaGrilla(todas: readonly ParaGrilla[], ahora: Date): MuestraDeGrilla[] {
  return todas
    .filter((a) => a.type === "MUESTRA" && !a.isCancelled && !!a.primaryDiscipline && a.primaryDiscipline !== PHOTOGRAPHY)
    .filter((a) => esUrlWeb(a.coverImageUrl) && temporalStatus(a, ahora) !== "CLOSED")
    .slice(0, 8)
    .map(({ slug, title, coverImageUrl, organizersText }) => ({ slug, title, coverImageUrl, organizersText }));
}
