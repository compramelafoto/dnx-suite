import { describe, expect, it } from "vitest";
import { argumentosFfmpeg, armarPlan, filtroComplejo, type GrabacionParaPlan, type ParteR2 } from "./plan";

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
