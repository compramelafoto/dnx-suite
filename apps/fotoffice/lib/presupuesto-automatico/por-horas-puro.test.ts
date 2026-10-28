import { describe, expect, it } from "vitest";
import {
  AJUSTES_POR_HORAS_POR_OMISION as OMISION,
  horasValidas,
  kmDeDistancia,
  llevaSegundoFotografo,
  normalizarAjustesPorHoras,
  precioSegundoFotografo,
  recetaPorHoras,
} from "./por-horas-puro";

describe("presupuesto por horas: receta", () => {
  it("3 h de evento a 10 km: 3 de cobertura, 6 de edición, traslado $30.000 y promete el mínimo", () => {
    const r = recetaPorHoras({ horas: 3, esSesion: false, km: 10, enElEstudio: false, ajustes: OMISION });
    expect(r).toMatchObject({ coberturaHoras: 3, edicionHoras: 6, disparos: 1725, trasladoPesos: 30000, minimoFotos: 400 });
    expect(r.nombre).toBe("Cobertura fotográfica de 3 horas");
    expect(r.descripcion).toContain("mínimo de 400 fotos");
    expect(r.descripcion).not.toContain("1725");
    expect(r.descripcion).toContain("impresiones y fotolibro");
  });

  it("sesión en el estudio: mínimo 70 fotos y sin traslado; sin ubicar fuera del estudio: traslado desconocido", () => {
    const enEstudio = recetaPorHoras({ horas: 1, esSesion: true, km: null, enElEstudio: true, ajustes: OMISION });
    expect(enEstudio).toMatchObject({ minimoFotos: 70, trasladoPesos: 0, nombre: "Sesión de fotos de 1 hora" });
    expect(recetaPorHoras({ horas: 1, esSesion: true, km: null, enElEstudio: false, ajustes: OMISION }).trasladoPesos).toBeNull();
  });
});

describe("distancia", () => {
  it("línea recta × 1,3; lejos o sin datos → null", () => {
    const origen = { lat: -32.917, lon: -60.81 };
    const destino = { lat: -32.917, lon: -60.7275 }; // ≈ 7,7 km al este
    expect(kmDeDistancia(origen, destino, 200)).toBeCloseTo(10, 0);
    expect(kmDeDistancia(origen, { lat: -34.6, lon: -58.4 }, 200)).toBeNull();
    expect(kmDeDistancia(null, destino, 200)).toBeNull();
  });
});

describe("horas", () => {
  it("acepta de 0,5 a 24 y redondea a media hora", () => {
    expect(horasValidas("3,5")).toBe(3.5);
    expect(horasValidas(4)).toBe(4);
    expect(horasValidas(3.3)).toBe(3.5);
    expect(horasValidas(0)).toBeNull();
    expect(horasValidas(30)).toBeNull();
    expect(horasValidas("tres")).toBeNull();
  });
});

describe("segundo fotógrafo", () => {
  it("30 % de la hora por cada hora de cobertura", () => {
    expect(precioSegundoFotografo(50000, 3, 30)).toBe(45000);
    expect(precioSegundoFotografo(null, 3, 30)).toBeNull();
  });

  it("siempre en bodas, con más de 200 invitados en eventos, nunca en sesiones", () => {
    const b = { umbral: 200 };
    expect(llevaSegundoFotografo({ ...b, grupo: "BODA", esSesion: false, invitados: null })).toBe(true);
    expect(llevaSegundoFotografo({ ...b, grupo: "EVENTO", esSesion: false, invitados: 250 })).toBe(true);
    expect(llevaSegundoFotografo({ ...b, grupo: "EVENTO", esSesion: false, invitados: 200 })).toBe(false);
    expect(llevaSegundoFotografo({ ...b, grupo: "TRABAJO_SIN_FECHA", esSesion: true, invitados: 500 })).toBe(false);
  });
});

describe("ajustes", () => {
  it("completa con la omisión y descarta valores inválidos", () => {
    expect(normalizarAjustesPorHoras(null)).toEqual(OMISION);
    expect(normalizarAjustesPorHoras({ pesosPorKm: "x", encendido: true })).toMatchObject({ pesosPorKm: 3000, encendido: true });
    expect(OMISION).toMatchObject({ encendido: false, edicionPorHora: 2, minimoFotosEvento: 400, minimoFotosSesion: 70, segundoFotografoPct: 30, invitadosSegundoFotografo: 200 });
    expect(OMISION.partida.direccion).toContain("García del Cossio 2050");
  });
});
