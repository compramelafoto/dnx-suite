/**
 * Digitalización desde el trabajo y el pedido: qué trabajo es de digitalización, en qué estado está
 * cada grabación y qué se dice de la entrega. Módulo PURO (sin base ni entorno, con el reloj
 * inyectado): lo usan la ficha del trabajo, la del pedido, el Cobrador y la lista de Digitalización.
 */
import { descargasRestantes, fechaArgentina, fechaHoraArgentina, pesos, type EstadoVisibleEntrega } from "./entrega";
import { estadoVisible } from "./validar";

// --- ¿Es un trabajo de digitalización? --------------------------------------------------------

/** Formatos de video que no se confunden con otra cosa: alcanzan solos ("Pasar VHS a pendrive"). */
const FORMATO_DE_VIDEO = /\b(vhs|vhs ?c|hi ?8|mini ?dv|betamax|video ?8|8 ?mm|super ?8)\b/;
/** Palabras de video que solas pueden ser otra cosa (un DVD virgen): piden además "digitalizar". */
const VIDEO_SUELTO = /\b(dvd|video|videos|cassette|cassettes|casete|casetes|filmacion|filmaciones)\b/;
const DIGITALIZAR = /\b(digitaliz\w*|pasaje|pasar|a digital)\b/;
/** El grabador no hace audio: un casete de audio o un CD no son de acá. */
const SOLO_AUDIO = /\b(audio|cd|cds|vinilo|vinilos|disco|discos)\b/;

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Si un nombre (del trabajo, del producto o de su categoría) habla de digitalizar video. Es el
 * criterio cuando el trabajo todavía no tiene grabaciones: en el catálogo no hay una marca propia de
 * digitalización (los productos de DNX se llaman «Digitalización de VHS», «Digitalización de DVD»,
 * …, y también hay de CD y de casete de audio, que el grabador no hace).
 */
export function esNombreDeDigitalizacion(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  if (FORMATO_DE_VIDEO.test(t)) return true;
  return DIGITALIZAR.test(t) && VIDEO_SUELTO.test(t) && !SOLO_AUDIO.test(t);
}

/**
 * Un trabajo es de digitalización si ya tiene grabaciones (lo único seguro) o si su nombre, el de
 * su producto o el de la categoría del producto hablan de digitalizar video.
 */
export function esTrabajoDeDigitalizacion(t: { grabaciones: number; textos: readonly (string | null | undefined)[] }): boolean {
  return t.grabaciones > 0 || t.textos.some(esNombreDeDigitalizacion);
}

// --- Estado de una grabación ------------------------------------------------------------------

export type EstadoDeGrabacion = "GRABANDO" | "INTERRUMPIDA" | "EN_COLA" | "CONVIRTIENDO" | "LISTA" | "SIN_IMAGEN" | "ERROR" | "DESCARTADA";

export const ETIQUETA_ESTADO_GRABACION: Record<EstadoDeGrabacion, string> = {
  GRABANDO: "Grabando",
  INTERRUMPIDA: "Quedó a medias",
  EN_COLA: "En cola",
  CONVIRTIENDO: "Convirtiendo…",
  LISTA: "Listo",
  SIN_IMAGEN: "Sin imagen",
  ERROR: "Error",
  DESCARTADA: "Descartada",
};

/**
 * La grabación y su conversión en un solo estado. Una grabación abierta sin latido hace rato quedó a
 * medias (se puede «Continuar»). Una completa sin conversión es de antes de la conversión: sin
 * imagen, no se convierte; con imagen, espera en la cola.
 */
export function estadoDeGrabacion(
  g: { estado: string; conversionEstado: string | null; sinImagen: boolean; ultimoLatidoAt: Date | null; iniciadaAt: Date },
  ahora: Date,
): EstadoDeGrabacion {
  if (g.estado === "DESCARTADA") return "DESCARTADA";
  if (g.estado !== "COMPLETA") return estadoVisible(g, ahora) === "INTERRUMPIDA" ? "INTERRUMPIDA" : "GRABANDO";
  switch (g.conversionEstado) {
    case null: return g.sinImagen ? "SIN_IMAGEN" : "EN_COLA";
    case "PROCESANDO": return "CONVIRTIENDO";
    case "LISTA": return "LISTA";
    case "SIN_IMAGEN": return "SIN_IMAGEN";
    case "ERROR": return "ERROR";
    default: return "EN_COLA";
  }
}

// --- ¿Salió el correo? ------------------------------------------------------------------------

/**
 * Lo que quedó anotado del envío. `sendTransactionalEmail` no deja registro propio y el webhook de
 * Resend sólo sigue los correos masivos: lo consultable son las notas que `enviarEntrega` deja en
 * cada trabajo del pedido cuando el correo SALE (con la dirección a la que salió) o cuando se copia
 * el enlace por primera vez. Un correo que falla no deja nota (la entrega vuelve a «Listo para
 * enviar»), y «Copiar enlace» sobre una entrega ya enviada tampoco.
 */
export type EnvioRegistrado = {
  primero: { modo: "CORREO"; email: string; at: Date } | { modo: "ENLACE"; email: null; at: Date } | null;
  ultimoReenvio: { email: string; at: Date } | null;
};

const NOTA_CORREO = /^Correo «Tus videos están listos» (enviado|reenviado) a (.+)\.$/;
const NOTA_ENLACE = /^Videos digitalizados: se copió el enlace/;

/** El primer envío y el último reenvío, de las notas de los trabajos del pedido (en cualquier orden). */
export function registroDeEnvio(notas: readonly { body: string; createdAt: Date }[]): EnvioRegistrado {
  const r: EnvioRegistrado = { primero: null, ultimoReenvio: null };
  const ordenadas = [...notas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const n of ordenadas) {
    const body = n.body.trim();
    const correo = NOTA_CORREO.exec(body);
    if (correo) {
      if (correo[1] === "enviado") {
        if (!r.primero) r.primero = { modo: "CORREO", email: correo[2]!, at: n.createdAt };
      } else {
        r.ultimoReenvio = { email: correo[2]!, at: n.createdAt };
      }
    } else if (NOTA_ENLACE.test(body) && !r.primero) {
      r.primero = { modo: "ENLACE", email: null, at: n.createdAt };
    }
  }
  return r;
}

// --- Textos de la entrega ---------------------------------------------------------------------

export type DatosTextoEntrega = {
  cancelado: boolean;
  tieneEmail: boolean;
  /** El correo que tiene HOY el cliente (para cuando no quedó registro del envío). */
  email: string | null;
  enviaSoloDesde: Date | null;
  automatico: boolean;
  enviadoAt: Date | null;
  videosVencenAt: Date | null;
  videosBorradosAt: Date | null;
  registro: EnvioRegistrado;
};

/** Arma los datos del texto a partir del resumen de la entrega (`resumenDeEntregas`). */
export function datosTextoEntrega(
  r: {
    cancelado: boolean;
    tieneEmail: boolean;
    email: string | null;
    enviaSoloDesde: Date | null;
    entrega: { envioAutomatico: boolean; enviadoAt: Date | null; videosVencenAt: Date | null; videosBorradosAt: Date | null } | null;
    envioRegistrado: EnvioRegistrado;
  },
  envioAutomaticoPorDefecto: boolean,
): DatosTextoEntrega {
  return {
    cancelado: r.cancelado,
    tieneEmail: r.tieneEmail,
    email: r.email,
    enviaSoloDesde: r.enviaSoloDesde,
    automatico: r.entrega?.envioAutomatico ?? envioAutomaticoPorDefecto,
    enviadoAt: r.entrega?.enviadoAt ?? null,
    videosVencenAt: r.entrega?.videosVencenAt ?? null,
    videosBorradosAt: r.entrega?.videosBorradosAt ?? null,
    registro: r.envioRegistrado,
  };
}

/** Cómo se mandó: por correo y a quién, por enlace, o "no quedó registro". */
function comoSeEnvio(d: DatosTextoEntrega): string {
  const p = d.registro.primero;
  const reenvio = d.registro.ultimoReenvio ? ` · reenviado el ${fechaArgentina(d.registro.ultimoReenvio.at, "corta")} a ${d.registro.ultimoReenvio.email}` : "";
  if (p?.modo === "CORREO") return ` por correo a ${p.email}${reenvio}`;
  if (p?.modo === "ENLACE") return ` por enlace (sin correo)${reenvio}`;
  if (reenvio) return reenvio;
  return d.tieneEmail ? "" : " por enlace (sin correo)";
}

/** Lo que se dice de la entrega de un pedido (la lista de Digitalización, el trabajo y el pedido). */
export function textoDeEntrega(estado: EstadoVisibleEntrega, d: DatosTextoEntrega, ahora: Date): string {
  if (d.cancelado && estado !== "ENVIADA" && estado !== "BORRADA") return "Pedido cancelado: no se envían los videos.";
  if (estado === "LISTA_PARA_ENVIAR" && d.automatico && d.tieneEmail && d.enviaSoloDesde && d.enviaSoloDesde.getTime() > ahora.getTime()) {
    return `Listo · se envía solo el ${fechaHoraArgentina(d.enviaSoloDesde)} si no grabás otro cassette`;
  }
  switch (estado) {
    case "CONVIRTIENDO": return "Convirtiendo…";
    case "CON_ERROR": return "Hay un video con error: reintentá la conversión o descartalo para poder enviar.";
    case "SIN_VIDEOS": return "Sin videos para entregar.";
    case "LISTA_PARA_ENVIAR": return d.tieneEmail ? "Listo para enviar" : "Listo para enviar · el cliente no tiene correo: copiá el enlace y mandáselo por WhatsApp";
    case "ENVIADA": {
      const base = `Enviado el ${fechaArgentina(d.enviadoAt!, "corta")}${comoSeEnvio(d)} · vence ${fechaArgentina(d.videosVencenAt!, "corta")}`;
      const sinRegistro = !d.registro.primero && !d.registro.ultimoReenvio && d.tieneEmail && d.email;
      return sinRegistro ? `${base} · no quedó registro de cómo; el correo del cliente es ${d.email}` : base;
    }
    case "BORRADA": return `Videos borrados el ${fechaArgentina(d.videosBorradosAt ?? d.videosVencenAt!, "corta")}`;
    default: return "";
  }
}

/** El saldo que traba los videos (sin los extras opcionales); null si está pagado. */
export function textoDeSaldo(saldoMinor: number): string | null {
  return saldoMinor > 0 ? `Le falta pagar ${pesos(saldoMinor)}: los videos están bloqueados hasta que pague.` : null;
}

/** Las descargas contadas de un video, sobre las incluidas más las extra pagadas. */
export function textoDeDescargas(d: { usadas: number; descargasExtra: number }): string {
  const { total } = descargasRestantes(d);
  if (d.usadas <= 0) return `Sin descargas todavía (tiene ${total})`;
  return `${d.usadas} ${d.usadas === 1 ? "descarga" : "descargas"} de ${total}`;
}
