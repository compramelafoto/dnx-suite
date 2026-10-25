import { describe, expect, it } from "vitest";
import { paginas, pendientes, registrosDeRespuesta } from "./impresion-multiple";

const H = [
  { hojaId: "a", version: "v1", copias: 2 },
  { hojaId: "b", version: "v2", copias: 1 },
];

describe("imprimir varias hojas", () => {
  it("cada hoja se repite tantas veces como copias, en orden", () => {
    expect(paginas(H)).toEqual([
      { hojaId: "a", version: "v1", copia: 1 },
      { hojaId: "a", version: "v1", copia: 2 },
      { hojaId: "b", version: "v2", copia: 1 },
    ]);
  });

  it("pendientes: descuenta lo que ya salió bien y saca lo que salió entero", () => {
    expect(pendientes(H, new Map([["a", 1]]))).toEqual([{ hojaId: "a", version: "v1", copias: 1 }, H[1]]);
    expect(pendientes(H, new Map([["a", 2], ["b", 5]]))).toEqual([]);
  });

  it("todas bien: un registro NORMAL por hoja, nada que reimprimir", () => {
    expect(registrosDeRespuesta(H, {})).toEqual({
      registros: [{ hojaId: "a", motivo: "NORMAL", hojas: 2 }, { hojaId: "b", motivo: "NORMAL", hojas: 1 }],
      reimprimir: [],
    });
  });

  it("una copia mal: esa va DESCARTADA y se reimprime sólo esa", () => {
    expect(registrosDeRespuesta(H, { a: 1 })).toEqual({
      registros: [
        { hojaId: "a", motivo: "NORMAL", hojas: 1 },
        { hojaId: "a", motivo: "DESCARTADA", hojas: 1 },
        { hojaId: "b", motivo: "NORMAL", hojas: 1 },
      ],
      reimprimir: [{ hojaId: "a", version: "v1", copias: 1 }],
    });
  });

  it("las malas se acotan a las copias de la hoja", () => {
    expect(registrosDeRespuesta(H, { a: 9, b: -3 }).registros).toEqual([
      { hojaId: "a", motivo: "DESCARTADA", hojas: 2 },
      { hojaId: "b", motivo: "NORMAL", hojas: 1 },
    ]);
  });
});
