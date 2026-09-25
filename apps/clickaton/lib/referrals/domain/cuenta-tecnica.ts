/**
 * Cuentas que existen por razones técnicas y a las que no hay que escribirles:
 * las que dejan las pruebas automatizadas.
 *
 * Un correo a una casilla inventada rebota, y los rebotes le bajan la
 * reputación al dominio que sí usamos para escribirle a la gente.
 */

const DOMINIOS_TECNICOS = ["@dnxsuite.com"];
const PREFIJOS_TECNICOS = ["e2e.", "smoke.", "fixture."];

export function esCuentaTecnica(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    DOMINIOS_TECNICOS.some((d) => e.endsWith(d)) ||
    PREFIJOS_TECNICOS.some((p) => e.startsWith(p))
  );
}
