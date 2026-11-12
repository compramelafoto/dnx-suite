import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { recordarPagosPendientes } = await import("./recordatorio-pago-servidor");
type Deps = NonNullable<Parameters<typeof recordarPagosPendientes>[0]>;

const AHORA = new Date("2026-10-29T15:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);
const CHAT = { id: "chat1", workspaceId: "w1", nombre: "Daniel", estado: "BOT" as const, asignadoUserId: null as number | null, botPausadoHasta: null, ultimoEntranteEn: hace(21) };
const PEDIDO = { tipo: "PEDIDO" as const, numero: "2026-0042", aPagar: 43000, url: "https://fotoffice.com/p/tok", creado: hace(21) };

function deps(extra: Record<string, unknown> = {}) {
  const enviar = vi.fn(async () => "enviado" as const);
  const marcar = vi.fn(async () => undefined);
  return {
    enviar, marcar,
    d: {
      ahora: AHORA,
      botActivo: async () => true,
      candidatos: async () => [CHAT],
      pendiente: async () => PEDIDO,
      consultaSinCompra: async () => null,
      yaRecordado: async () => false,
      ultimoMensaje: async () => ({ id: "m9", direccion: "SALIENTE" }),
      enviar,
      marcar,
      ...extra,
    } as Deps,
  };
}

describe("recordarPagosPendientes", () => {
  it("al cliente que no pagó le manda el recordatorio y lo deja anotado en el chat", async () => {
    const { d, enviar, marcar } = deps();
    expect(await recordarPagosPendientes(d)).toEqual({ revisados: 1, enviados: 1 });
    expect(enviar).toHaveBeenCalledWith("w1", "chat1", expect.stringContaining("2026-0042"), { ultimoMensajeId: "m9" });
    expect(marcar).toHaveBeenCalledWith("w1", "chat1", "Recordatorio de pago enviado (pedido N° 2026-0042)");
  });

  it("no insiste: un pedido ya recordado no se recuerda de nuevo", async () => {
    const { d, enviar } = deps({ yaRecordado: async () => true });
    expect(await recordarPagosPendientes(d)).toEqual({ revisados: 1, enviados: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("sin pedido pendiente, o si el cliente escribió último (lo está atendiendo alguien), no manda nada", async () => {
    const a = deps({ pendiente: async () => null });
    await recordarPagosPendientes(a.d);
    expect(a.enviar).not.toHaveBeenCalled();
    const b = deps({ ultimoMensaje: async () => ({ id: "m9", direccion: "ENTRANTE" }) });
    await recordarPagosPendientes(b.d);
    expect(b.enviar).not.toHaveBeenCalled();
  });

  it("un chat tomado por una persona o con el bot apagado no recibe recordatorios", async () => {
    const a = deps({ candidatos: async () => [{ ...CHAT, estado: "HUMANO" as const, asignadoUserId: 4 }] });
    await recordarPagosPendientes(a.d);
    expect(a.enviar).not.toHaveBeenCalled();
    const b = deps({ botActivo: async () => false });
    await recordarPagosPendientes(b.d);
    expect(b.enviar).not.toHaveBeenCalled();
  });

  it("si el envío se omitió (entró otro mensaje), no lo anota: se puede intentar en la próxima vuelta", async () => {
    const { d, marcar } = deps({ enviar: async () => "omitido" as const });
    expect(await recordarPagosPendientes(d)).toEqual({ revisados: 1, enviados: 0 });
    expect(marcar).not.toHaveBeenCalled();
  });

  it("consulta de catálogo sin compra: le escribe una vez para retomarla, y lo anota", async () => {
    const { d, enviar, marcar } = deps({ pendiente: async () => null, consultaSinCompra: async () => ({ desde: hace(21) }) });
    expect(await recordarPagosPendientes(d)).toEqual({ revisados: 1, enviados: 1 });
    expect(enviar).toHaveBeenCalledWith("w1", "chat1", expect.stringContaining("¡Hola Daniel!"), { ultimoMensajeId: "m9" });
    expect(marcar).toHaveBeenCalledWith("w1", "chat1", "Seguimiento de consulta enviado");
  });

  it("si hay un pago pendiente, va el recordatorio de pago y no el seguimiento de la consulta", async () => {
    const { d, marcar } = deps({ consultaSinCompra: async () => ({ desde: hace(21) }) });
    await recordarPagosPendientes(d);
    expect(marcar).toHaveBeenCalledTimes(1);
    expect(marcar).toHaveBeenCalledWith("w1", "chat1", expect.stringContaining("Recordatorio de pago"));
  });

  it("el seguimiento dice de qué hablaron y ya no ofrece el enlace para pagar", async () => {
    const { d, enviar } = deps({ pendiente: async () => null, consultaSinCompra: async () => ({ desde: hace(21), tema: "el cuadro" }) });
    await recordarPagosPendientes(d);
    expect(enviar).toHaveBeenCalledWith("w1", "chat1", "¡Hola Daniel! 😊 ¿Pudiste pensar lo del cuadro? Si querés, te lo dejo armado.", { ultimoMensajeId: "m9" });
  });

  it("fuera de 9 a 20 h de Argentina el seguimiento no sale (espera la próxima vuelta del cron)", async () => {
    const consultaSinCompra = vi.fn(async () => ({ desde: hace(21) }));
    // 08:30 UTC = 05:30 en Argentina.
    const { d, enviar } = deps({ ahora: new Date("2026-10-29T08:30:00Z"), candidatos: async () => [{ ...CHAT, ultimoEntranteEn: new Date("2026-10-28T11:30:00Z") }], pendiente: async () => null, consultaSinCompra });
    await recordarPagosPendientes(d);
    expect(enviar).not.toHaveBeenCalled();
    expect(consultaSinCompra).not.toHaveBeenCalled();
  });

  it("el seguimiento de la consulta tampoco sale si el cliente escribió último", async () => {
    const { d, enviar } = deps({ pendiente: async () => null, consultaSinCompra: async () => ({ desde: hace(21) }), ultimoMensaje: async () => ({ id: "m9", direccion: "ENTRANTE" }) });
    await recordarPagosPendientes(d);
    expect(enviar).not.toHaveBeenCalled();
  });
});
