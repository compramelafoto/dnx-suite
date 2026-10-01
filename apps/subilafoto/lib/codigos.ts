import { randomInt } from "node:crypto";

/**
 * Códigos de acceso del evento.
 *
 * El del invitado lo va a tener que dictar alguien en un salón con música fuerte, así que
 * el alfabeto excluye lo que se confunde al oído y a la vista: O y 0, I y 1 y l, y la U
 * (que en español se escucha parecido a la O por teléfono).
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

const LARGO_INVITADO = 6;
// La pantalla es más largo a propósito: nadie lo dicta, y quien lo adivine puede
// tomar el control de la proyección durante una fiesta.
const LARGO_PANTALLA = 10;

function generar(largo: number): string {
  let salida = "";
  for (let i = 0; i < largo; i++) {
    // randomInt del módulo crypto, no Math.random: son códigos de acceso.
    salida += ALFABETO[randomInt(ALFABETO.length)];
  }
  return salida;
}

export function generarCodigoEvento(): string {
  return generar(LARGO_INVITADO);
}

export function generarCodigoPantalla(): string {
  return generar(LARGO_PANTALLA);
}

/**
 * El código del invitado y el de la pantalla tienen que ser distintos siempre: quien
 * fotografía el QR proyectado no debe poder abrir la consola de control del evento.
 */
export function sonDistintos(codigoInvitado: string, codigoPantalla: string): boolean {
  return codigoInvitado !== codigoPantalla;
}
