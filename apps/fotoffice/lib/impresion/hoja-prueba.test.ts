import { describe, expect, it } from "vitest";
import { COLORES_PRUEBA, decisionAlMontar, GRISES, colorDeGris, marcasDeRegla, nombreDescarga, origenCentrado } from "./hoja-prueba";

describe("hoja de prueba", () => {
  it("la regla tiene 101 marcas y 11 numeradas de 0 a 100", () => {
    const m = marcasDeRegla();
    expect(m).toHaveLength(101);
    const num = m.filter((x) => x.numero !== null);
    expect(num.map((x) => x.numero)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(num.every((x) => x.largo === 4)).toBe(true);
    expect(m.filter((x) => x.numero === null).every((x) => x.largo === 1.5)).toBe(true);
  });
  it("11 grises y 6 colores", () => {
    expect(GRISES).toHaveLength(11);
    expect(colorDeGris(0)).toBe("rgb(0,0,0)");
    expect(colorDeGris(100)).toBe("rgb(255,255,255)");
    expect(COLORES_PRUEBA).toHaveLength(6);
  });
  it("centra la regla", () => {
    expect(origenCentrado(102)).toBe(1);
    expect(origenCentrado(152)).toBe(26);
  });
  it("limpia el nombre de descarga", () => {
    expect(nombreDescarga("Kodak 305", "10x15", "abc123")).toBe("Kodak_305_10x15_abc123.jpg");
    expect(nombreDescarga("Épson/L800", "A4", "x")).toBe("_pson_L800_A4_x.jpg");
    expect(nombreDescarga('a"b\r\nc', "t", "h")).toBe("a_b__c_t_h.jpg");
  });
  it("decide qué hacer al montar según el estado de la imagen", () => {
    expect(decisionAlMontar(true, 1600, "cargando")).toBe("imprimir");
    expect(decisionAlMontar(true, 0, "cargando")).toBe("error");
    expect(decisionAlMontar(false, 0, "cargando")).toBe("esperar");
    expect(decisionAlMontar(true, 1600, "imprimiendo")).toBe("esperar");
  });
});
