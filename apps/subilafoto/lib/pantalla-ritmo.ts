/**
 * Qué le toca a la pantalla del salón en cada vuelta: una foto o el código QR.
 *
 * El QR no puede estar fijo en una esquina —en un televisor a tres metros, chico y
 * encima de una foto, no lo escanea nadie— ni aparecer una sola vez al principio, porque
 * la gente llega durante toda la noche. Entonces se intercala: la pantalla entera es el
 * código cada tantas fotos.
 *
 * **Cuántas, depende del momento de la fiesta.** Hasta el 2026-10-10 era siempre cada
 * diez, y eso le daba al QR el 15% de la pantalla tanto con una foto subida como con
 * trescientas. Con una sola foto el resultado era absurdo: la misma imagen diez veces
 * seguidas, setenta segundos, y recién ahí el código doce segundos.
 *
 * El QR tiene un solo trabajo: convertir a alguien que todavía no subió nada. Ese trabajo
 * vale muchísimo con el salón llegando y vale poco a las dos de la mañana, cuando el que
 * quería ya escaneó. Así que su tajada de pantalla **baja a medida que entran fotos**.
 */

/**
 * Cuánto silencio hace falta para volver al ritmo del arranque.
 *
 * La cantidad de fotos dice en qué momento empezó la fiesta; esto dice si el flujo se
 * cortó. Son cosas distintas: con ochenta fotos y nadie subiendo hace un rato largo, el
 * QR tiene que volver a pelear aunque el número sea alto. Pasa cuando se sientan a comer
 * o cuando entra una tanda de invitados nueva.
 */
export const SEQUIA_MS = 10 * 60_000;

/** Lo que dura una foto. El QR siempre dura más: hay que sacar el teléfono y apuntar. */
export const CADA_FOTO_MS = 7_000;

export type Ritmo = {
  /** Cada cuántas fotos se intercala el código. */
  cadaCuantasFotos: number;
  /** Cuánto se deja puesto. */
  msDelQr: number;
};

/*
  Los tres momentos. Los números salen de para qué sirve el QR en cada uno, no de una
  fórmula: al principio es el contenido principal, al final es un recordatorio.

  Veintidós segundos no es capricho: hay que notarlo, sacar el teléfono, desbloquearlo,
  abrir la cámara y apuntar. Doce no alcanzaban para eso ni estando atento.
*/
const ARRANQUE: Ritmo = { cadaCuantasFotos: 2, msDelQr: 22_000 };
const MEDIA: Ritmo = { cadaCuantasFotos: 5, msDelQr: 18_000 };
const FIESTA: Ritmo = { cadaCuantasFotos: 9, msDelQr: 15_000 };

export function ritmoDePantalla(entrada: {
  cantidadDeFotos: number;
  /** Desde que llegó la última. Al abrir la pantalla, desde la más nueva que haya. */
  msDesdeLaUltimaFoto: number;
}): Ritmo {
  // Pocas fotos es "recién empieza". Mucho silencio es "se cortó". Las dos piden lo mismo.
  if (entrada.cantidadDeFotos <= 5 || entrada.msDesdeLaUltimaFoto >= SEQUIA_MS) return ARRANQUE;
  if (entrada.cantidadDeFotos <= 20) return MEDIA;

  return FIESTA;
}

export type PasoDePantalla = { tipo: "FOTO"; indice: number } | { tipo: "QR" };

export function queMostrar({
  vuelta,
  cantidadDeFotos,
  cadaCuantasFotos,
}: {
  /** Cuenta hacia arriba sin tope; el resto sale con módulo. */
  vuelta: number;
  cantidadDeFotos: number;
  cadaCuantasFotos: number;
}): PasoDePantalla {
  /*
    Sin fotos, la pantalla es el QR. Es el momento más importante de la noche: el salón
    llegando y nadie subió nada. Si acá no se muestra el código, el evento no arranca.
  */
  if (cantidadDeFotos <= 0) return { tipo: "QR" };

  const cada = Math.max(1, Math.floor(cadaCuantasFotos));
  const largoDelCiclo = cada + 1;

  const posicionEnElCiclo = vuelta % largoDelCiclo;
  if (posicionEnElCiclo === cada) return { tipo: "QR" };

  /*
    Cuántas fotos se mostraron antes de ésta, salteando los turnos del QR. Se cuenta así
    y no con `vuelta % cantidadDeFotos` para que la rotación no se saltee fotos cada vez
    que pasa un QR: con cuatro fotos y módulo directo, la cuarta no se vería nunca.
  */
  const ciclosCompletos = Math.floor(vuelta / largoDelCiclo);
  const fotosMostradas = ciclosCompletos * cada + posicionEnElCiclo;

  return { tipo: "FOTO", indice: fotosMostradas % cantidadDeFotos };
}
