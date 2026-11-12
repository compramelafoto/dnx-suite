import { describe, expect, it } from "vitest";
import { archivosParaComprobante, decidirAutoComprobante, nombresCoinciden, textoAvisoComprobante, type EntradaAutoComprobante, type PedidoEsperandoPago } from "./auto-decision";
import type { PagoMp, Veredicto } from "./veredicto";

const PEDIDO: PedidoEsperandoPago = {
  tipo: "IMPRESION", id: "p1", numero: "12", creadoEn: new Date("2026-11-10T18:00:00Z"), totalCents: 2_000_000, senaCents: 1_000_000,
};
const pago = (extra: Partial<PagoMp> = {}): PagoMp => ({ id: "555", monto: 10000, estado: "approved", fecha: "2026-11-10T18:30:00Z", pagador: null, ...extra });
const entrada = (veredicto: Veredicto, extra: Partial<EntradaAutoComprobante> = {}): EntradaAutoComprobante => ({
  veredicto, leido: { fecha: "2026-11-10T18:25:00Z", origen: null, monto: 10000 }, candidatos: [], pedidos: [PEDIDO], pagoYaUsado: false, autoConfirmar: true, ...extra,
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

describe("decidirAutoComprobante: PROBABLE más estricto para acreditar solo", () => {
  const probable = { estado: "PROBABLE" as const, pago: pago({ fecha: "2026-11-10T18:30:00Z", pagador: "María José Gómez" }) };

  it("el pago tiene que estar a 30 minutos o menos de la hora del comprobante", () => {
    expect(decidirAutoComprobante(entrada(probable, { leido: { fecha: "2026-11-10T18:00:00Z", origen: null, monto: 10000 } }))).toMatchObject({ accion: "ACREDITAR" });
    expect(decidirAutoComprobante(entrada(probable, { leido: { fecha: "2026-11-10T17:59:00Z", origen: null, monto: 10000 } }))).toMatchObject({
      accion: "A_PERSONA", motivo: "el pago está a más de 30 minutos de la hora del comprobante",
    });
  });

  it("sin hora legible en el comprobante, a una persona", () => {
    expect(decidirAutoComprobante(entrada(probable, { leido: { fecha: null, origen: null, monto: 10000 } }))).toMatchObject({ accion: "A_PERSONA", motivo: "el comprobante no tiene la hora legible" });
    expect(decidirAutoComprobante(entrada(probable, { leido: { fecha: "ayer a la tarde", origen: null, monto: 10000 } }))).toMatchObject({ accion: "A_PERSONA" });
  });

  it("el nombre del comprobante tiene que coincidir con el del pago (sin tildes ni mayúsculas); si falta uno, se acepta", () => {
    const con = (origen: string | null) => entrada(probable, { leido: { fecha: "2026-11-10T18:25:00Z", origen, monto: 10000 } });
    expect(decidirAutoComprobante(con("GOMEZ MARIA J"))).toMatchObject({ accion: "ACREDITAR" });
    expect(decidirAutoComprobante(con("Juan Pérez"))).toMatchObject({ accion: "A_PERSONA", motivo: "el nombre del comprobante no coincide con el del pago" });
    expect(decidirAutoComprobante(con(null))).toMatchObject({ accion: "ACREDITAR" });
    expect(decidirAutoComprobante(entrada({ estado: "PROBABLE", pago: pago({ pagador: null }) }, { leido: { fecha: "2026-11-10T18:25:00Z", origen: "Juan Pérez", monto: 10000 } }))).toMatchObject({ accion: "ACREDITAR" });
  });

  it("si hay más de un pago del mismo monto en la ventana, a una persona", () => {
    const otro = pago({ id: "556", fecha: "2026-11-10T18:40:00Z" });
    expect(decidirAutoComprobante(entrada(probable, { candidatos: [probable.pago, otro] }))).toMatchObject({ accion: "A_PERSONA", motivo: "hay varios pagos del mismo monto" });
    // Uno fuera de la ventana de 30 minutos, o no aprobado, no cuenta.
    const lejos = pago({ id: "557", fecha: "2026-11-10T20:00:00Z" });
    const rechazado = pago({ id: "558", estado: "rejected" });
    expect(decidirAutoComprobante(entrada(probable, { candidatos: [probable.pago, lejos, rechazado] }))).toMatchObject({ accion: "ACREDITAR" });
  });

  it("CONFIRMADO por número de operación no pide hora, nombre ni pago único", () => {
    const confirmado = { estado: "CONFIRMADO" as const, pago: pago({ pagador: "Otra Persona" }) };
    expect(decidirAutoComprobante(entrada(confirmado, { leido: { fecha: null, origen: "Juan Pérez", monto: 10000 }, candidatos: [pago({ id: "9" })] }))).toMatchObject({ accion: "ACREDITAR" });
  });

  it("nombresCoinciden: al menos una palabra de 4 letras en común", () => {
    expect(nombresCoinciden("Verónica Ruiz", "VERONICA A RUIZ")).toBe(true);
    expect(nombresCoinciden("Ana Paz", "Ana Paz")).toBe(true); // sin palabras de 4 letras: no se puede comparar
    expect(nombresCoinciden("Carlos Fernández", "Martina Gómez")).toBe(false);
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
