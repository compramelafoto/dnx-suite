/**
 * Qué tan completa está la ficha de un jurado.
 *
 * Sirve para ordenar el directorio. **No es un ranking de calidad** —eso
 * exigiría reseñas, y una sola reseña mala hunde a una persona sin apelación—
 * sino de utilidad para quien busca: una ficha vacía no ayuda a nadie y no
 * merece el primer lugar. De paso, le da al jurado un motivo concreto para
 * completarla.
 *
 * Se calcula en el momento y no se guarda: un número guardado y uno calculado
 * que algún día no coinciden es exactamente el problema de las cuatro
 * estadísticas muertas que se sacaron el 20/9.
 */
import { BIO_MINIMA } from "./publicSignupForm";

/** Con menos de tres, la tira del directorio queda incompleta. */
export const PORTFOLIO_MINIMO_PARA_SUMAR = 3;

export const PUNTAJE_MAXIMO = 6;

export type FichaParaPuntuar = {
  tieneFoto: boolean;
  cantidadDePortfolio: number;
  titular: string | null;
  bio: string | null;
  aniosDeExperiencia: number | null;
  especialidades: string[];
};

export function puntajeDeFicha(f: FichaParaPuntuar): number {
  let puntos = 0;

  if (f.tieneFoto) puntos++;
  if (f.cantidadDePortfolio >= PORTFOLIO_MINIMO_PARA_SUMAR) puntos++;
  if (f.titular?.trim()) puntos++;
  if ((f.bio?.trim().length ?? 0) >= BIO_MINIMA) puntos++;
  // Cero años es un dato declarado y vale; null es "no lo dijo".
  if (f.aniosDeExperiencia !== null && Number.isFinite(f.aniosDeExperiencia)) puntos++;
  if (f.especialidades.length > 0) puntos++;

  return puntos;
}
