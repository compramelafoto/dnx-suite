import { describe, expect, it } from "vitest";
import { MAX_FOTOS_POR_GALERIA, TAMANO_MAXIMO_ORIGINAL } from "./constantes";
import { SUBIDAS_EN_PARALELO, clasificarArchivos, crearCola, pesoLegible, resumirSubidas, revisarFotoParaSubir, tipoDeFoto } from "./subida";

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("tipo y revisión de cada foto", () => {
  it("acepta JPG y PNG por tipo, y por extensión cuando el navegador no informa el tipo", () => {
    expect(tipoDeFoto("a.jpg", "image/jpeg")).toBe("image/jpeg");
    expect(tipoDeFoto("a.JPEG", "")).toBe("image/jpeg");
    expect(tipoDeFoto("a.png", "image/png")).toBe("image/png");
    expect(tipoDeFoto("a.PNG", "")).toBe("image/png");
    expect(tipoDeFoto("a.webp", "image/webp")).toBeNull();
    expect(tipoDeFoto("a.gif", "")).toBeNull();
    // Un tipo informado que no es de foto gana sobre la extensión.
    expect(tipoDeFoto("a.jpg", "application/pdf")).toBeNull();
  });
  it("rechaza lo que el servidor rechazaría: tipo, vacío y más de 50 MB (50 MB justos pasan)", () => {
    expect(revisarFotoParaSubir(f("a.jpg", "image/jpeg"))).toBeNull();
    expect(revisarFotoParaSubir(f("a.jpg", "image/jpeg", TAMANO_MAXIMO_ORIGINAL))).toBeNull();
    expect(revisarFotoParaSubir(f("a.jpg", "image/jpeg", TAMANO_MAXIMO_ORIGINAL + 1))).toMatch(/50 MB/);
    expect(revisarFotoParaSubir(f("a.jpg", "image/jpeg", 0))).toMatch(/vacío/);
    expect(revisarFotoParaSubir(f("a.heic", "image/heic"))).toMatch(/JPG o PNG/);
  });
});

describe("clasificarArchivos", () => {
  it("separa aceptados y rechazados y recorta a los lugares libres", () => {
    const r = clasificarArchivos([f("1.jpg", "image/jpeg"), f("2.gif", "image/gif"), f("3.png", "image/png"), f("4.jpg", "image/jpeg")], 2);
    expect(r.aceptados.map((a) => a.name)).toEqual(["1.jpg", "3.png"]);
    expect(r.rechazados.map((a) => a.archivo.name)).toEqual(["2.gif"]);
    expect(r.sobrantes).toBe(1);
  });
  it("sin lugares no acepta nada y nunca pasa del tope de la galería", () => {
    expect(clasificarArchivos([f("1.jpg", "image/jpeg")], 0)).toMatchObject({ aceptados: [], sobrantes: 1 });
    const muchos = Array.from({ length: MAX_FOTOS_POR_GALERIA + 5 }, (_, i) => f(`${i}.jpg`, "image/jpeg"));
    const r = clasificarArchivos(muchos, 999_999);
    expect(r.aceptados).toHaveLength(MAX_FOTOS_POR_GALERIA);
    expect(r.sobrantes).toBe(5);
  });
});

describe("cola de subidas", () => {
  it("nunca corre más de 4 a la vez, las procesa todas y deja seguir agregando", async () => {
    expect(SUBIDAS_EN_PARALELO).toBe(4);
    let activos = 0;
    let maximo = 0;
    const hechos: number[] = [];
    const cola = crearCola<number>(SUBIDAS_EN_PARALELO, async (n) => {
      activos++;
      maximo = Math.max(maximo, activos);
      await new Promise((r) => setTimeout(r, 2));
      activos--;
      hechos.push(n);
    });
    cola.agregar(Array.from({ length: 30 }, (_, i) => i));
    expect(cola.activos()).toBe(4);
    cola.agregar([100, 101]);
    while (cola.activos() > 0 || cola.pendientes() > 0) await new Promise((r) => setTimeout(r, 2));
    expect(maximo).toBe(4);
    expect(hechos).toHaveLength(32);
    expect(new Set(hechos).size).toBe(32);
  });
  it("un trabajo que falla no frena a los demás", async () => {
    const hechos: number[] = [];
    const cola = crearCola<number>(2, async (n) => {
      if (n === 1) throw new Error("falló");
      hechos.push(n);
    });
    cola.agregar([0, 1, 2, 3]);
    while (cola.activos() > 0 || cola.pendientes() > 0) await new Promise((r) => setTimeout(r, 2));
    expect(hechos.sort()).toEqual([0, 2, 3]);
  });
  it("descartar saca de la espera lo que no empezó", async () => {
    const hechos: number[] = [];
    const cola = crearCola<number>(1, async (n) => {
      await new Promise((r) => setTimeout(r, 2));
      hechos.push(n);
    });
    cola.agregar([1, 2, 3, 4]);
    cola.descartar((n) => n >= 3);
    while (cola.activos() > 0 || cola.pendientes() > 0) await new Promise((r) => setTimeout(r, 2));
    expect(hechos).toEqual([1, 2]);
  });
});

describe("resumen", () => {
  it("cuenta por estado y marca cuándo terminó todo", () => {
    expect(resumirSubidas(["LISTA", "ERROR", "SUBIENDO", "ESPERA", "PROCESANDO"])).toEqual({ total: 5, listas: 1, conError: 1, enCurso: 2, enEspera: 1, terminado: false });
    expect(resumirSubidas(["LISTA", "ERROR"]).terminado).toBe(true);
    expect(resumirSubidas([]).terminado).toBe(true);
  });
  it("pesoLegible usa coma decimal", () => {
    expect(pesoLegible(3.2 * 1024 * 1024)).toBe("3,2 MB");
    expect(pesoLegible(850 * 1024)).toBe("850 KB");
    expect(pesoLegible(10)).toBe("1 KB");
  });
});
