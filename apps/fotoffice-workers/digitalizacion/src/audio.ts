import { spawn } from "node:child_process";

/**
 * ¿La grabación trae pista de audio? Se mira sólo el comienzo de la primera parte de cada tramo:
 * en un WebM la lista de pistas está en la cabecera, al principio; un VOB de DVD tiene paquetes de
 * audio desde el comienzo. Con 8 MB sobra y no se baja la grabación entera.
 */
export const BYTES_SONDEO = 8 * 1024 * 1024;
const TIEMPO_SONDEO_MS = 60_000;

export type ResultadoSondeo = { codigo: number | null; salida: string; error: string };
/** Corre ffprobe sobre el comienzo de un archivo (por stdin). */
export type Sondeo = (inicio: Buffer) => Promise<ResultadoSondeo>;

export type DepsAudio = {
  /** Los primeros `bytes` de un objeto de R2 (GetObject con Range). */
  leerInicio(clave: string, bytes: number): Promise<Buffer>;
  sondear: Sondeo;
  registrar?: (msg: string) => void;
};

export function sondearConFfprobe(ffprobePath = "ffprobe", tiempoMs = TIEMPO_SONDEO_MS): Sondeo {
  return (inicio) =>
    new Promise((resolve, reject) => {
      const p = spawn(
        ffprobePath,
        ["-hide_banner", "-v", "error", "-show_streams", "-select_streams", "a", "-of", "json", "-i", "pipe:0"],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let salida = "";
      let error = "";
      const reloj = setTimeout(() => p.kill("SIGKILL"), tiempoMs);
      p.stdout.on("data", (c: Buffer) => (salida += c.toString("utf8")));
      p.stderr.on("data", (c: Buffer) => (error = (error + c.toString("utf8")).slice(-2000)));
      // ffprobe puede dejar de leer antes del final (ya vio la cabecera): un EPIPE no es un error.
      p.stdin.on("error", () => {});
      p.once("error", (e) => {
        clearTimeout(reloj);
        reject(e);
      });
      p.once("close", (codigo) => {
        clearTimeout(reloj);
        resolve({ codigo, salida, error });
      });
      p.stdin.end(inicio);
    });
}

/**
 * true si la parte trae al menos una pista de audio. Ante cualquier duda (error de red, ffprobe que
 * falla o devuelve algo ilegible) se asume que SÍ hay audio, que es como funcionaba siempre, y se
 * deja registrado.
 */
export async function detectarAudio(clave: string, deps: DepsAudio): Promise<boolean> {
  const log = deps.registrar ?? ((m: string) => console.log(`[digitalizacion] ${m}`));
  try {
    const inicio = await deps.leerInicio(clave, BYTES_SONDEO);
    if (inicio.length === 0) throw new Error("la parte está vacía");
    const r = await deps.sondear(inicio);
    let pistas: unknown[] | null = null;
    try {
      const json = JSON.parse(r.salida) as { streams?: unknown };
      if (Array.isArray(json.streams)) pistas = json.streams;
    } catch {
      /* salida ilegible */
    }
    if (pistas && pistas.length > 0) return true;
    if (pistas && r.codigo === 0) return false;
    throw new Error(`ffprobe terminó con código ${r.codigo}: ${r.error.replace(/\s+/g, " ").trim().slice(0, 300)}`);
  } catch (e) {
    log(`no se pudo saber si ${clave} tiene audio (${e instanceof Error ? e.message : e}); se asume que sí`);
    return true;
  }
}
