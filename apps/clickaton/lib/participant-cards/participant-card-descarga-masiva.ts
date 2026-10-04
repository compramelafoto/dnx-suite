/**
 * Bajar de una vez todas las placas listas de una edición.
 *
 * Con 37 inscripciones y dos placas cada una son 74 archivos: de a uno es inviable. Quien abre
 * el comprimido tiene que poder encontrar la placa de alguien sin abrirlas todas, así que el
 * nombre lleva adelante el número de participante.
 */
import type { ClickatonParticipantCardType } from "./participant-card-types";

const NOMBRE_DE_PLACA: Record<ClickatonParticipantCardType, string> = {
  welcome: "bienvenida",
  member: "soy-parte",
};

/**
 * Deja el texto en algo que se descomprime bien en cualquier computadora.
 *
 * Los acentos y la eñe se transcriben en vez de borrarse: `Ñoño` es más reconocible como
 * `Nono` que como `oo`. Las barras y los dos puntos rompen al descomprimir en Windows.
 */
function aNombreDeArchivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nombreDeArchivoDePlaca(input: {
  visibleCode?: string | null;
  registrationId?: string;
  cardType: ClickatonParticipantCardType;
}): string {
  const identidad = aNombreDeArchivo(
    input.visibleCode?.trim() || input.registrationId || "sin-numero",
  );
  return `${identidad}-${NOMBRE_DE_PLACA[input.cardType]}.png`;
}

/**
 * Numera los nombres repetidos en vez de dejar que se pisen.
 *
 * Dos inscripciones pueden compartir número visible —pasa cuando alguien lo carga a mano—, y un
 * comprimido con dos archivos del mismo nombre pierde uno sin avisar.
 */
export function nombresSinRepetir(nombres: readonly string[]): string[] {
  const usados = new Map<string, number>();

  return nombres.map((nombre) => {
    const vistas = usados.get(nombre) ?? 0;
    usados.set(nombre, vistas + 1);
    if (vistas === 0) return nombre;

    const punto = nombre.lastIndexOf(".");
    const base = punto === -1 ? nombre : nombre.slice(0, punto);
    const extension = punto === -1 ? "" : nombre.slice(punto);
    return `${base}-${vistas + 1}${extension}`;
  });
}
