import fs from "node:fs";
import path from "node:path";

/**
 * Versión para mirar (spec 2026-10-22, E10): HLS VOD 720p, H.264 ~2 Mbps + AAC 128k, segmentos
 * MPEG-TS de 6 s (lo más compatible: Safari nativo y hls.js). Se arma SIEMPRE aparte, desde el
 * `final.mp4` ya subido (la conversión del MP4 no sabe nada del HLS). En R2 queda bajo
 * `<carpeta de la grabación>/hls-<intento>/`: `index.m3u8` y `seg_00001.ts`, `seg_00002.ts`…
 *
 * ffmpeg escribe los segmentos en una carpeta temporal; el subidor sube cada uno apenas está
 * completo y lo borra, así en el disco (que en Cloud Run es memoria) quedan unos pocos.
 */

export const PLAYLIST = "index.m3u8";
const REGEX_SEGMENTO = /^seg_(\d+)\.ts$/;
const REGEX_TEMPORAL = /^seg_(\d+)\.ts\.tmp$/;
const TIPO_SEGMENTO = "video/mp2t";
const TIPO_PLAYLIST = "application/vnd.apple.mpegurl";
/**
 * Medido con un clip sintético de 30 s 1080p30 (8 núcleos): veryfast 13,3 s de CPU, superfast
 * 10,3 s (−23 %), ultrafast 8,5 s pero con peor calidad al mismo bitrate.
 */
export const PRESET_HLS = "superfast";

export function nombreDeSegmento(n: number): string {
  return `seg_${String(n).padStart(5, "0")}.ts`;
}

/** La salida HLS de ffmpeg a partir de las etiquetas de video y audio ya escaladas a 720p. */
export function argumentosSalidaHls(dir: string, video: string, audio: string, preset: string = PRESET_HLS): string[] {
  return [
    "-map", video, "-map", audio,
    "-c:v", "libx264", "-profile:v", "main", "-preset", preset,
    "-b:v", "2000k", "-maxrate", "2400k", "-bufsize", "4000k", "-pix_fmt", "yuv420p",
    // El cuadro final ya está a 30 fps: un cuadro clave cada 6 s exactos, sin cortes por escena.
    "-g", "180", "-keyint_min", "180", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_list_size", "0",
    "-hls_segment_type", "mpegts", "-hls_flags", "independent_segments+temp_file",
    "-start_number", "1",
    "-hls_segment_filename", path.join(dir, "seg_%05d.ts"),
    path.join(dir, PLAYLIST),
  ];
}

/**
 * Relleno de lo ya convertido: el `final.mp4` (1920×1080 con la marca y el pillarbox quemados)
 * entra por un descriptor y sólo se escala.
 */
export function argumentosRelleno(entrada: string, dir: string, preset: string = PRESET_HLS): string[] {
  return [
    "-hide_banner", "-nostdin", "-y", "-stats_period", "10",
    "-i", entrada,
    "-filter_complex", "[0:v:0]scale=1280:720,setsar=1,format=yuv420p[v720]",
    ...argumentosSalidaHls(dir, "[v720]", "0:a:0?", preset),
  ];
}

/**
 * ¿Qué segmentos ya están completos? ffmpeg cierra el segmento N antes de abrir el N+1, así que
 * N está completo si ya existe uno posterior (terminado o `.tmp`), o si ffmpeg terminó. Los
 * `.tmp` (con `temp_file`) nunca se suben.
 */
export function segmentosCompletos(nombres: string[], terminado: boolean): string[] {
  let mayor = -1;
  const segs: { n: number; nombre: string }[] = [];
  for (const nombre of nombres) {
    const s = nombre.match(REGEX_SEGMENTO);
    const t = nombre.match(REGEX_TEMPORAL);
    const n = Number((s ?? t)?.[1] ?? NaN);
    if (!Number.isFinite(n)) continue;
    mayor = Math.max(mayor, n);
    if (s) segs.push({ n, nombre });
  }
  return segs
    .filter((s) => terminado || s.n < mayor)
    .sort((a, b) => a.n - b.n)
    .map((s) => s.nombre);
}

/** Una playlist VOD terminada (`#EXT-X-ENDLIST`) que sólo nombra segmentos nuestros. */
export function validarPlaylist(texto: string): { ok: true; segmentos: string[] } | { ok: false; error: string } {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas[0] !== "#EXTM3U") return { ok: false, error: "La playlist no empieza con #EXTM3U." };
  if (!lineas.includes("#EXT-X-ENDLIST")) return { ok: false, error: "La playlist no está terminada." };
  const segmentos: string[] = [];
  for (const l of lineas) {
    if (l.startsWith("#")) continue;
    if (!REGEX_SEGMENTO.test(l)) return { ok: false, error: `Segmento con nombre inesperado: ${l.slice(0, 60)}` };
    segmentos.push(l);
  }
  if (segmentos.length === 0) return { ok: false, error: "La playlist no tiene segmentos." };
  return { ok: true, segmentos };
}

export type OpcionesSubidor = {
  dir: string;
  /** `digitalizacion/<ws>/<grabacion>/hls`, sin barra final. */
  prefijoHls: string;
  subirArchivo(clave: string, cuerpo: Buffer, tipo: string): Promise<void>;
  /** Cada cuánto se mira la carpeta (default 2 s). */
  intervaloMs?: number;
  /** Esperas entre reintentos de un segmento (default 1/3/10 s). */
  esperasMs?: number[];
  /**
   * Red de seguridad: si igual se acumulan más segmentos completos sin subir (se cuenta antes de
   * cada subida), se abandona el HLS. Default 40 ≈ 60 MB; la contrapresión del relleno frena antes.
   */
  maxPendientes?: number;
  registrar?: (msg: string) => void;
};

export type SubidorHls = {
  iniciar(): void;
  /** Una pasada: sube (o, si el HLS ya falló, descarta) los segmentos completos. */
  revisar(): Promise<void>;
  /**
   * Para de mirar. Con `ok` (ffmpeg terminó bien), sube lo que falta y la playlist; devuelve true
   * sólo si quedó todo publicado. Nunca lanza.
   */
  terminar(ok: boolean): Promise<boolean>;
  fallo(): string | null;
  /** Si subió al menos un archivo (para saber si hay que limpiar en R2). */
  subioAlgo(): boolean;
  /**
   * Segmentos en el disco sin subir (completos y el que ffmpeg está escribiendo), sus bytes, y
   * cuántos ya se pueden subir (si es 0, sólo ffmpeg puede hacer avanzar las cosas).
   */
  pendientes(): Promise<{ cantidad: number; bytes: number; subibles: number }>;
};

export function crearSubidorHls(o: OpcionesSubidor): SubidorHls {
  const log = o.registrar ?? ((m: string) => console.log(`[digitalizacion][hls] ${m}`));
  const esperas = o.esperasMs ?? [1000, 3000, 10000];
  const maxPendientes = o.maxPendientes ?? 40;
  const subidos = new Set<string>();
  let falla: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let algo = false;

  const fallar = (motivo: string) => {
    if (falla) return;
    falla = motivo;
    log(`se abandona la versión para mirar: ${motivo}`);
  };

  const borrarLocal = (nombre: string) => fs.promises.rm(path.join(o.dir, nombre), { force: true }).catch(() => {});

  async function subirConReintentos(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
    for (let i = 0; ; i++) {
      try {
        await o.subirArchivo(clave, cuerpo, tipo);
        algo = true;
        return;
      } catch (e) {
        if (i >= esperas.length) throw e;
        await new Promise((r) => setTimeout(r, esperas[i]));
      }
    }
  }

  async function pasada(terminado: boolean): Promise<void> {
    let nombres: string[];
    try {
      nombres = await fs.promises.readdir(o.dir);
    } catch (e) {
      fallar(`no se pudo leer la carpeta temporal (${e instanceof Error ? e.message : e})`);
      return;
    }
    const completos = segmentosCompletos(nombres, terminado).filter((n) => !subidos.has(n));
    for (const nombre of completos) {
      if (!falla) {
        // Se cuenta de nuevo antes de cada subida: mientras una sube lenta, ffmpeg sigue escribiendo.
        const ahora = await fs.promises.readdir(o.dir).catch(() => nombres);
        const esperando = segmentosCompletos(ahora, terminado).filter((n) => !subidos.has(n)).length;
        if (esperando > maxPendientes) fallar(`${esperando} segmentos pendientes de subir`);
      }
      if (!falla) {
        try {
          const cuerpo = await fs.promises.readFile(path.join(o.dir, nombre));
          await subirConReintentos(`${o.prefijoHls}/${nombre}`, cuerpo, TIPO_SEGMENTO);
          subidos.add(nombre);
        } catch (e) {
          fallar(`no se pudo subir ${nombre} (${e instanceof Error ? e.message : e})`);
        }
      }
      // Subido o descartado: fuera del disco.
      await borrarLocal(nombre);
    }
  }

  // Las pasadas van en fila: nunca dos a la vez sobre la misma carpeta.
  let cadena: Promise<void> = Promise.resolve();
  let pendientes = 0;
  const revisar = (terminado = false): Promise<void> => {
    pendientes++;
    const p = cadena.then(() => pasada(terminado)).finally(() => pendientes--);
    cadena = p.catch(() => {});
    return p;
  };

  return {
    iniciar() {
      if (timer) return;
      // Si una subida viene lenta no se apilan pasadas.
      timer = setInterval(() => {
        if (pendientes === 0) void revisar();
      }, o.intervaloMs ?? 2000);
    },
    revisar: () => revisar(false),
    async terminar(ok) {
      if (timer) clearInterval(timer);
      timer = null;
      try {
        if (!ok) fallar("la conversión no terminó bien");
        await revisar(true);
        if (falla) return false;
        const texto = await fs.promises.readFile(path.join(o.dir, PLAYLIST), "utf8");
        const v = validarPlaylist(texto);
        if (!v.ok) {
          fallar(v.error);
          return false;
        }
        const faltan = v.segmentos.filter((s) => !subidos.has(s));
        if (faltan.length > 0) {
          fallar(`la playlist nombra ${faltan.length} segmentos que no se subieron`);
          return false;
        }
        await subirConReintentos(`${o.prefijoHls}/${PLAYLIST}`, Buffer.from(texto, "utf8"), TIPO_PLAYLIST);
        log(`versión para mirar publicada: ${v.segmentos.length} segmentos`);
        return true;
      } catch (e) {
        fallar(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    fallo: () => falla,
    subioAlgo: () => algo,
    async pendientes() {
      const nombres = await fs.promises.readdir(o.dir).catch(() => [] as string[]);
      let cantidad = 0;
      let bytes = 0;
      for (const n of nombres) {
        if (!REGEX_SEGMENTO.test(n) && !REGEX_TEMPORAL.test(n)) continue;
        const st = await fs.promises.stat(path.join(o.dir, n)).catch(() => null);
        if (!st) continue;
        cantidad++;
        bytes += st.size;
      }
      const subibles = segmentosCompletos(nombres, false).filter((n) => !subidos.has(n)).length;
      return { cantidad, bytes, subibles };
    },
  };
}
