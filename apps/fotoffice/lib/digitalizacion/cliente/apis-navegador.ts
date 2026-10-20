/** Acceso tipado a APIs de Chrome/Edge que todavía no están (o no completas) en lib.dom. */

type ConPip = { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window>; window: Window | null } };
type ConArchivos = {
  showDirectoryPicker?: (o?: { mode?: "read" }) => Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?: (o?: { suggestedName?: string }) => Promise<FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }>;
};
type ConProcesador = { MediaStreamTrackProcessor?: new (o: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> } };

const w = () => window as unknown as Window & ConPip & ConArchivos & ConProcesador;

export function navegadorCompatible(): boolean {
  if (typeof window === "undefined") return false;
  const v = w();
  return Boolean(v.documentPictureInPicture && v.MediaStreamTrackProcessor && v.showDirectoryPicker && v.showSaveFilePicker && typeof MediaRecorder !== "undefined" && "indexedDB" in v);
}

export function pedirVentanaFlotante(ancho: number, alto: number): Promise<Window> {
  const pip = w().documentPictureInPicture;
  if (!pip) throw new Error("Este navegador no tiene ventanita flotante.");
  return pip.requestWindow({ width: ancho, height: alto });
}

export function elegirCarpeta(): Promise<FileSystemDirectoryHandle> {
  const f = w().showDirectoryPicker;
  if (!f) throw new Error("Este navegador no deja elegir carpetas.");
  return f({ mode: "read" });
}

export async function elegirArchivoDeDestino(nombre: string): Promise<FileSystemWritableFileStream> {
  const f = w().showSaveFilePicker;
  if (!f) throw new Error("Este navegador no deja guardar archivos.");
  return (await f({ suggestedName: nombre })).createWritable();
}

/** Un lector de cuadros sobre una COPIA de la pista: se puede pasar al worker sin tocar la grabación. */
export function procesadorDeCuadros(track: MediaStreamTrack): ReadableStream<VideoFrame> {
  const P = w().MediaStreamTrackProcessor;
  if (!P) throw new Error("Este navegador no deja analizar el video.");
  return new P({ track: track.clone() }).readable;
}
