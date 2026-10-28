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
});
