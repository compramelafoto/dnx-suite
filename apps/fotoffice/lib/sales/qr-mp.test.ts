import { describe, expect, it } from "vitest";
import { cuerpoOrden, idsExternos, leerOrden, montoMp, validarSucursal } from "./qr-mp";

describe("qr-mp", () => {
  it("montos con dos decimales", () => {
    expect(montoMp(1234550)).toBe("12345.50");
    expect(montoMp(100)).toBe("1.00");
  });

  it("ids externos alfanuméricos y cortos", () => {
    const ids = idsExternos("cmv5z6qxwwmmhf0q5gp8qja1j");
    expect(ids.caja).toMatch(/^[A-Za-z0-9]{1,40}$/);
    expect(ids.sucursal).toMatch(/^[A-Za-z0-9]{1,60}$/);
    expect(ids.caja).not.toBe(ids.sucursal);
  });

  it("la order del QR estático", () => {
    const b = cuerpoOrden({ montoMinor: 700000, externalPosId: "FOPx", referencia: "mos-1", descripcion: "Venta" });
    expect(b).toMatchObject({ type: "qr", total_amount: "7000.00", config: { qr: { external_pos_id: "FOPx", mode: "static" } } });
    expect(b.transactions.payments[0]!.amount).toBe("7000.00");
  });

  it("valida que la ubicación sea de Argentina", () => {
    const ok = { nombre: "DNX", calle: "San José", numero: "1672", ciudad: "Funes", provincia: "Santa Fe", latitud: -32.92, longitud: -60.81, referencia: null };
    expect(validarSucursal(ok)).toBeNull();
    expect(validarSucursal({ ...ok, latitud: 40 })).toMatch(/latitud/);
  });

  describe("leerOrden", () => {
    const base = { id: "ORD1", total_amount: "7000.00", external_reference: "mos-1" };
    it("esperando", () => {
      expect(leerOrden({ ...base, status: "created", transactions: { payments: [{ status: "created" }] } })?.estado).toBe("ESPERANDO");
    });
    it("pagada", () => {
      const o = leerOrden({ ...base, status: "processed", status_detail: "accredited", transactions: { payments: [{ status: "processed", status_detail: "accredited", payment_method: { type: "account_money" } }] } });
      expect(o).toMatchObject({ estado: "PAGADO", montoMinor: 700000, medio: "account_money" });
    });
    it("vencida, cancelada y devuelta", () => {
      expect(leerOrden({ ...base, status: "expired" })?.estado).toBe("VENCIDO");
      expect(leerOrden({ ...base, status: "canceled" })?.estado).toBe("CANCELADO");
      expect(leerOrden({ ...base, status: "refunded" })?.estado).toBe("DEVUELTO");
    });
    it("basura", () => {
      expect(leerOrden(null)).toBeNull();
      expect(leerOrden({})).toBeNull();
    });
  });
});
