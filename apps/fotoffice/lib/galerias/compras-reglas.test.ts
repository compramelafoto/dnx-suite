import { describe, expect, it } from "vitest";
import { esEstadoCompra, fotosDescargables, puedeDescargarOriginal, puedeTransicionarCompra, validarTransicionCompra } from "./compras-reglas";

describe("transiciones de la compra", () => {
  it("PENDIENTE pasa a PAGADA o CANCELADA", () => {
    expect(puedeTransicionarCompra("PENDIENTE", "PAGADA")).toBe(true);
    expect(puedeTransicionarCompra("PENDIENTE", "CANCELADA")).toBe(true);
  });
  it("PAGADA y CANCELADA son finales", () => {
    for (const d of ["PAGADA", "CANCELADA"] as const) for (const h of ["PENDIENTE", "PAGADA", "CANCELADA"] as const) expect(puedeTransicionarCompra(d, h)).toBe(false);
    expect(validarTransicionCompra("PAGADA", "CANCELADA")).toEqual({ ok: false, error: "La compra ya está pagada." });
    expect(validarTransicionCompra("CANCELADA", "PAGADA").ok).toBe(false);
    expect(validarTransicionCompra("PENDIENTE", "PAGADA")).toEqual({ ok: true });
    expect(validarTransicionCompra("PENDIENTE", "PENDIENTE").ok).toBe(false);
  });
  it("reconoce estados", () => {
    expect(esEstadoCompra("PAGADA")).toBe(true);
    expect(esEstadoCompra("X")).toBe(false);
  });
});

describe("fotosDescargables", () => {
  const args = { incluidas: ["a", "b"], pagadas: ["c", "a"] };
  it("sólo con SELECCIONADAS", () => {
    for (const m of ["NINGUNA", "VISTA"] as const) expect(fotosDescargables({ ...args, downloadMode: m, estadoCliente: "FINALIZADO" })).toEqual([]);
  });
  it("antes de enviar: sólo las pagadas", () => {
    expect(fotosDescargables({ ...args, downloadMode: "SELECCIONADAS", estadoCliente: "EN_PROGRESO" })).toEqual(["c", "a"]);
  });
  it("enviada: pagadas más incluidas, sin repetir", () => {
    for (const e of ["EN_REVISION", "FINALIZADO"] as const)
      expect(fotosDescargables({ ...args, downloadMode: "SELECCIONADAS", estadoCliente: e }).sort()).toEqual(["a", "b", "c"]);
  });
  it("puedeDescargarOriginal", () => {
    expect(puedeDescargarOriginal({ ...args, downloadMode: "SELECCIONADAS", estadoCliente: "EN_PROGRESO", fotoId: "b" })).toBe(false);
    expect(puedeDescargarOriginal({ ...args, downloadMode: "SELECCIONADAS", estadoCliente: "EN_REVISION", fotoId: "b" })).toBe(true);
  });
});
