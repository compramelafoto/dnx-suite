import { describe, expect, it } from "vitest";
import { archivosParaComprobante, decidirAutoComprobante, textoAvisoComprobante, type EntradaAutoComprobante, type PedidoEsperandoPago } from "./auto-decision";
import type { PagoMp, Veredicto } from "./veredicto";

const PEDIDO: PedidoEsperandoPago = {
  tipo: "IMPRESION", id: "p1", numero: "12", creadoEn: new Date("2026-11-10T18:00:00Z"), totalCents: 2_000_000, senaCents: 1_000_000,
};
const pago = (extra: Partial<PagoMp> = {}): PagoMp => ({ id: "555", monto: 10000, estado: "approved", fecha: "2026-11-10T18:30:00Z", pagador: null, ...extra });
const entrada = (veredicto: Veredicto, extra: Partial<EntradaAutoComprobante> = {}): EntradaAutoComprobante => ({
  veredicto, pedidos: [PEDIDO], pagoYaUsado: false, autoConfirmar: true, ...extra,
});

describe("decidirAutoComprobante", () => {
  it("confirmado por número de operación y por la seña: acredita", () => {
    expect(decidirAutoComprobante(entrada({ estado: "CONFIRMADO", pago: pago() }))).toMatchObject({ accion: "ACREDITAR", cubre: "SENA", pedido: { id: "p1" } });
  });

  it("probable (transferencia bancaria, por monto y hora) también acredita", () => {
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago() }))).toMatchObject({ accion: "ACREDITAR", cubre: "SENA" });
  });

  it("el monto puede ser el total, con menos de $1 de diferencia", () => {
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ monto: 20000.5 }) }))).toMatchObject({ accion: "ACREDITAR", cubre: "TOTAL" });
  });

  it("elige el pedido cuyo monto coincide", () => {
    const otro: PedidoEsperandoPago = { ...PEDIDO, tipo: "CATALOGO", id: "p2", totalCents: 500_000, senaCents: 250_000 };
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ monto: 5000 }) }, { pedidos: [PEDIDO, otro] }))).toMatchObject({
      accion: "ACREDITAR", cubre: "TOTAL", pedido: { id: "p2" },
    });
  });

  it("un monto que no es la seña ni el total pasa a una persona", () => {
    expect(decidirAutoComprobante(entrada({ estado: "CONFIRMADO", pago: pago({ monto: 9998 }) }))).toMatchObject({ accion: "A_PERSONA", motivo: expect.stringContaining("monto") });
  });

  it("un pago anterior a la creación del pedido (más de 10 minutos) pasa a una persona", () => {
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ fecha: "2026-11-10T17:45:00Z" }) }))).toMatchObject({ accion: "A_PERSONA", motivo: "el pago es anterior al pedido" });
    // Dentro del margen, vale.
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ fecha: "2026-11-10T17:55:00Z" }) }))).toMatchObject({ accion: "ACREDITAR" });
  });

  it("un pago ya usado para otro pedido pasa a una persona", () => {
    expect(decidirAutoComprobante(entrada({ estado: "CONFIRMADO", pago: pago() }, { pagoYaUsado: true }))).toMatchObject({ accion: "A_PERSONA", motivo: expect.stringContaining("ya se usó") });
  });

  it("con la confirmación automática apagada, verifica pero no acredita", () => {
    expect(decidirAutoComprobante(entrada({ estado: "CONFIRMADO", pago: pago() }, { autoConfirmar: false }))).toMatchObject({ accion: "A_PERSONA", motivo: expect.stringContaining("apagada") });
  });

  it("si no es un comprobante, el bot sigue como siempre", () => {
    expect(decidirAutoComprobante(entrada({ estado: "NO_ES_COMPROBANTE" }))).toEqual({ accion: "SEGUIR" });
  });

  it("no encontrado, pendiente, monto distinto o sin datos: a una persona", () => {
    for (const v of [{ estado: "NO_ENCONTRADO" }, { estado: "SIN_DATOS" }, { estado: "PENDIENTE", pago: pago({ estado: "in_process" }) }, { estado: "MONTO_DISTINTO", pago: pago() }] as Veredicto[]) {
      expect(decidirAutoComprobante(entrada(v)).accion).toBe("A_PERSONA");
    }
  });

  it("un pago no aprobado, aunque el veredicto diga probable, no se acredita", () => {
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ estado: "pending" }) }))).toMatchObject({ accion: "A_PERSONA" });
  });

  it("sin la fecha del pago no se puede comprobar: a una persona", () => {
    expect(decidirAutoComprobante(entrada({ estado: "CONFIRMADO", pago: pago({ fecha: null }) }))).toMatchObject({ accion: "A_PERSONA" });
  });
});

describe("archivosParaComprobante", () => {
  const archivo = (id: string, tipo: string, mimeType: string, direccion = "ENTRANTE") => ({ id, direccion, tipo, media: { id: `meta-${id}`, mimeType, descarga: "LISTO", clave: `k/${id}` } });

  it("toma las imágenes y los PDF ya bajados de la última tanda del cliente, del más nuevo al más viejo", () => {
    const mensajes = [
      archivo("m4", "DOCUMENTO", "application/pdf"),
      { id: "s1", direccion: "SISTEMA", tipo: "TEXTO", media: null },
      { id: "m3", direccion: "ENTRANTE", tipo: "TEXTO", media: null },
      archivo("m2", "IMAGEN", "image/jpeg"),
      archivo("x", "DOCUMENTO", "application/msword"),
      { id: "b1", direccion: "SALIENTE", tipo: "TEXTO", media: null },
      archivo("viejo", "IMAGEN", "image/jpeg"),
    ];
    expect(archivosParaComprobante(mensajes)).toEqual(["m4", "m2"]);
  });

  it("no toma lo que todavía se está bajando ni más de 3", () => {
    const bajando = { id: "p", direccion: "ENTRANTE", tipo: "IMAGEN", media: { id: "meta", mimeType: "image/jpeg" } };
    expect(archivosParaComprobante([bajando])).toEqual([]);
    expect(archivosParaComprobante(["a", "b", "c", "d"].map((id) => archivo(id, "IMAGEN", "image/png")))).toEqual(["a", "b", "c"]);
  });
});

describe("textoAvisoComprobante", () => {
  it("escapa lo que viene del cliente", () => {
    const t = textoAvisoComprobante({ nombre: "<Ana>", waId: "549", pedido: "12", motivo: "el pago es anterior al pedido", veredicto: "No encontré" });
    expect(t).toContain("&lt;Ana&gt;");
    expect(t).toContain("Pedido: 12");
  });
});
