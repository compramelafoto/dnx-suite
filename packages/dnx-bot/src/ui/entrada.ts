// Lógica pura (sin React) de la animación de la mascota y de los «llamados» en reposo.
// Apta para el navegador: sólo importa de src/ui.
export type FaseMascota = "entrada" | "reposo" | "llamado";

/**
 * La animación de la mascota (la de Daniel: se agacha, levanta la cámara, saca la foto con flash y
 * vuelve a pararse) es una tira horizontal de cuadros (`mascota-foto.webp`). Cada cuadro mide lo mismo
 * que la imagen quieta (`mascota.webp`, que es el cuadro 0), así que la quieta y la animada coinciden.
 * Duración real de cada cuadro, en ms, tal como venía en el GIF original.
 */
export const DURACIONES_CUADROS_MS: readonly number[] = [650, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 280, 100, 70, 70, 70, 70, 70, 70, 70, 70, 70, 400];
export const CUADROS = DURACIONES_CUADROS_MS.length;
export const DURACION_FOTO_MS = DURACIONES_CUADROS_MS.reduce((a, b) => a + b, 0);
/** Ancho/alto de cada cuadro de la tira (291×400 px). */
export const PROPORCION_CUADRO = 291 / 400;

/** Crecer (o aparecer) hasta la pose grande y, después de la foto, achicarse a su tamaño (ms). */
export const CRECER_MS = 300;
export const ACHICAR_MS = 450;

/**
 * Cada vez que saca la foto lo hace en grande: en la entrada de cada página y en cada llamado.
 * Crece (300 ms), saca la foto (2830 ms) y se achica a su tamaño (450 ms). El globito aparece
 * recién cuando termina la entrada, y se oculta mientras dura un llamado.
 */
export const DURACION_ENTRADA_MS = CRECER_MS + DURACION_FOTO_MS + ACHICAR_MS;
export const DURACION_LLAMADO_MS = DURACION_ENTRADA_MS;
/** Primer llamado en reposo, cada cuánto se repite y cuántos como máximo por página. */
export const PRIMER_LLAMADO_MS = 20000;
export const CADA_LLAMADO_MS = 25000;
export const MAX_LLAMADOS = 3;
/** Si la tira no terminó de cargar en este tiempo, la mascota aparece quieta (sin animación). */
export const ESPERA_TIRA_MS = 4000;

/** Hay animación salvo con movimiento reducido o sin la tira de cuadros: entonces queda quieta. */
export function hayAnimacion(reducirMovimiento: boolean, tieneTira: boolean): boolean {
  return tieneTira && !reducirMovimiento;
}

function pct(n: number): string {
  return `${Number(n.toFixed(4))}%`;
}

/**
 * Keyframes de la tira: un tramo por cuadro, que empieza en su instante real y se queda fijo hasta el
 * siguiente (`steps(1, end)`, sin mezclar cuadros). La posición `i/(N-1)` con `background-size` de
 * N×100% muestra exactamente el cuadro i.
 */
export function keyframesFoto(): string {
  let t = 0;
  const filas = DURACIONES_CUADROS_MS.map((d, i) => {
    const fila = `  ${pct((t / DURACION_FOTO_MS) * 100)} { background-position: ${pct((i / (CUADROS - 1)) * 100)} 0; }`;
    t += d;
    return fila;
  });
  filas.push(`  100% { background-position: 100% 0; }`);
  return `@keyframes dnxbot-foto {\n${filas.join("\n")}\n}`;
}

const finCrecer = (CRECER_MS / DURACION_ENTRADA_MS) * 100;
const inicioAchicar = ((CRECER_MS + DURACION_FOTO_MS) / DURACION_ENTRADA_MS) * 100;

/**
 * Animaciones de la mascota, sólo CSS. La mascota va recortada, sin círculo, con una sombra ovalada
 * en el «piso». La única animación del robot es la tira de la foto; el botón sólo aparece y escala
 * (origen en su esquina de abajo a la derecha): la pose grande crece hacia arriba y a la izquierda,
 * lejos de los botones de pago que la burbuja tiene debajo, y nunca baja de su lugar.
 * Tamaños: en reposo 90 px de alto (76 en móvil); cada vez que saca la foto, 200 px (150 en móvil).
 */
export const CSS_MASCOTA = `
.dnxbot-raiz { --dnxbot-alto: 90px; --dnxbot-ancho: calc(var(--dnxbot-alto) * ${PROPORCION_CUADRO}); --dnxbot-pico: 2.22; }
.dnxbot-mascota {
  position: relative; display: block; margin-left: auto; padding: 0; border: 0; background: none; cursor: pointer;
  width: var(--dnxbot-ancho); height: calc(var(--dnxbot-alto) + 6px);
  transform-origin: 100% 100%; border-radius: 12px; -webkit-tap-highlight-color: transparent;
}
.dnxbot-mascota:focus-visible { outline: 2px solid #ff7a1a; outline-offset: 4px; }
.dnxbot-cuerpo { position: absolute; left: 0; top: 0; width: 100%; height: var(--dnxbot-alto); z-index: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)); }
.dnxbot-cuerpo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.dnxbot-tira { display: none; position: absolute; inset: 0; background-repeat: no-repeat; background-size: ${CUADROS * 100}% 100%; background-position: 0 0; }
.dnxbot-sombra {
  position: absolute; left: 6%; right: 6%; bottom: 0; height: 12px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.32) 0%, rgba(0,0,0,.12) 55%, rgba(0,0,0,0) 72%);
}
.dnxbot-globito-pos { right: calc(var(--dnxbot-ancho) + 14px); bottom: calc(var(--dnxbot-alto) * .35); }
@media (max-width: 767px) {
  .dnxbot-raiz { --dnxbot-alto: 76px; --dnxbot-pico: 1.97; }
}
${keyframesFoto()}
@keyframes dnxbot-entrada {
  0% { opacity: 0; transform: scale(calc(var(--dnxbot-pico) * .8)); }
  ${pct(finCrecer)} { opacity: 1; transform: scale(var(--dnxbot-pico)); }
  ${pct(inicioAchicar)} { opacity: 1; transform: scale(var(--dnxbot-pico)); animation-timing-function: ease-in-out; }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes dnxbot-llamado {
  0% { transform: scale(1); animation-timing-function: ease-out; }
  ${pct(finCrecer)} { transform: scale(var(--dnxbot-pico)); }
  ${pct(inicioAchicar)} { transform: scale(var(--dnxbot-pico)); animation-timing-function: ease-in-out; }
  100% { transform: scale(1); }
}
@keyframes dnxbot-globito {
  0% { opacity: 0; transform: translateX(8px) scale(.85); }
  100% { opacity: 1; transform: none; }
}
.dnxbot-mascota[data-fase="entrada"] { animation: dnxbot-entrada ${DURACION_ENTRADA_MS}ms ease-out both; }
.dnxbot-mascota[data-fase="llamado"] { animation: dnxbot-llamado ${DURACION_LLAMADO_MS}ms both; }
.dnxbot-mascota[data-fase="entrada"] .dnxbot-tira,
.dnxbot-mascota[data-fase="llamado"] .dnxbot-tira { display: block; animation: dnxbot-foto ${DURACION_FOTO_MS}ms ${CRECER_MS}ms steps(1, end) both; }
.dnxbot-mascota[data-fase="entrada"] img,
.dnxbot-mascota[data-fase="llamado"] img { visibility: hidden; }
.dnxbot-globito { transform-origin: 100% 100%; animation: dnxbot-globito 280ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .dnxbot-mascota, .dnxbot-mascota *, .dnxbot-globito { animation: none !important; }
  .dnxbot-mascota .dnxbot-tira { display: none !important; }
  .dnxbot-mascota img { visibility: visible !important; }
}
`;
