// Lógica pura (sin React) de la entrada animada de la mascota y de los «llamados» en reposo.
// Apta para el navegador: sólo importa de src/ui.
import type { AlmacenSimple } from "./globito";

export type TipoEntrada = "grande" | "corta" | "ninguna";
export type FaseMascota = "entrada-grande" | "entrada-corta" | "reposo" | "llamado";

/** Marca en sessionStorage: la entrada grande se ve una sola vez por visita. */
export const ENTRADA_VISTA_KEY = "dnxbot:entrada-vista";

/** Duraciones (ms). El globito aparece recién cuando termina la entrada. */
export const DURACION_ENTRADA: Record<TipoEntrada, number> = { grande: 2400, corta: 650, ninguna: 0 };
export const DURACION_LLAMADO_MS = 1100;
/** Primer llamado en reposo, cada cuánto se repite y cuántos como máximo por página. */
export const PRIMER_LLAMADO_MS = 20000;
export const CADA_LLAMADO_MS = 25000;
export const MAX_LLAMADOS = 3;

/**
 * Qué entrada hace la mascota. Con movimiento reducido: ninguna (aparece y listo). La primera vez de
 * la visita: la grande, y queda marcada. Después: la corta. Si el almacenamiento falla, la corta
 * (mejor no repetir la grande en cada página que repetirla sin control).
 */
export function tipoEntrada(almacen: AlmacenSimple | null, reducirMovimiento: boolean): TipoEntrada {
  if (reducirMovimiento) return "ninguna";
  try {
    if (!almacen || almacen.getItem(ENTRADA_VISTA_KEY)) return "corta";
    almacen.setItem(ENTRADA_VISTA_KEY, "1");
    return "grande";
  } catch {
    return "corta";
  }
}

/**
 * Animaciones de la mascota, sólo CSS. El botón escala con origen en su esquina de abajo a la derecha
 * y nunca baja de su lugar (sólo traslada hacia arriba o desde la derecha): la pose grande crece hacia
 * arriba y a la izquierda, lejos de los botones de pago que la burbuja tiene debajo.
 */
export const CSS_MASCOTA = `
@keyframes dnxbot-entrada-grande {
  0% { opacity: 0; transform: translate(110px, 0) scale(.6); }
  14% { opacity: 1; transform: translate(0, 0) scale(2.15); }
  20% { transform: translate(0, 0) scale(1.85); }
  26% { transform: translate(0, 0) scale(2.05); }
  31% { transform: translate(0, 0) scale(1.95); }
  40% { transform: translate(0, -16px) scale(2); }
  47% { transform: translate(0, 0) scale(1.95); }
  54% { transform: translate(0, -8px) scale(1.97); }
  60% { transform: translate(0, 0) scale(1.95); }
  72% { transform: translate(0, 0) scale(1.95); animation-timing-function: cubic-bezier(.5,0,.75,0); }
  84% { transform: translate(0, 0) scale(.88); animation-timing-function: ease-out; }
  92% { transform: translate(0, 0) scale(1.06); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes dnxbot-saludo {
  0%, 30% { transform: rotate(0); }
  36% { transform: rotate(-14deg); }
  42% { transform: rotate(12deg); }
  48% { transform: rotate(-10deg); }
  54% { transform: rotate(8deg); }
  60% { transform: rotate(-4deg); }
  66%, 100% { transform: rotate(0); }
}
@keyframes dnxbot-entrada-corta {
  0% { opacity: 0; transform: translate(40px, 0) scale(.5); }
  60% { opacity: 1; transform: translate(0, 0) scale(1.12); }
  80% { transform: translate(0, 0) scale(.96); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes dnxbot-flotar {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes dnxbot-llamado {
  0%, 40%, 70%, 100% { transform: translate(0, 0) scale(1); }
  20% { transform: translate(0, -12px) scale(1.08); }
  55% { transform: translate(0, -6px) scale(1.04); }
}
@keyframes dnxbot-meneo {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(10deg); }
  60% { transform: rotate(-6deg); }
  80% { transform: rotate(3deg); }
}
@keyframes dnxbot-onda {
  0% { box-shadow: 0 0 0 0 rgba(255,122,26,.55); }
  100% { box-shadow: 0 0 0 16px rgba(255,122,26,0); }
}
@keyframes dnxbot-globito {
  0% { opacity: 0; transform: translateX(8px) scale(.85); }
  100% { opacity: 1; transform: none; }
}
.dnxbot-mascota { transform-origin: 100% 100%; }
.dnxbot-mascota img { transform-origin: 50% 90%; }
.dnxbot-mascota .dnxbot-onda { position: absolute; inset: 0; border-radius: 999px; pointer-events: none; }
.dnxbot-mascota[data-fase="entrada-grande"] { animation: dnxbot-entrada-grande 2400ms both; }
.dnxbot-mascota[data-fase="entrada-grande"] img { animation: dnxbot-saludo 2400ms both; }
.dnxbot-mascota[data-fase="entrada-grande"] .dnxbot-onda { animation: dnxbot-onda 1000ms 300ms ease-out 2; }
.dnxbot-mascota[data-fase="entrada-corta"] { animation: dnxbot-entrada-corta 650ms ease-out both; }
.dnxbot-mascota[data-fase="reposo"] { animation: dnxbot-flotar 3600ms ease-in-out infinite; }
.dnxbot-mascota[data-fase="llamado"] { animation: dnxbot-llamado 1100ms ease-out; }
.dnxbot-mascota[data-fase="llamado"] img { animation: dnxbot-meneo 1100ms ease-in-out; }
.dnxbot-mascota[data-fase="llamado"] .dnxbot-onda { animation: dnxbot-onda 1000ms ease-out; }
.dnxbot-globito { transform-origin: 100% 100%; animation: dnxbot-globito 280ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .dnxbot-mascota, .dnxbot-mascota *, .dnxbot-globito { animation: none !important; }
}
`;
