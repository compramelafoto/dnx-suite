/**
 * Reglas PURAS de la prueba de álbum del cliente (etapa 7, Entrega C): validar un pin, calcular dónde cae un
 * toque sobre la lámina (descontando las bandas vacías del `object-fit: contain`), y qué hace falta para decidir.
 * Sin base, sin red, sin `server-only`: las usan el servidor y el navegador.
 */
import { DECISIONES_ALBUM, MAX_NOTA_RONDA, type DecisionAlbum } from "./constantes";

export const MENSAJES_ALBUM = {
  noEsAlbum: "Esta galería no es una prueba de álbum.",
  sinRonda: "El estudio todavía no abrió una ronda para revisar.",
  rondaCerrada: "Esta ronda ya se cerró: la podés mirar, pero no se puede comentar.",
  yaDecidiste: "Ya enviaste tu decisión sobre esta ronda. Si necesitás cambiar algo, escribile al estudio.",
  laminaInvalida: "No encontramos esa lámina en la ronda actual.",
  pinInvalido: "No pudimos ubicar ese punto en la lámina. Tocá de nuevo sobre la imagen.",
  topeComentarios: "Llegaste al máximo de comentarios que se pueden dejar en esta ronda.",
  decisionInvalida: "Elegí si aprobás el álbum o pedís cambios.",
  cambiosSinNada: "Para pedir cambios, dejá al menos un comentario en alguna lámina o escribí un mensaje contándole al estudio qué cambiar.",
  mensajeLargo: `El mensaje puede tener hasta ${MAX_NOTA_RONDA.toLocaleString("es-AR")} caracteres.`,
  rondaCambio: "El estudio acaba de actualizar el álbum. Recargá la página para ver la ronda nueva.",
} as const;

export type Pin = { x: number; y: number };

/**
 * Un pin válido son DOS números finitos entre 0 y 1 (relativos a la imagen mostrada). `undefined`/`null` = sin pin
 * (comentario general). Cualquier otra forma, o un solo número, o fuera de rango, se rechaza.
 */
export function validarPin(raw: unknown): { ok: true; pin: Pin | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, pin: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: MENSAJES_ALBUM.pinInvalido };
  const { x, y } = raw as { x?: unknown; y?: unknown };
  const bien = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!bien(x) || !bien(y)) return { ok: false, error: MENSAJES_ALBUM.pinInvalido };
  return { ok: true, pin: { x, y } };
}

export type Rect = { left: number; top: number; width: number; height: number };

/**
 * Dónde queda dibujada la imagen dentro de su caja cuando se muestra con `object-fit: contain`: se escala sin
 * deformar y se centra, así que sobran bandas arriba/abajo o a los costados. Medidas en píxeles de la caja.
 */
export function rectDeImagenContenida(cajaAncho: number, cajaAlto: number, imgAncho: number, imgAlto: number): Rect | null {
  if (![cajaAncho, cajaAlto, imgAncho, imgAlto].every((n) => Number.isFinite(n) && n > 0)) return null;
  const escala = Math.min(cajaAncho / imgAncho, cajaAlto / imgAlto);
  const width = imgAncho * escala;
  const height = imgAlto * escala;
  return { left: (cajaAncho - width) / 2, top: (cajaAlto - height) / 2, width, height };
}

/**
 * Posición relativa (0 a 1) de un toque en `(px, py)` (relativo a la caja) respecto de la imagen dibujada en `rect`.
 * Null si el toque cayó en las bandas vacías, fuera de la imagen.
 */
export function puntoRelativo(px: number, py: number, rect: Rect): Pin | null {
  if (!Number.isFinite(px) || !Number.isFinite(py) || rect.width <= 0 || rect.height <= 0) return null;
  const x = (px - rect.left) / rect.width;
  const y = (py - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

export type ResultadoDecision = { ok: true; decision: DecisionAlbum; mensaje: string | null } | { ok: false; error: string };

/**
 * Qué hace falta para decidir: la decisión tiene que ser APROBADO o CAMBIOS; el mensaje es opcional (hasta 2000
 * caracteres) y, para pedir CAMBIOS, hace falta el mensaje o al menos un comentario del cliente en la ronda.
 */
export function validarDecision(decision: unknown, mensaje: unknown, comentariosPropios: number): ResultadoDecision {
  if (typeof decision !== "string" || !(DECISIONES_ALBUM as readonly string[]).includes(decision)) return { ok: false, error: MENSAJES_ALBUM.decisionInvalida };
  let texto: string | null = null;
  if (mensaje !== undefined && mensaje !== null) {
    if (typeof mensaje !== "string") return { ok: false, error: MENSAJES_ALBUM.decisionInvalida };
    const t = mensaje.replace(/\r\n?/g, "\n").trim();
    if (t.length > MAX_NOTA_RONDA) return { ok: false, error: MENSAJES_ALBUM.mensajeLargo };
    texto = t === "" ? null : t;
  }
  if (decision === "CAMBIOS" && texto === null && comentariosPropios < 1) return { ok: false, error: MENSAJES_ALBUM.cambiosSinNada };
  return { ok: true, decision: decision as DecisionAlbum, mensaje: texto };
}
