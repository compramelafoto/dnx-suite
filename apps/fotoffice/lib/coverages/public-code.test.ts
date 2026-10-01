import { describe, expect, it } from "vitest";
import { buildPublicCode, nextPublicCode, parsePublicCode } from "./public-code";

/**
 * El número que se dice por teléfono.
 *
 * `SC-2026-0042` es legible y se dicta sin deletrear. Lo importante es lo que NO es: no abre
 * nada. Quien tenga el 42 no puede probar el 43 para ver el pedido de otra organización,
 * porque lo que abre la ventana de seguimiento es el token, no el código.
 */
describe("buildPublicCode", () => {
  it("arma el código con el año y cuatro dígitos", () => {
    expect(buildPublicCode({ year: 2026, sequence: 42 })).toBe("SC-2026-0042");
  });

  it("el primero del año es el 1", () => {
    expect(buildPublicCode({ year: 2026, sequence: 1 })).toBe("SC-2026-0001");
  });

  it("no se rompe cuando se pasan los cuatro dígitos", () => {
    // Una organización con más de 9999 pedidos en un año es improbable, pero truncar el
    // número sería peor que un código más largo.
    expect(buildPublicCode({ year: 2026, sequence: 12345 })).toBe("SC-2026-12345");
  });
});

describe("nextPublicCode", () => {
  it("sin ninguno previo, empieza en 1", () => {
    expect(nextPublicCode(null, 2026)).toBe("SC-2026-0001");
  });

  it("sigue la numeración del mismo año", () => {
    expect(nextPublicCode("SC-2026-0041", 2026)).toBe("SC-2026-0042");
  });

  it("cada año arranca de nuevo", () => {
    // Que el primer pedido de 2027 sea el 0001 hace que el código diga algo de un vistazo.
    expect(nextPublicCode("SC-2026-0187", 2027)).toBe("SC-2027-0001");
  });

  it("un código ilegible no frena un alta: se empieza de nuevo ese año", () => {
    expect(nextPublicCode("basura", 2026)).toBe("SC-2026-0001");
    expect(nextPublicCode("", 2026)).toBe("SC-2026-0001");
  });
});

describe("parsePublicCode", () => {
  it("lee año y número", () => {
    expect(parsePublicCode("SC-2026-0042")).toEqual({ year: 2026, sequence: 42 });
  });

  it("acepta minúsculas y espacios: la gente lo copia de un mail", () => {
    expect(parsePublicCode("  sc-2026-0042 ")).toEqual({ year: 2026, sequence: 42 });
  });

  it("descarta lo que no tiene la forma", () => {
    expect(parsePublicCode("SC-2026")).toBe(null);
    expect(parsePublicCode("XX-2026-0042")).toBe(null);
    expect(parsePublicCode("SC-20AB-0042")).toBe(null);
  });
});
