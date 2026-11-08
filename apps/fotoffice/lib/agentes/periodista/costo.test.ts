import { describe, expect, it } from "vitest";
import { conCosto, costoUsd, juntarUsos, sumarUso, textoUsd, usoVacio } from "./costo";

describe("sumarUso", () => {
  it("suma entrada, salida, caché y búsquedas de cada respuesta", () => {
    const uso = usoVacio();
    sumarUso(uso, { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 3000, server_tool_use: { web_search_requests: 2 } });
    sumarUso(uso, { input_tokens: 500, output_tokens: 300, cache_read_input_tokens: 3000, server_tool_use: null });
    sumarUso(uso, undefined);
    expect(uso).toEqual({ entrada: 1500, salida: 500, busquedas: 2, cacheEscritura: 3000, cacheLectura: 3000 });
  });

  it("ignora valores raros (negativos, texto, NaN)", () => {
    const uso = usoVacio();
    sumarUso(uso, { input_tokens: -5, output_tokens: "10", server_tool_use: { web_search_requests: Number.NaN } });
    expect(uso).toEqual(usoVacio());
  });
});

describe("costoUsd", () => {
  it("USD 2 por millón de entrada, 10 por millón de salida y 0,01 por búsqueda", () => {
    expect(costoUsd({ entrada: 1_000_000, salida: 0, busquedas: 0 })).toBe(2);
    expect(costoUsd({ entrada: 0, salida: 1_000_000, busquedas: 0 })).toBe(10);
    expect(costoUsd({ entrada: 0, salida: 0, busquedas: 5 })).toBe(0.05);
    // Una corrida típica: 60k de entrada, 4k de salida y 5 búsquedas = 0,12 + 0,04 + 0,05.
    expect(costoUsd({ entrada: 60_000, salida: 4_000, busquedas: 5 })).toBe(0.21);
  });

  it("el caché se cobra 1,25× al escribir y 0,1× al leer", () => {
    expect(costoUsd({ entrada: 0, salida: 0, busquedas: 0, cacheEscritura: 1_000_000 })).toBe(2.5);
    expect(costoUsd({ entrada: 0, salida: 0, busquedas: 0, cacheLectura: 1_000_000 })).toBe(0.2);
  });

  it("sin uso (propuestas viejas) cuesta 0", () => {
    expect(costoUsd(undefined)).toBe(0);
    expect(costoUsd(null)).toBe(0);
  });
});

describe("juntarUsos", () => {
  it("junta la corrida, la reescritura por copia y las correcciones, con el costo total", () => {
    const corrida = conCosto({ entrada: 60_000, salida: 4_000, busquedas: 5 });
    const copia = conCosto({ entrada: 5_000, salida: 2_000, busquedas: 0, cacheLectura: 1_000 });
    const total = juntarUsos(corrida, null, copia, undefined);
    expect(total).toEqual({ entrada: 65_000, salida: 6_000, busquedas: 5, cacheEscritura: 0, cacheLectura: 1_000, costoUsd: 0.2402 });
  });
});

describe("textoUsd", () => {
  it("con coma decimal; montos chiquitos con 4 decimales", () => {
    expect(textoUsd(0.21)).toBe("USD 0,21");
    expect(textoUsd(1.5)).toBe("USD 1,50");
    expect(textoUsd(0.0021)).toBe("USD 0,0021");
    expect(textoUsd(0)).toBe("USD 0,00");
  });
});
