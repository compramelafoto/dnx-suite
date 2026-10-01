import { createHash } from "node:crypto";

/**
 * El botón de arrepentimiento.
 *
 * Lo exige la Resolución 424/2020 de la Secretaría de Comercio Interior para cualquier
 * tienda que venda por internet en Argentina: un enlace **visible en la portada** que
 * lleve directo a un formulario para cancelar una compra, y una constancia de la
 * solicitud.
 *
 * El derecho de fondo es el artículo 34 de la Ley 24.240: **diez días corridos** para
 * revocar, sin tener que explicar por qué y sin costo.
 *
 * Esto es la mecánica. **Los textos los tiene que revisar un abogado** antes del
 * lanzamiento.
 */

/** Días corridos para revocar, contados desde la compra. */
export const DIAS_PARA_ARREPENTIRSE = 10;

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * ¿La compra todavía está en plazo?
 *
 * Sin fecha de compra devuelve `true`: **ante la duda se recibe la solicitud igual**.
 * Rechazar automáticamente por un dato que no tenemos sería negarle un derecho a alguien
 * por un problema nuestro; que el plazo lo resuelva una persona mirando el caso.
 */
export function dentroDelPlazo(compra: Date | null, ahora: Date): boolean {
  if (!compra) return true;
  return ahora.getTime() - compra.getTime() <= DIAS_PARA_ARREPENTIRSE * UN_DIA;
}

/**
 * El número de constancia que se le muestra a quien solicita.
 *
 * Sin `I`, `O`, `U`, `0` ni `1`: alguien lo va a dictar por teléfono o copiarlo a mano de
 * una pantalla, y la diferencia entre O y 0 se pierde en los dos casos.
 *
 * Derivado del identificador, no al azar: la misma solicitud da siempre la misma
 * constancia, así que un reintento no genera un número nuevo.
 */
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";

export function constanciaDesde(id: string, fecha: Date): string {
  const huella = createHash("sha256")
    .update(`${id}:${fecha.toISOString().slice(0, 10)}`)
    .digest();

  let salida = "";
  for (let i = 0; i < 6; i++) salida += ALFABETO[huella[i]! % ALFABETO.length];
  return `AR-${salida}`;
}

export type EntradaDeSolicitud = { email: string; referencia: string; motivo: string };

export type DatosDeSolicitud = { email: string; referencia: string; motivo: string | null };

export type RevisionDeSolicitud =
  | { ok: true; datos: DatosDeSolicitud }
  | { ok: false; error: string };

export function revisarSolicitud(entrada: EntradaDeSolicitud): RevisionDeSolicitud {
  const email = entrada.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Escribí el correo con el que hiciste la compra." };
  }

  const referencia = entrada.referencia.trim().slice(0, 80);
  if (!referencia) {
    return {
      ok: false,
      error: "Escribí el código del evento o el número de la compra, para saber cuál cancelar.",
    };
  }

  // El motivo es opcional porque la ley no obliga a explicar nada. Y si alguien escribe de
  // más, se recorta: perder el final es mejor que perder la solicitud entera.
  const motivo = entrada.motivo.trim().slice(0, 2000) || null;

  return { ok: true, datos: { email, referencia, motivo } };
}
