import { createHash } from "node:crypto";

/**
 * Tres solicitudes por hora, por correo y por origen.
 *
 * El número no sale de ninguna medición: sale de que una organización real manda una solicitud
 * y, si se equivocó, la manda de nuevo. Tres cubre el error humano con margen y corta el envío
 * automático.
 *
 * Se cuenta sobre `CoverageRequest`, sin tabla nueva: las filas que queremos limitar son
 * exactamente las que ya se guardan.
 */
export const PUBLIC_FORM_LIMIT = 3;
export const PUBLIC_FORM_WINDOW_MINUTES = 60;

export type EnvioDecision = { ok: true } | { ok: false; error: string };

/**
 * Función pura: recibe cuántos envíos hubo en la ventana y decide.
 *
 * Contar es problema del repositorio. Separarlo deja probar el caso que importa —que el cuarto
 * no entre— sin levantar una base.
 */
export function decidirEnvio(input: { recientes: number; tope?: number }): EnvioDecision {
  const tope = input.tope ?? PUBLIC_FORM_LIMIT;
  if (input.recientes < tope) return { ok: true };
  // Sin números en el mensaje: decir cuál es el tope y cuándo se libera le facilita el trabajo
  // a quien automatiza. A una persona real le alcanza con esto.
  return { ok: false, error: "Recibimos varias solicitudes desde acá. Probá más tarde." };
}

/**
 * Huella del origen para contar sin guardar la IP.
 *
 * Se guarda el hash y no la dirección: alcanza para agrupar envíos del mismo origen y para
 * demostrar procedencia, sin acumular un dato personal que nadie va a necesitar leer. La sal
 * hace que el hash no sea reversible con una tabla de todas las IPv4 posibles.
 */
export function hashOrigen(ip: string | null | undefined, salt: string): string | null {
  const valor = ip?.trim();
  if (!valor) return null;
  return createHash("sha256").update(`${salt}:${valor}`).digest("hex");
}
