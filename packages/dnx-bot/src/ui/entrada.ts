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
 * Animaciones de la mascota, sólo CSS. La mascota va recortada, sin círculo, con una sombra ovalada
 * en el «piso». El botón sólo escala (origen en su esquina de abajo a la derecha) y entra desde la
 * derecha; el cuerpo salta hacia arriba y se inclina sobre los pies. Nada baja de su lugar: la pose
 * grande crece hacia arriba y a la izquierda, lejos de los botones de pago que la burbuja tiene debajo.
 * Tamaños: en reposo 90 px de alto (76 en móvil); en la pose grande, 200 px (150 en móvil).
 */
export const CSS_MASCOTA = `
.dnxbot-raiz { --dnxbot-ancho: 57px; --dnxbot-alto: 90px; --dnxbot-pico: 2.22; }
.dnxbot-mascota {
  position: relative; display: block; margin-left: auto; padding: 0; border: 0; background: none; cursor: pointer;
  width: var(--dnxbot-ancho); height: calc(var(--dnxbot-alto) + 6px);
  transform-origin: 100% 100%; border-radius: 12px; -webkit-tap-highlight-color: transparent;
}
.dnxbot-mascota:focus-visible { outline: 2px solid #ff7a1a; outline-offset: 4px; }
.dnxbot-cuerpo { position: absolute; left: 0; top: 0; width: 100%; height: var(--dnxbot-alto); transform-origin: 50% 100%; z-index: 1; }
.dnxbot-cuerpo img { display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)); }
.dnxbot-sombra {
  position: absolute; left: 6%; right: 6%; bottom: 0; height: 12px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.32) 0%, rgba(0,0,0,.12) 55%, rgba(0,0,0,0) 72%);
}
.dnxbot-globito-pos { right: calc(var(--dnxbot-ancho) + 14px); bottom: calc(var(--dnxbot-alto) * .35); }
@media (max-width: 767px) {
  .dnxbot-raiz { --dnxbot-ancho: 48px; --dnxbot-alto: 76px; --dnxbot-pico: 1.97; }
}
@keyframes dnxbot-entrada-grande {
  0% { opacity: 0; transform: translate(110px, 0) scale(.6); }
  14% { opacity: 1; transform: translate(-16px, 0) scale(var(--dnxbot-pico)); }
  20% { transform: translate(-16px, 0) scale(calc(var(--dnxbot-pico) * .86)); }
  26% { transform: translate(-16px, 0) scale(calc(var(--dnxbot-pico) * .97)); }
  31% { transform: translate(-16px, 0) scale(calc(var(--dnxbot-pico) * .93)); }
  72% { transform: translate(-16px, 0) scale(calc(var(--dnxbot-pico) * .93)); animation-timing-function: cubic-bezier(.5,0,.75,0); }
  84% { transform: translate(0, 0) scale(.88); animation-timing-function: ease-out; }
  92% { transform: translate(0, 0) scale(1.06); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes dnxbot-cuerpo-entrada {
  0%, 30% { transform: translate(0, 0) rotate(0deg); }
  36% { transform: translate(0, -8px) rotate(-8deg); }
  40% { transform: translate(0, -14px) rotate(3deg); }
  47% { transform: translate(0, 0) rotate(7deg); }
  54% { transform: translate(0, -7px) rotate(-6deg); }
  60% { transform: translate(0, 0) rotate(4deg); }
  66%, 100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes dnxbot-sombra-entrada {
  0%, 30%, 47%, 60%, 100% { transform: scaleX(1); opacity: 1; }
  40% { transform: scaleX(.6); opacity: .45; }
  54% { transform: scaleX(.8); opacity: .7; }
}
@keyframes dnxbot-brillo {
  0%, 100% { filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)); }
  50% { filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)) drop-shadow(0 0 8px rgba(255,122,26,.85)); }
}
@keyframes dnxbot-entrada-corta {
  0% { opacity: 0; transform: translate(40px, 0) scale(.5); }
  60% { opacity: 1; transform: translate(0, 0) scale(1.12); }
  80% { transform: translate(0, 0) scale(.96); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes dnxbot-flotar {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(0, -4px); }
}
@keyframes dnxbot-sombra-flotar {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  50% { transform: scaleX(.85); opacity: .7; }
}
@keyframes dnxbot-llamado {
  0%, 40%, 70%, 100% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(0, -6px) rotate(-10deg); }
  20% { transform: translate(0, -12px) rotate(8deg); }
  55% { transform: translate(0, -6px) rotate(-5deg); }
}
@keyframes dnxbot-sombra-llamado {
  0%, 40%, 70%, 100% { transform: scaleX(1); opacity: 1; }
  20% { transform: scaleX(.65); opacity: .5; }
  55% { transform: scaleX(.85); opacity: .75; }
}
@keyframes dnxbot-globito {
  0% { opacity: 0; transform: translateX(8px) scale(.85); }
  100% { opacity: 1; transform: none; }
}
.dnxbot-mascota[data-fase="entrada-grande"] { animation: dnxbot-entrada-grande 2400ms both; }
.dnxbot-mascota[data-fase="entrada-grande"] .dnxbot-cuerpo { animation: dnxbot-cuerpo-entrada 2400ms both; }
.dnxbot-mascota[data-fase="entrada-grande"] .dnxbot-sombra { animation: dnxbot-sombra-entrada 2400ms both; }
.dnxbot-mascota[data-fase="entrada-grande"] img { animation: dnxbot-brillo 900ms 300ms ease-in-out 2; }
.dnxbot-mascota[data-fase="entrada-corta"] { animation: dnxbot-entrada-corta 650ms ease-out both; }
.dnxbot-mascota[data-fase="reposo"] .dnxbot-cuerpo { animation: dnxbot-flotar 3600ms ease-in-out infinite; }
.dnxbot-mascota[data-fase="reposo"] .dnxbot-sombra { animation: dnxbot-sombra-flotar 3600ms ease-in-out infinite; }
.dnxbot-mascota[data-fase="llamado"] .dnxbot-cuerpo { animation: dnxbot-llamado 1100ms ease-out; }
.dnxbot-mascota[data-fase="llamado"] .dnxbot-sombra { animation: dnxbot-sombra-llamado 1100ms ease-out; }
.dnxbot-mascota[data-fase="llamado"] img { animation: dnxbot-brillo 1100ms ease-in-out; }
.dnxbot-globito { transform-origin: 100% 100%; animation: dnxbot-globito 280ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .dnxbot-mascota, .dnxbot-mascota *, .dnxbot-globito { animation: none !important; }
}
`;
