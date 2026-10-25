import { describe, expect, it } from "vitest";
import { expresionMarcaX } from "./marca-tiempo";
import { argumentosFfmpeg, armarPlan, conAudio, filtroComplejo, FILTRO_NORMALIZAR_AUDIO, type GrabacionParaPlan, type ParteR2 } from "./plan";

const base: GrabacionParaPlan = {
  tipo: "VHS",
  corregirProporcion: false,
  sinImagen: false,
  primeraImagenSeg: null,
  ultimaImagenSeg: null,
  ultimaImagenTramo: null,
};
const p = (tramo: number, indice: number): ParteR2 => ({ tramo, indice, key: `t${tramo}/${indice}` });

function convertir(plan: ReturnType<typeof armarPlan>) {
  if (plan.tipo !== "CONVERTIR") throw new Error("no es CONVERTIR");
  return plan;
}

describe("armarPlan", () => {
  it("VHS de un tramo con recortes", () => {
    const plan = convertir(
      armarPlan({ ...base, primeraImagenSeg: 12, ultimaImagenSeg: 80, ultimaImagenTramo: 1 }, [p(1, 1), p(1, 0)]),
    );
    expect(plan.entradas).toEqual([{ tramo: 1, claves: ["t1/0", "t1/1"], desdeSeg: 7, hastaSeg: 85 }]);
  });
  it("3 tramos con ultimaImagenTramo=2 descarta el 3", () => {
    const plan = convertir(
      armarPlan({ ...base, primeraImagenSeg: 20, ultimaImagenSeg: 30, ultimaImagenTramo: 2 }, [
        p(3, 0), p(2, 0), p(1, 0),
      ]),
    );
    expect(plan.entradas.map((e) => e.tramo)).toEqual([1, 2]);
    expect(plan.entradas[0]).toMatchObject({ desdeSeg: 15, hastaSeg: null });
    expect(plan.entradas[1]).toMatchObject({ desdeSeg: null, hastaSeg: 35 });
  });
  it("primeraImagenSeg=2 da desde=0", () => {
    const plan = convertir(armarPlan({ ...base, primeraImagenSeg: 2 }, [p(1, 0)]));
    expect(plan.entradas[0].desdeSeg).toBe(0);
  });
  it("sinImagen da SIN_IMAGEN", () => {
    expect(armarPlan({ ...base, sinImagen: true }, [p(1, 0)])).toEqual({ tipo: "SIN_IMAGEN" });
  });
  it("DVD: una entrada, sin recortes, en orden de indice", () => {
    const plan = convertir(
      armarPlan({ ...base, tipo: "DVD", primeraImagenSeg: 30, ultimaImagenSeg: 99, ultimaImagenTramo: 1 }, [
        p(1, 2), p(1, 0), p(1, 1),
      ]),
    );
    expect(plan.esDvd).toBe(true);
    expect(plan.entradas).toEqual([
      { tramo: 1, claves: ["t1/0", "t1/1", "t1/2"], desdeSeg: null, hastaSeg: null },
    ]);
  });
  it("sin partes da SIN_PARTES", () => {
    expect(armarPlan(base, [])).toEqual({ tipo: "SIN_PARTES" });
  });
});

describe("filtroComplejo", () => {
  it("estirada usa scale=1440:1080", () => {
    const f = filtroComplejo(convertir(armarPlan({ ...base, corregirProporcion: true }, [p(1, 0)])));
    expect(f).toContain("scale=1440:1080");
    expect(f).not.toContain("force_original_aspect_ratio");
  });
  it("no estirada encaja sin deformar", () => {
    const f = filtroComplejo(convertir(armarPlan(base, [p(1, 0)])));
    expect(f).toContain("force_original_aspect_ratio=decrease");
    expect(f).toContain("[v0]null[vc];[a0]anull[ac]");
    expect(f).not.toContain("trim=");
  });
  it("tres tramos usan concat n=3 y el recorte sólo donde corresponde", () => {
    const f = filtroComplejo(
      convertir(
        armarPlan({ ...base, primeraImagenSeg: 20, ultimaImagenSeg: 30, ultimaImagenTramo: 3 }, [
          p(1, 0), p(2, 0), p(3, 0),
        ]),
      ),
    );
    expect(f).toContain("concat=n=3:v=1:a=1[vc][ac]");
    expect(f).toContain("[0:v:0]trim=start=15,setpts");
    expect(f).toContain("[2:v:0]trim=end=35,setpts");
    expect(f).toContain("[1:v:0]yadif");
    expect(f).toContain("[vc][3:v]overlay=x='");
  });
});

describe("normalización del audio", () => {
  const veces = (s: string, sub: string) => s.split(sub).length - 1;
  it("EBU R128 de una pasada y vuelta a 48 kHz", () => {
    expect(FILTRO_NORMALIZAR_AUDIO).toBe("loudnorm=I=-16:TP=-1:LRA=11,aresample=48000");
  });
  it("varios tramos: una sola vez, después del concat, y la salida usa el audio normalizado", () => {
    const plan = convertir(armarPlan(base, [p(1, 0), p(2, 0), p(3, 0)]));
    const f = filtroComplejo(plan);
    expect(veces(f, "loudnorm")).toBe(1);
    expect(f.indexOf("concat=n=3")).toBeLessThan(f.indexOf("loudnorm"));
    expect(f).toContain(`[ac]${FILTRO_NORMALIZAR_AUDIO}[aout]`);
    // Cada tramo sigue igual: sólo se remuestrea, sin normalizar por separado.
    expect(f).toContain("[0:a:0]aresample=48000[a0]");
    const a = argumentosFfmpeg(plan, ["/f/0", "/f/1", "/f/2"], "/f/m.png", "veryfast");
    expect(a.join(" ")).toContain("-map [vout] -map [aout]");
    expect(a).not.toContain("[ac]");
    expect(a.join(" ")).toContain("-c:a aac -b:a 192k -ar 48000");
  });
  it("un tramo y DVD también se normalizan, una sola vez", () => {
    const uno = filtroComplejo(convertir(armarPlan(base, [p(1, 0)])));
    expect(uno).toContain(`[a0]anull[ac];[ac]${FILTRO_NORMALIZAR_AUDIO}[aout]`);
    const dvd = filtroComplejo(convertir(armarPlan({ ...base, tipo: "DVD" }, [p(1, 0), p(1, 1)])));
    expect(veces(dvd, "loudnorm")).toBe(1);
    expect(dvd).toContain(`[ac]${FILTRO_NORMALIZAR_AUDIO}[aout]`);
  });
  it("no cambia el video ni los recortes", () => {
    const f = filtroComplejo(
      convertir(armarPlan({ ...base, primeraImagenSeg: 20, ultimaImagenSeg: 30, ultimaImagenTramo: 2 }, [p(1, 0), p(2, 0)])),
    );
    expect(f).toContain("[0:a:0]atrim=start=15,asetpts=PTS-STARTPTS,aresample=48000[a0]");
    expect(f).toContain("[1:a:0]atrim=end=35,asetpts=PTS-STARTPTS,aresample=48000[a1]");
    expect(f).toContain("[vc][2:v]overlay=");
    expect(f).not.toMatch(/\[v[^\]]*\][^;]*loudnorm/);
  });
});

describe("argumentosFfmpeg", () => {
  it("entradas, marca en loop y salida fragmentada", () => {
    const plan = convertir(armarPlan(base, [p(1, 0), p(2, 0)]));
    const a = argumentosFfmpeg(plan, ["/f/0", "/f/1"], "/f/marca.png", "veryfast");
    expect(a.join(" ")).toContain("-i /f/0 -i /f/1 -loop 1 -framerate 30 -i /f/marca.png");
    expect(a).toContain("veryfast");
    expect(a.slice(-3)).toEqual(["-f", "mp4", "pipe:1"]);
    expect(a[a.indexOf("-filter_complex") + 1]).toContain("shortest=1");
  });
});

describe("grabaciones sin pista de audio", () => {
  // Filtros tal cual salían en origin/main (PR 717), con la expresión de la marca como <MARCA>.
  const V = "yadif=deint=interlaced,scale=iw*sar:ih,setsar=1";
  const ENCAJE = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p";
  const ESTIRA = "scale=1440:1080,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p";
  const MAIN_UNO =
    `[0:v:0]${V},${ENCAJE}[v0];[0:a:0]aresample=48000[a0];[v0]null[vc];[a0]anull[ac];` +
    `[ac]loudnorm=I=-16:TP=-1:LRA=11,aresample=48000[aout];[vc][1:v]overlay=x='<MARCA>':y='H-h-40':eval=frame:shortest=1[vout]`;
  const MAIN_TRES =
    `[0:v:0]trim=start=15,setpts=PTS-STARTPTS,${V},${ESTIRA}[v0];[0:a:0]atrim=start=15,asetpts=PTS-STARTPTS,aresample=48000[a0];` +
    `[1:v:0]${V},${ESTIRA}[v1];[1:a:0]aresample=48000[a1];` +
    `[2:v:0]trim=end=35,setpts=PTS-STARTPTS,${V},${ESTIRA}[v2];[2:a:0]atrim=end=35,asetpts=PTS-STARTPTS,aresample=48000[a2];` +
    `[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vc][ac];[ac]loudnorm=I=-16:TP=-1:LRA=11,aresample=48000[aout];` +
    `[vc][3:v]overlay=x='<MARCA>':y='H-h-40':eval=frame:shortest=1[vout]`;
  const sinMarca = (f: string) => f.split(expresionMarcaX()).join("<MARCA>");
  const tres = () =>
    convertir(
      armarPlan({ ...base, primeraImagenSeg: 20, ultimaImagenSeg: 30, ultimaImagenTramo: 3, corregirProporcion: true }, [
        p(1, 0), p(2, 0), p(3, 0),
      ]),
    );
  const SILENCIO = "anullsrc=r=48000:cl=stereo,atrim=end_sample=0";

  it("todos con audio: el filtro es idéntico al de origin/main (con y sin el dato de audio)", () => {
    expect(sinMarca(filtroComplejo(convertir(armarPlan(base, [p(1, 0)]))))).toBe(MAIN_UNO);
    expect(sinMarca(filtroComplejo(tres()))).toBe(MAIN_TRES);
    expect(sinMarca(filtroComplejo(conAudio(tres(), [true, true, true])))).toBe(MAIN_TRES);
    const dvd = convertir(armarPlan({ ...base, tipo: "DVD" }, [p(1, 0), p(1, 1)]));
    expect(sinMarca(filtroComplejo(conAudio(dvd, [true])))).toBe(MAIN_UNO);
    const a = argumentosFfmpeg(conAudio(tres(), [true, true, true]), ["a", "b", "c"], "m", "veryfast");
    expect(a).toEqual(argumentosFfmpeg(tres(), ["a", "b", "c"], "m", "veryfast"));
  });

  it("un tramo sin audio: silencio vacío y concat con un tramo vacío al final", () => {
    const f = filtroComplejo(conAudio(tres(), [true, false, true]));
    expect(f).toContain(`${SILENCIO}[a1]`);
    expect(f).not.toContain("[1:a:0]");
    // Los tramos con audio siguen igual, con sus recortes.
    expect(f).toContain("[0:a:0]atrim=start=15,asetpts=PTS-STARTPTS,aresample=48000[a0]");
    expect(f).toContain("[2:a:0]atrim=end=35,asetpts=PTS-STARTPTS,aresample=48000[a2]");
    expect(f).toContain("color=black:s=1920x1080:r=30,format=yuv420p,setsar=1,trim=end_frame=0[vz]");
    expect(f).toContain(`${SILENCIO}[az]`);
    expect(f).toContain("[v0][a0][v1][a1][v2][a2][vz][az]concat=n=4:v=1:a=1[vc][ac]");
    expect(f).toContain(`[ac]${FILTRO_NORMALIZAR_AUDIO}[aout]`);
    // La marca sigue siendo la entrada que va después de los tramos.
    expect(f).toContain("[vc][3:v]overlay=");
    // El video no cambia.
    expect(f).toContain("[1:v:0]yadif");
    expect(f).toContain("[0:v:0]trim=start=15,setpts");
  });

  it("ningún tramo con audio: igual sale una pista de audio (silencio) y se mapea", () => {
    const plan = conAudio(tres(), [false, false, false]);
    const f = filtroComplejo(plan);
    expect(f).not.toMatch(/\[\d+:a/);
    expect(f.split(SILENCIO).length - 1).toBe(4);
    expect(f).toContain("concat=n=4:v=1:a=1[vc][ac]");
    expect(f).toContain(`[ac]${FILTRO_NORMALIZAR_AUDIO}[aout]`);
    const a = argumentosFfmpeg(plan, ["a", "b", "c"], "m", "veryfast").join(" ");
    expect(a).toContain("-map [vout] -map [aout]");
    expect(a).toContain("-c:a aac -b:a 192k -ar 48000");
  });

  it("VHS de un tramo sin audio: concat de 2 (el tramo y el vacío)", () => {
    const f = filtroComplejo(conAudio(convertir(armarPlan(base, [p(1, 0)])), [false]));
    expect(f).toContain(`${SILENCIO}[a0]`);
    expect(f).toContain("[v0][a0][vz][az]concat=n=2:v=1:a=1[vc][ac]");
    expect(f).not.toContain("[v0]null[vc]");
    expect(f).toContain("[vc][1:v]overlay=");
  });

  it("DVD sin audio", () => {
    const dvd = conAudio(convertir(armarPlan({ ...base, tipo: "DVD" }, [p(1, 0), p(1, 1)])), [false]);
    expect(dvd.entradas).toEqual([{ tramo: 1, claves: ["t1/0", "t1/1"], desdeSeg: null, hastaSeg: null, tieneAudio: false }]);
    const f = filtroComplejo(dvd);
    expect(f).not.toContain("[0:a:0]");
    expect(f).toContain("[v0][a0][vz][az]concat=n=2:v=1:a=1[vc][ac]");
    expect(f.split("loudnorm").length - 1).toBe(1);
  });
});
