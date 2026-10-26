import { describe, expect, it } from "vitest";
import { casoInicial, itemsDeCaso, olvidarCaso, stripCasoParam, textoDeCasoNoDisponible, DNXBOT_CASO_KEY, TEXTO_CASO_CERRADO, TEXTO_CASO_VENCIDO } from "./caso";

function almacen() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("casoInicial", () => {
  it("toma el token del link y lo guarda para que sobreviva al inicio de sesión", () => {
    const a = almacen();
    expect(casoInicial("?tab=incidencias&dnxbot_caso=abc_DEF-123", a)).toBe("abc_DEF-123");
    expect(a.m.get(DNXBOT_CASO_KEY)).toBe("abc_DEF-123");
    expect(casoInicial("", a)).toBe("abc_DEF-123");
    olvidarCaso(a);
    expect(casoInicial("", a)).toBeNull();
  });
  it("ignora tokens con caracteres raros y funciona sin almacenamiento", () => {
    expect(casoInicial("?dnxbot_caso=<script>", almacen())).toBeNull();
    expect(casoInicial("?dnxbot_caso=abc", null)).toBe("abc");
  });
});

describe("stripCasoParam", () => {
  it("saca el token de la barra de direcciones y deja lo demás", () => {
    expect(stripCasoParam("https://x.com/fotografo/soporte?tab=incidencias&dnxbot_caso=abc#h")).toBe("https://x.com/fotografo/soporte?tab=incidencias#h");
    expect(stripCasoParam("https://x.com/fotografo/soporte?dnxbot_caso=abc")).toBe("https://x.com/fotografo/soporte");
  });
});

describe("itemsDeCaso", () => {
  it("convierte la historia del caso en mensajes de la ventana; el equipo va firmado", () => {
    expect(
      itemsDeCaso([
        { rol: "usuario", texto: "No puedo pagar", autor: null, fecha: "1" },
        { rol: "bot", texto: "Paso el caso.", autor: null, fecha: "2" },
        { rol: "equipo", texto: "Revisamos tus pagos.", autor: "Daniel · equipo CompraMeLaFoto", fecha: "3" },
        { rol: "raro", texto: "x" },
        null,
      ]),
    ).toEqual([
      { kind: "user", text: "No puedo pagar" },
      { kind: "bot", text: "Paso el caso." },
      { kind: "equipo", text: "Revisamos tus pagos.", autor: "Daniel · equipo CompraMeLaFoto" },
    ]);
  });
});

describe("textoDeCasoNoDisponible", () => {
  it("distingue un reclamo cerrado de un link vencido", () => {
    expect(textoDeCasoNoDisponible({ error: "caso_cerrado" })).toBe(TEXTO_CASO_CERRADO);
    expect(textoDeCasoNoDisponible({ error: "caso_vencido" })).toBe(TEXTO_CASO_VENCIDO);
    expect(textoDeCasoNoDisponible(null)).toBe(TEXTO_CASO_VENCIDO);
    expect(TEXTO_CASO_CERRADO).toContain("cerrado");
  });
});
