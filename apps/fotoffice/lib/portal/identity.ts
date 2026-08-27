/**
 * Identidad del socio en el portal.
 *
 * Función pura y sin base de datos: lo que ve el socio sobre sí mismo tiene que poder
 * probarse, porque un error acá se lo muestra a cada persona sobre su propia pertenencia.
 *
 * El padrón viene migrado de otro sistema, así que las fechas pueden ser inválidas o
 * futuras. Nada de eso puede romper la pantalla.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export type Seniority = {
  /** "junio de 2015". `null` si la fecha no sirve. */
  desde: string | null;
  /** Años cumplidos. `null` si todavía no cumplió uno, o si la fecha no sirve. */
  anios: number | null;
};

export function describeSeniority(joinedAt: Date, now: Date): Seniority {
  if (Number.isNaN(joinedAt.getTime())) return { desde: null, anios: null };

  const mes = MESES[joinedAt.getUTCMonth()];
  const desde = mes ? `${mes} de ${joinedAt.getUTCFullYear()}` : null;

  // Años cumplidos, comparando por (mes, día): quien se asoció un 27 de agosto cumple
  // años el 27, no el 28.
  let anios = now.getUTCFullYear() - joinedAt.getUTCFullYear();
  const antesDelAniversario =
    now.getUTCMonth() < joinedAt.getUTCMonth() ||
    (now.getUTCMonth() === joinedAt.getUTCMonth() && now.getUTCDate() < joinedAt.getUTCDate());
  if (antesDelAniversario) anios -= 1;

  return { desde, anios: anios >= 1 ? anios : null };
}
