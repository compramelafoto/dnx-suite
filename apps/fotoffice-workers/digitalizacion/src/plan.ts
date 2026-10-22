import { argumentosSalidaHls } from "./hls";
import { expresionMarcaX } from "./marca-tiempo";

export type GrabacionParaPlan = {
  tipo: string; // VHS | DVD
  corregirProporcion: boolean;
  sinImagen: boolean;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  ultimaImagenTramo: number | null;
};

export type ParteR2 = { tramo: number; indice: number; key: string };

export type EntradaPlan = {
  tramo: number;
  claves: string[];
  desdeSeg: number | null;
  hastaSeg: number | null;
};

export type Plan =
  | { tipo: "SIN_IMAGEN" }
  | { tipo: "SIN_PARTES" }
  | { tipo: "CONVERTIR"; esDvd: boolean; corregirProporcion: boolean; entradas: EntradaPlan[] };

const MARGEN_SEG = 5;

export function armarPlan(g: GrabacionParaPlan, partes: ParteR2[]): Plan {
  const esDvd = g.tipo === "DVD";
  if (!esDvd && g.sinImagen) return { tipo: "SIN_IMAGEN" };
  if (partes.length === 0) return { tipo: "SIN_PARTES" };

  const ordenadas = [...partes].sort((a, b) => a.tramo - b.tramo || a.indice - b.indice);

  if (esDvd) {
    return {
      tipo: "CONVERTIR",
      esDvd: true,
      corregirProporcion: g.corregirProporcion,
      entradas: [{ tramo: 1, claves: ordenadas.map((p) => p.key), desdeSeg: null, hastaSeg: null }],
    };
  }

  const porTramo = new Map<number, string[]>();
  for (const p of ordenadas) {
    const lista = porTramo.get(p.tramo) ?? [];
    lista.push(p.key);
    porTramo.set(p.tramo, lista);
  }
  const ultimoTramo = g.ultimaImagenTramo;
  const entradas: EntradaPlan[] = [];
  for (const [tramo, claves] of [...porTramo.entries()].sort((a, b) => a[0] - b[0])) {
    if (ultimoTramo != null && tramo > ultimoTramo) continue;
    const desdeSeg =
      tramo === 1 && g.primeraImagenSeg != null ? Math.max(0, g.primeraImagenSeg - MARGEN_SEG) : null;
    const hastaSeg =
      ultimoTramo != null && tramo === ultimoTramo && g.ultimaImagenSeg != null
        ? g.ultimaImagenSeg + MARGEN_SEG
        : null;
    entradas.push({ tramo, claves, desdeSeg, hastaSeg });
  }
  if (entradas.length === 0) return { tipo: "SIN_PARTES" };
  return { tipo: "CONVERTIR", esDvd: false, corregirProporcion: g.corregirProporcion, entradas };
}

type Convertir = Extract<Plan, { tipo: "CONVERTIR" }>;

function num(n: number): string {
  return String(Number(n.toFixed(3)));
}

export function filtroComplejo(plan: Convertir): string {
  const escala = plan.corregirProporcion
    ? "scale=1440:1080"
    : "scale=1920:1080:force_original_aspect_ratio=decrease";
  const partes: string[] = [];
  plan.entradas.forEach((e, i) => {
    const tv: string[] = [];
    const ta: string[] = [];
    if (e.desdeSeg != null) {
      tv.push(`start=${num(e.desdeSeg)}`);
      ta.push(`start=${num(e.desdeSeg)}`);
    }
    if (e.hastaSeg != null) {
      tv.push(`end=${num(e.hastaSeg)}`);
      ta.push(`end=${num(e.hastaSeg)}`);
    }
    const recorteV = tv.length ? `trim=${tv.join(":")},setpts=PTS-STARTPTS,` : "";
    const recorteA = ta.length ? `atrim=${ta.join(":")},asetpts=PTS-STARTPTS,` : "";
    partes.push(
      `[${i}:v:0]${recorteV}yadif=deint=interlaced,scale=iw*sar:ih,setsar=1,${escala},` +
        `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v${i}]`,
    );
    partes.push(`[${i}:a:0]${recorteA}aresample=48000[a${i}]`);
  });
  const n = plan.entradas.length;
  if (n > 1) {
    const ins = plan.entradas.map((_, i) => `[v${i}][a${i}]`).join("");
    partes.push(`${ins}concat=n=${n}:v=1:a=1[vc][ac]`);
  } else {
    partes.push("[v0]null[vc]");
    partes.push("[a0]anull[ac]");
  }
  partes.push(`[vc][${n}:v]overlay=x='${expresionMarcaX()}':y='H-h-40':eval=frame:shortest=1[vout]`);
  return partes.join(";");
}

/**
 * Con `dirHls`, el mismo ffmpeg saca además la versión para mirar: el cuadro final (con la marca y
 * el pillarbox) se parte con `split` y una copia se escala a 1280×720 para el HLS.
 */
export function argumentosFfmpeg(
  plan: Convertir,
  rutasEntrada: string[],
  rutaMarca: string,
  preset: string,
  dirHls?: string,
): string[] {
  const args = ["-hide_banner", "-nostdin", "-y", "-stats_period", "10"];
  for (const r of rutasEntrada) args.push("-i", r);
  args.push("-loop", "1", "-framerate", "30", "-i", rutaMarca);
  let filtro = filtroComplejo(plan);
  let video = "[vout]";
  let audio = "[ac]";
  if (dirHls) {
    filtro += ";[vout]split=2[vmp4][vh];[vh]scale=1280:720,setsar=1[v720];[ac]asplit=2[amp4][a720]";
    video = "[vmp4]";
    audio = "[amp4]";
  }
  args.push(
    "-filter_complex", filtro,
    "-map", video, "-map", audio,
    "-c:v", "libx264", "-profile:v", "high", "-preset", preset,
    "-crf", "21", "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  );
  if (dirHls) args.push(...argumentosSalidaHls(dirHls, "[v720]", "[a720]"));
  return args;
}
