import { describe, expect, it } from "vitest";
import { decidir, textoDelVeredicto, type Leido, type PagoMp } from "./veredicto";

const LEIDO: Leido = { esComprobante: true, operacion: "187817727381", monto: 10000, fecha: "2026-11-10T19:15:00Z", origen: "Veronica Hilda Altamirano", destinatario: "Daniel Cuart" };
const PAGO: PagoMp = { id: "187817727381", monto: 10000, estado: "approved", fecha: "2026-11-10T19:15:10Z", pagador: "Veronica" };

describe("decidir", () => {
  it("el pago de la operación está acreditado y el monto coincide: confirmado", () => {
    expect(decidir(LEIDO, PAGO, [])).toEqual({ estado: "CONFIRMADO", pago: PAGO });
  });

  it("la operación existe pero no está aprobada, o el monto no coincide", () => {
    expect(decidir(LEIDO, { ...PAGO, estado: "pending" }, [])).toEqual({ estado: "PENDIENTE", pago: { ...PAGO, estado: "pending" } });
    expect(decidir(LEIDO, { ...PAGO, monto: 1000 }, [])).toEqual({ estado: "MONTO_DISTINTO", pago: { ...PAGO, monto: 1000 } });
  });

  it("sin la operación, un pago aprobado del mismo monto cerca de esa hora es probable; si no hay ninguno, no se encontró", () => {
    const otro = { ...PAGO, id: "999" };
    expect(decidir(LEIDO, null, [otro])).toEqual({ estado: "PROBABLE", pago: otro });
    expect(decidir(LEIDO, null, [{ ...otro, monto: 9000 }])).toEqual({ estado: "NO_ENCONTRADO" });
    expect(decidir(LEIDO, null, [{ ...otro, fecha: "2026-11-08T10:00:00Z" }])).toEqual({ estado: "NO_ENCONTRADO" });
  });

  it("una imagen que no es un comprobante, o sin monto legible, no se busca", () => {
    expect(decidir({ ...LEIDO, esComprobante: false }, null, [])).toEqual({ estado: "NO_ES_COMPROBANTE" });
    expect(decidir({ ...LEIDO, monto: null }, null, [])).toEqual({ estado: "SIN_DATOS" });
  });
});

describe("textoDelVeredicto", () => {
  it("dice en criollo qué pasó, con el monto y la operación", () => {
    expect(textoDelVeredicto({ estado: "CONFIRMADO", pago: PAGO }, LEIDO)).toMatch(/Pago confirmado.*\$\s?10\.000.*187817727381/s);
    expect(textoDelVeredicto({ estado: "NO_ENCONTRADO" }, LEIDO)).toContain("No encontré");
  });
});
