import { PUBLIC_CODE_PREFIX } from "./constants";

/**
 * El código que se dice por teléfono: `SC-2026-0042`.
 *
 * **No abre nada.** Es correlativo y legible justamente porque no es una credencial: lo que da
 * acceso al seguimiento es el token del enlace. Si el código abriera la ventana, cualquiera
 * probaría el 43 y vería el pedido de otra organización.
 *
 * Se reinicia cada año para que el número diga algo de un vistazo.
 */
export function buildPublicCode(input: { year: number; sequence: number }): string {
  const numero = String(input.sequence).padStart(4, "0");
  return `${PUBLIC_CODE_PREFIX}-${input.year}-${numero}`;
}

export function parsePublicCode(code: string): { year: number; sequence: number } | null {
  const m = new RegExp(`^${PUBLIC_CODE_PREFIX}-(\\d{4})-(\\d+)$`, "i").exec(code.trim());
  if (!m) return null;
  return { year: Number(m[1]), sequence: Number(m[2]) };
}

/**
 * El siguiente código del workspace.
 *
 * Un código previo ilegible NO frena un alta: se empieza de nuevo ese año. Una organización
 * que quiere pedir una cobertura no puede quedarse afuera porque una fila vieja tenga basura.
 */
export function nextPublicCode(lastCode: string | null | undefined, year: number): string {
  const previo = lastCode ? parsePublicCode(lastCode) : null;
  const siguiente = previo && previo.year === year ? previo.sequence + 1 : 1;
  return buildPublicCode({ year, sequence: siguiente });
}
