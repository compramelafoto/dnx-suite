/**
 * Los saludos grabados del invitado.
 *
 * Es como un mensaje pero con la voz: se graba desde el teléfono, no hace falta
 * escribir, y para alguien que no se lleva bien con el teclado —o que está en una pista
 * a oscuras— es la diferencia entre dejar un saludo y no dejar nada.
 *
 * **No suena en el salón.** El DJ tiene la música puesta y el parlante de un televisor
 * no se escucha: proyectarlo sería mandar algo que nadie oye. Se guarda, el fotógrafo lo
 * escucha en Control en vivo, y va en la descarga que se llevan los anfitriones.
 *
 * Eso resuelve de paso lo de la moderación: Amazon mira imágenes y no escucha audio, así
 * que no hay nada automático que lo revise. Al no proyectarse, lo peor que puede pasar es
 * que el fotógrafo lo escuche después y lo saque antes de entregarlo.
 */

/**
 * Veinte segundos.
 *
 * El tope no es por el peso: un saludo de dos minutos no lo escucha nadie, y quien lo
 * graba se arrepiente a la mitad. Veinte alcanzan para "feliz cumple, te queremos mucho"
 * y para una risa.
 */
export const DURACION_MAXIMA_S = 20;

/** Red de seguridad por si el navegador miente con la duración. */
export const TAMANO_MAXIMO_AUDIO = 5 * 1024 * 1024;

/**
 * Los formatos que graba un teléfono.
 *
 * `webm` lo graba Android y Chrome; `mp4` y `m4a`, el iPhone. Si falta alguno, la mitad
 * de los invitados de una fiesta no puede dejar un saludo y no se entera de por qué.
 */
const TIPOS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
};

/** El navegador manda `audio/webm;codecs=opus`, no `audio/webm` a secas. */
const sinCodec = (tipo: string) => tipo.toLowerCase().split(";")[0]!.trim();

export type Veredicto = { ok: boolean; motivo?: string };

export function validarAudio(archivo: {
  tipo: string;
  bytes: number;
  /** `null` cuando el navegador no la sabe: algunos devuelven `Infinity`. */
  segundos: number | null;
}): Veredicto {
  if (!TIPOS[sinCodec(archivo.tipo)]) {
    return { ok: false, motivo: "Ese formato de audio no lo podemos reproducir." };
  }
  if (archivo.bytes <= 0) {
    return { ok: false, motivo: "La grabación llegó vacía. Probá de nuevo." };
  }
  if (archivo.bytes > TAMANO_MAXIMO_AUDIO) {
    return { ok: false, motivo: "La grabación pesa más de 5 MB." };
  }
  /*
    La duración se controla sólo si el navegador la sabe. Rechazar cuando no la informa
    dejaría sin grabar a quien usa ese navegador, y el tope de peso ya evita que entre
    algo desmedido.
  */
  if (archivo.segundos !== null && archivo.segundos > DURACION_MAXIMA_S) {
    return {
      ok: false,
      motivo: `El saludo no puede pasar de ${DURACION_MAXIMA_S} segundos.`,
    };
  }

  return { ok: true };
}

const saneado = (valor: string) => valor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "x";

/** Cuelga del evento: es suyo y desaparece con él a los 30 días. */
export function claveDeAudio(codigoDeEvento: string, tipo: string, id: string): string {
  const extension = TIPOS[sinCodec(tipo)] ?? "bin";
  return `eventos/${saneado(codigoDeEvento)}/audio-${saneado(id)}.${extension}`;
}

/** El prefijo `audio-` es lo que lo distingue de una foto y de una portada. */
export function esClaveDeAudio(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^eventos\/[a-zA-Z0-9_-]+\/audio-[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(valor);
}
