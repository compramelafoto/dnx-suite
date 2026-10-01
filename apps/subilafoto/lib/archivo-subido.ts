/**
 * Qué archivo se acepta del invitado y dónde se guarda.
 *
 * Todo lo que llega de un teléfono ajeno es sospechoso: el tipo declarado, el nombre del
 * archivo y el tamaño. Acá se decide qué entra, y la ruta se arma con datos propios, nunca
 * con el nombre que mandó el celular.
 */

/** 25 MB. Una foto de celular moderno ronda los 3 a 8; 25 deja lugar para las de más calidad. */
export const TAMANO_MAXIMO = 25 * 1024 * 1024;

const TIPOS_ACEPTADOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  // Lo que sacan los iPhone por defecto.
  "image/heic": "heic",
  "image/heif": "heif",
};

export type Veredicto = { ok: boolean; motivo?: string };

export function validarArchivo(archivo: { tipo: string; bytes: number }): Veredicto {
  const tipo = archivo.tipo.toLowerCase().trim();

  if (!TIPOS_ACEPTADOS[tipo]) {
    return { ok: false, motivo: "Ese archivo no es una foto que podamos mostrar." };
  }

  if (archivo.bytes <= 0) {
    return { ok: false, motivo: "El archivo llegó vacío. Probá de nuevo." };
  }

  if (archivo.bytes > TAMANO_MAXIMO) {
    return { ok: false, motivo: "La foto pesa más de 25 MB. Probá con otra." };
  }

  return { ok: true };
}

/** Deja sólo lo que puede ir en una ruta: nada de barras, puntos dobles ni espacios. */
function saneado(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "sin-id";
}

/**
 * La ruta del archivo dentro del bucket.
 *
 * La extensión sale del tipo declarado y no del nombre original: un archivo llamado
 * `foto.jpg.exe` o `../../otro-evento/x.jpg` no puede escribir donde no corresponde.
 */
export function claveDeArchivo(codigoEvento: string, id: string, tipo: string): string {
  const extension = TIPOS_ACEPTADOS[tipo.toLowerCase().trim()] ?? "bin";
  return `eventos/${saneado(codigoEvento)}/${saneado(id)}.${extension}`;
}
