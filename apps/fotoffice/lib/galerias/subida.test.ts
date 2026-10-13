import { describe, expect, it } from "vitest";
import { MAX_FOTOS_POR_GALERIA, MAX_VIDEOS_POR_GALERIA, TAMANO_MAXIMO_ORIGINAL, TAMANO_MAXIMO_VIDEO } from "./constantes";
import { SUBIDAS_EN_PARALELO, clasificarArchivos, crearCola, pesoLegible, resumirSubidas, revisarArchivoParaSubir, revisarFotoParaSubir, tipoDeArchivo, tipoDeFoto, tipoDeVideo } from "./subida";

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

describe("videos en una galería de entrega", () => {
  it("MP4 y MOV por tipo o por extensión; nada más", () => {
    expect(tipoDeVideo("a.mp4", "video/mp4")).toBe("video/mp4");
    expect(tipoDeVideo("a.MOV", "")).toBe("video/quicktime");
    expect(tipoDeVideo("a.mov", "video/quicktime")).toBe("video/quicktime");
    expect(tipoDeVideo("a.avi", "video/x-msvideo")).toBeNull();
    expect(tipoDeVideo("a.mp4", "application/pdf")).toBeNull();
    expect(tipoDeVideo("a.mkv", "")).toBeNull();
  });
  it("una galería de selección no admite videos; una de entrega sí", () => {
    expect(tipoDeArchivo("a.mp4", "video/mp4", false)).toBeNull();
    expect(tipoDeArchivo("a.mp4", "video/mp4", true)).toBe("video/mp4");
    expect(tipoDeArchivo("a.jpg", "image/jpeg", true)).toBe("image/jpeg");
  });
  it("tope de 5 GB para un video (justos pasan) y 50 MB para una foto", () => {
    expect(revisarArchivoParaSubir(f("a.mp4", "video/mp4", TAMANO_MAXIMO_VIDEO), true)).toBeNull();
    expect(revisarArchivoParaSubir(f("a.mp4", "video/mp4", TAMANO_MAXIMO_VIDEO + 1), true)).toMatch(/5 GB/);
    expect(revisarArchivoParaSubir(f("a.mp4", "video/mp4", 0), true)).toMatch(/vacío/);
    expect(revisarArchivoParaSubir(f("a.jpg", "image/jpeg", TAMANO_MAXIMO_ORIGINAL + 1), true)).toMatch(/50 MB/);
    expect(revisarArchivoParaSubir(f("a.avi", "video/x-msvideo"), true)).toMatch(/MP4 o MOV/);
    expect(revisarArchivoParaSubir(f("a.mp4", "video/mp4"), false)).toMatch(/JPG o PNG/);
  });
  it("clasificarArchivos mezcla fotos y videos y respeta el tope de videos", () => {
    const r = clasificarArchivos([f("1.jpg", "image/jpeg"), f("2.mp4", "video/mp4"), f("3.mov", "video/quicktime"), f("4.avi", "video/x-msvideo")], 10, { admiteVideos: true, videosLibres: 1 });
    expect(r.aceptados.map((a) => a.name)).toEqual(["1.jpg", "2.mp4"]);
    expect(r.rechazados.map((a) => a.archivo.name)).toEqual(["3.mov", "4.avi"]);
    expect(r.rechazados[0].motivo).toMatch(/200 videos/);
    expect(MAX_VIDEOS_POR_GALERIA).toBe(200);
  });
  it("sin admiteVideos un video se rechaza como antes", () => {
    const r = clasificarArchivos([f("2.mp4", "video/mp4")], 10);
    expect(r.aceptados).toEqual([]);
    expect(r.rechazados).toHaveLength(1);
  });
  it("pesoLegible llega a GB", () => {
    expect(pesoLegible(1.5 * 1024 * 1024 * 1024)).toMatch(/1,5 GB/);
  });
});
