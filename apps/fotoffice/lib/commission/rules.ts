import { isModuleEffectivelyEnabled } from "@/lib/permissions/levels";

/**
 * Reglas puras de la Comisión directiva que usan las acciones del servidor. Sin red ni base.
 */

type Period = { startsAt: Date | null; endsAt: Date | null; revokedAt: Date | null };

/**
 * Mandato o asignación que todavía cuenta: vigente hoy o con inicio futuro. Lo vencido o revocado
 * es historial. Se usa para no duplicar, para editar y para pedir confirmación al archivar: un
 * mandato que empieza el mes que viene también es de alguien.
 */
export function isCurrentOrUpcoming(p: Period, now: Date): boolean {
  if (p.revokedAt) return false;
  if (p.endsAt && p.endsAt <= now) return false;
  return true;
}

const same = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "accent" }) === 0;

/** "<nombre> (copia)", "(copia 2)", "(copia 3)"… el primero que no esté usado. */
export function nextCopyName(base: string, existingNames: readonly string[]): string {
  const taken = (n: string) => existingNames.some((e) => same(e, n));
  let candidate = `${base} (copia)`;
  for (let i = 2; taken(candidate); i++) candidate = `${base} (copia ${i})`;
  return candidate;
}

const fechaAr = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Renombre al archivar, para liberar el nombre: "<nombre> (archivado dd/mm/aaaa)". */
export function archivedName(name: string, at: Date, existingNames: readonly string[]): string {
  const day = fechaAr.format(at);
  const taken = (n: string) => existingNames.some((e) => same(e, n));
  let candidate = `${name} (archivado ${day})`;
  for (let i = 2; taken(candidate); i++) candidate = `${name} (archivado ${day}, ${i})`;
  return candidate;
}

/**
 * Sube o baja un cargo un lugar. Devuelve el orden completo renumerado 0..n-1 (así dos cargos con
 * el mismo `order` dejan de empatar), o null si no se puede mover.
 */
export function reorderOffices(
  offices: readonly { id: string; order: number }[],
  officeId: string,
  direction: "up" | "down",
): { id: string; order: number }[] | null {
  const ids = offices.map((o) => o.id);
  const i = ids.indexOf(officeId);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  return ids.map((id, order) => ({ id, order }));
}

/**
 * Módulos cuya fila de la grilla puede editarse: disponibles hoy y habilitados en el workspace,
 * con el mismo criterio de habilitación que usa la resolución de permisos (alias de Cuotas).
 */
export function editableModuleKeys(availableKeys: readonly string[], enabled: ReadonlySet<string>): string[] {
  return availableKeys.filter((k) => isModuleEffectivelyEnabled(k, enabled));
}

/** Clave de persona para contar gente distinta: la ficha manda sobre la cuenta. */
export function personLabel(memberId: string | null, userId: number | null): string {
  if (memberId) return `m:${memberId}`;
  if (userId !== null) return `u:${userId}`;
  return "";
}

/** Choque con una clave única (P2002), p. ej. dos pestañas creando el mismo nombre a la vez. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}
