/**
 * PURO. Seguimiento de las consultas de catálogo que no terminaron en compra: el cliente preguntó
 * un precio (copias, fotolibros, productos), el bot se lo pasó y el cliente no volvió a escribir.
 * Cerca del final de la ventana de 24 h (gratis, sin plantilla) el bot le escribe UNA vez para
 * retomarla. Lo corre el mismo cron que el recordatorio de pago, con el mismo horario.
 * Las cotizaciones de eventos tienen su propio seguimiento (`lib/presupuestos/seguimiento-whatsapp`).
 *
 * Sale SÓLO si (`decidirSeguimiento`):
 *   - el último mensaje del bot con un precio ofreció un producto o copias para armar un pedido (no
 *     foto carnet ni lo que se hace en el local: "sin turno", "venir");
 *   - el cliente no contestó después que ya fue o que ya lo resolvió;
 *   - ninguna persona del estudio escribió después (desde la Bandeja o el celular) y el chat no pasó
 *     a una persona;
 *   - es un horario razonable en Argentina (de 9 a 20 h; `horarioDeSeguimiento`).
 * Lo demás (una sola vez, sin pedidos ni cotizaciones recientes, el último mensaje es nuestro,
 * dentro de la ventana de 24 h) lo controla el servidor.
 */

/** Comienzo del mensaje SISTEMA que deja el seguimiento en el chat (sirve para no repetirlo). */
export const MARCA_SEGUIMIENTO_CONSULTA = "Seguimiento de consulta enviado";
/** No se vuelve a hacer seguimiento al mismo chat antes de estos días. */
export const DIAS_ENTRE_SEGUIMIENTOS = 7;
/** Horario de Argentina en que puede salir: desde las 9 y antes de las 20 h. */
export const HORA_DESDE = 9;
export const HORA_HASTA = 20;

/** ¿El mensaje (del bot) pasó un importe? */
export function pasoPrecio(texto: string | null | undefined): boolean {
  return Boolean(texto && /\$\s?\d/.test(texto));
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lo que se hace en el local o no se arma como pedido: foto carnet, "sin turno", "venir". */
const EN_EL_LOCAL = /foto\s?carnet|carnet|sin turno|\bven(ir|is|i|ite|irte|ga|gas)\b/;

/** De qué hablaron, del más específico al más general (el texto ya normalizado). */
const TEMAS: [RegExp, string][] = [
  [/fotolibro/, "el fotolibro"],
  [/portarretrato/, "el portarretratos"],
  [/cuadro|canvas/, "el cuadro"],
  [/diptico/, "el díptico"],
  [/fotoiman|iman/, "los fotoimanes"],
  [/polaroid/, "las Polaroid"],
  [/pendrive/, "el pendrive"],
  [/vhs|dvd|casete|digitaliz/, "la digitalización"],
  [/revelado|rollo/, "el revelado"],
  [/ampliacion/, "la ampliación"],
  [/llavero/, "los llaveros"],
  [/taza|vaso/, "las tazas"],
  [/copia|fotos?\b|\d{1,2}\s?x\s?\d{1,2}/, "las copias"],
];
/** Ofreció armar un pedido aunque no se sepa de qué. */
const OFRECIO_PEDIDO = /\bpedido\b|\barm(o|ar|amos|arte|arlo)\b|dejo armado/;

/** El cliente avisó que ya fue o que ya lo resolvió (el texto ya normalizado). */
const YA_RESUELTO = /\bya (fui|fuimos|pase|pasamos|lo (resolvi|resolvimos|hice|compre|retire|consegui)|las? (retire|hice|compre)|esta|no)\b|\bya lo tengo\b|\bno,? gracias\b/;

export type MensajeDelChat = { direccion: string; autor: string; texto: string | null; createdAt: Date };

export type DecisionSeguimiento = { desde: Date; tema: string | null } | null;

/**
 * Con los mensajes del chat de las últimas 24 h (en orden), ¿corresponde el seguimiento? Devuelve
 * cuándo fue el mensaje del bot con el precio y de qué hablaron (si se puede saber), o null.
 */
export function decidirSeguimiento(mensajes: readonly MensajeDelChat[]): DecisionSeguimiento {
  let i = -1;
  for (let k = mensajes.length - 1; k >= 0; k--) {
    const m = mensajes[k]!;
    if (m.direccion === "SALIENTE" && m.autor === "BOT" && pasoPrecio(m.texto)) {
      i = k;
      break;
    }
  }
  if (i < 0) return null;
  const oferta = normalizar(mensajes[i]!.texto ?? "");
  if (EN_EL_LOCAL.test(oferta)) return null;
  const tema = TEMAS.find(([re]) => re.test(oferta))?.[1] ?? null;
  if (!tema && !OFRECIO_PEDIDO.test(oferta)) return null;

  for (const m of mensajes.slice(i + 1)) {
    // Una persona del estudio ya lo atendió (desde la Bandeja o desde el celular).
    if (m.autor === "USUARIO" || m.autor === "CELULAR") return null;
    if (m.direccion === "SISTEMA" && /paso el chat a una persona|tomo el chat/.test(normalizar(m.texto ?? ""))) return null;
    if (m.direccion === "ENTRANTE" && YA_RESUELTO.test(normalizar(m.texto ?? ""))) return null;
  }
  return { desde: mensajes[i]!.createdAt, tema };
}

const HORA_AR = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" });

/** ¿Es un horario razonable para escribirle (de 9 a 20 h en Argentina)? Si no, el cron espera a la próxima vuelta. */
export function horarioDeSeguimiento(ahora: Date): boolean {
  const hora = Number(HORA_AR.format(ahora));
  return hora >= HORA_DESDE && hora < HORA_HASTA;
}

export function textoSeguimientoConsulta(nombre: string | null, tema: string | null = null): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  const hola = primero ? `¡Hola ${primero}!` : "¡Hola!";
  // "lo de el cuadro" se dice "lo del cuadro".
  if (tema) return `${hola} 😊 ¿Pudiste pensar lo ${tema.startsWith("el ") ? `del ${tema.slice(3)}` : `de ${tema}`}? Si querés, te lo dejo armado.`;
  return `${hola} 😊 ¿Pudiste ver lo que te pasé? Si querés, te lo dejo armado.`;
}
