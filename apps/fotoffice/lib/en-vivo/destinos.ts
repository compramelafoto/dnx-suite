/**
 * Los destinos de retransmisión: YouTube, Instagram y TikTok, todos por clave RTMP.
 *
 * Cada destino es un "output" del live input de Cloudflare: se crea al empezar el vivo y se
 * borra al terminarlo. Cloudflare es quien manda el video a cada red; nosotros sólo le pasamos
 * servidor y clave en el momento de crear el output.
 *
 * Regla de oro de este archivo: **una clave completa nunca sale de acá hacia la base ni hacia
 * el navegador**. Lo que se guarda del vivo y lo que se muestra es la terminación.
 *
 * Módulo PURO: sin base y sin red.
 */

export type Destino = "YOUTUBE" | "INSTAGRAM" | "TIKTOK";

export const DESTINOS: readonly Destino[] = ["YOUTUBE", "INSTAGRAM", "TIKTOK"];

export const NOMBRE_DESTINO: Record<Destino, string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

/** El servidor de YouTube Live para codificadores. La clave persistente sale de YouTube Studio. */
export const YOUTUBE_RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";

const LARGO_MAXIMO = 500;

/** Los últimos cuatro caracteres, para reconocer una clave sin verla. */
export function terminacion(clave: string): string {
  const limpia = clave.trim();
  return limpia.length > 8 ? limpia.slice(-4) : "";
}

/** «••••1234». Una clave corta no muestra nada: cuatro caracteres serían media clave. */
export function enmascararClave(clave: string | null | undefined): string {
  if (!clave) return "";
  const fin = terminacion(clave);
  return fin ? `••••••••${fin}` : "••••••••";
}

/** Igual que `enmascararClave`, para cuando sólo se tiene la terminación guardada. */
export function mascaraDeTerminacion(last4: string | null | undefined): string {
  return last4 ? `••••••••${last4}` : "";
}

export function validarServidor(url: string): string | null {
  const limpia = url.trim();
  if (!limpia) return "Falta el servidor (la dirección que empieza con rtmp:// o rtmps://).";
  if (limpia.length > LARGO_MAXIMO) return "La dirección del servidor es demasiado larga.";
  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    return "La dirección del servidor no es válida.";
  }
  if (parsed.protocol !== "rtmp:" && parsed.protocol !== "rtmps:") {
    return "El servidor tiene que empezar con rtmp:// o rtmps://.";
  }
  return null;
}

export function validarClave(clave: string): string | null {
  const limpia = clave.trim();
  if (!limpia) return "Falta la clave de transmisión.";
  if (limpia.length < 8) return "La clave de transmisión es demasiado corta: copiala completa.";
  if (limpia.length > LARGO_MAXIMO) return "La clave de transmisión es demasiado larga.";
  if (/\s/.test(limpia)) return "La clave de transmisión no lleva espacios: copiala de nuevo.";
  return null;
}

/** Lo que llega del formulario «Nuevo vivo» más lo que hay guardado en el canal. */
export type PedidoDestinos = {
  youtube: { elegido: boolean; claveGuardada: string | null };
  instagram: { elegido: boolean; servidor: string; clave: string };
  tiktok: {
    elegido: boolean;
    servidor: string;
    /** Vacía = usar la recordada. */
    clave: string;
    claveGuardada: string | null;
    servidorGuardado: string | null;
  };
};

/** Lo que se le manda a Cloudflare para crear cada output. Vive sólo en memoria. */
export type OutputAPedir = { destino: Destino; url: string; streamKey: string };

export type ResultadoDestinos = { ok: true; outputs: OutputAPedir[] } | { ok: false; error: string };

/**
 * Arma la lista de outputs a crear, validando cada destino elegido. Si uno está mal no se crea
 * ninguno: mejor avisar antes que salir en vivo en dos redes de tres.
 */
export function armarOutputs(pedido: PedidoDestinos): ResultadoDestinos {
  const outputs: OutputAPedir[] = [];

  if (pedido.youtube.elegido) {
    if (!pedido.youtube.claveGuardada) {
      return { ok: false, error: "Para YouTube, primero guardá la clave persistente en Configurar." };
    }
    outputs.push({ destino: "YOUTUBE", url: YOUTUBE_RTMP_URL, streamKey: pedido.youtube.claveGuardada.trim() });
  }

  if (pedido.instagram.elegido) {
    const e = validarServidor(pedido.instagram.servidor) ?? validarClave(pedido.instagram.clave);
    if (e) return { ok: false, error: `Instagram: ${e}` };
    outputs.push({ destino: "INSTAGRAM", url: pedido.instagram.servidor.trim(), streamKey: pedido.instagram.clave.trim() });
  }

  if (pedido.tiktok.elegido) {
    const servidor = pedido.tiktok.servidor.trim() || pedido.tiktok.servidorGuardado?.trim() || "";
    const clave = pedido.tiktok.clave.trim() || pedido.tiktok.claveGuardada?.trim() || "";
    const e = validarServidor(servidor) ?? validarClave(clave);
    if (e) return { ok: false, error: `TikTok: ${e}` };
    outputs.push({ destino: "TIKTOK", url: servidor, streamKey: clave });
  }

  return { ok: true, outputs };
}

/** Cómo quedó cada destino en el vivo. Es lo que se guarda en `FotofficeLiveSession.destinations`. */
export type DestinoUsado = {
  destino: Destino;
  /** Uid del output en Cloudflare; null si no se pudo crear. */
  outputUid: string | null;
  /** Últimos 4 de la clave usada. Nunca la clave. */
  terminacion: string;
  estado: "ACTIVO" | "BORRADO" | "ERROR";
  error?: string;
};

export function destinoUsado(o: OutputAPedir, outputUid: string | null, error?: string): DestinoUsado {
  return {
    destino: o.destino,
    outputUid,
    terminacion: terminacion(o.streamKey),
    estado: outputUid ? "ACTIVO" : "ERROR",
    ...(error ? { error: error.slice(0, 300) } : {}),
  };
}

/**
 * Lee el JSON guardado sin confiar en él: sólo pasan los campos conocidos. Si alguna vez se
 * colara una clave en otro campo, no llega a la pantalla.
 */
export function leerDestinosUsados(valor: unknown): DestinoUsado[] {
  if (!Array.isArray(valor)) return [];
  const out: DestinoUsado[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.destino !== "string" || !DESTINOS.includes(r.destino as Destino)) continue;
    const estado = r.estado === "ACTIVO" || r.estado === "BORRADO" || r.estado === "ERROR" ? r.estado : "ERROR";
    out.push({
      destino: r.destino as Destino,
      outputUid: typeof r.outputUid === "string" ? r.outputUid : null,
      terminacion: typeof r.terminacion === "string" ? r.terminacion.slice(-4) : "",
      estado,
      ...(typeof r.error === "string" ? { error: r.error.slice(0, 300) } : {}),
    });
  }
  return out;
}
