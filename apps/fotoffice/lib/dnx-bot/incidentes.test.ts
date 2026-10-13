import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  registrar: vi.fn(),
  reservar: vi.fn(),
  liberar: vi.fn(),
  tg: vi.fn(),
  telegram: { token: "t", chatId: "c" } as { token: string; chatId: string } | null,
}));
vi.mock("./store", () => ({
  registrarIncidente: (...a: unknown[]) => m.registrar(...a),
  reservarMarca: (...a: unknown[]) => m.reservar(...a),
  liberarMarca: (...a: unknown[]) => m.liberar(...a),
}));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("./config", async (orig) => ({ ...(await orig<object>()), leerConfigBot: () => ({ telegram: m.telegram }) }));
import { avisarSinClave, reportarCifraNoRespaldada, reportarIncidente, reiniciarCupoDeAvisos } from "./incidentes";

beforeEach(() => {
  m.registrar.mockReset();
  m.reservar.mockReset();
  m.liberar.mockReset();
  m.tg.mockReset().mockResolvedValue({ ok: true });
  m.telegram = { token: "t", chatId: "c" };
  reiniciarCupoDeAvisos();
});

describe("reportarIncidente", () => {
  it("registra en la plataforma del workspace con firma estable y detalle recortado", async () => {
    m.registrar.mockResolvedValue({ occurrences: 1, isNew: true });
    await reportarIncidente({ plataforma: "FOTOFFICE:ws1", area: "chat", codigo: "api_Error", ids: { conversationId: "c1" }, detalle: "x".repeat(900), urgente: false });
    const arg = m.registrar.mock.calls[0]![0];
    expect(arg).toMatchObject({ plataforma: "FOTOFFICE:ws1", title: "chat: api_Error", urgent: false });
    expect(arg.signature).toMatch(/^[0-9a-f]{16}$/);
    expect(arg.data.detalle).toHaveLength(500);
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("urgente y nuevo → Telegram con FOTOFFICE; repetido → no", async () => {
    m.registrar.mockResolvedValueOnce({ occurrences: 1, isNew: true }).mockResolvedValueOnce({ occurrences: 2, isNew: false });
    const p = { plataforma: "FOTOFFICE:ws1", area: "herramienta", codigo: "falla", ids: {}, detalle: "boom", urgente: true };
    await reportarIncidente(p);
    await reportarIncidente(p);
    expect(m.tg).toHaveBeenCalledTimes(1);
    expect(m.tg.mock.calls[0]![1]).toMatch(/^🐞 FOTOFFICE · /);
  });
});

describe("avisarSinClave", () => {
  it("una marca por día en FOTOFFICE; avisa sólo quien la reserva", async () => {
    m.reservar.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await avisarSinClave(new Date("2026-10-20T15:00:00Z"));
    await avisarSinClave(new Date("2026-10-20T16:00:00Z"));
    expect(m.reservar.mock.calls[0]![0]).toMatchObject({ plataforma: "FOTOFFICE", signature: "sin-clave-2026-10-20" });
    expect(m.tg).toHaveBeenCalledTimes(1);
    expect(m.tg.mock.calls[0]![1]).toContain("ANTHROPIC_API_KEY");
  });
  it("sin Telegram no reserva; si Telegram falla libera; nunca lanza", async () => {
    m.telegram = null;
    await avisarSinClave();
    expect(m.reservar).not.toHaveBeenCalled();
    m.telegram = { token: "t", chatId: "c" };
    m.reservar.mockResolvedValue(true);
    m.tg.mockResolvedValue({ ok: false, error: "http_500" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await avisarSinClave(new Date("2026-10-20T15:00:00Z"));
    expect(m.liberar).toHaveBeenCalledWith({ plataforma: "FOTOFFICE", signature: "sin-clave-2026-10-20" });
    m.reservar.mockRejectedValue(new Error("db"));
    await expect(avisarSinClave()).resolves.toBeUndefined();
    log.mockRestore();
  });
});

describe("reportarCifraNoRespaldada", () => {
  it("una firma por workspace y día; al tercer caso del día avisa por Telegram, sin las cifras", async () => {
    m.registrar
      .mockResolvedValueOnce({ occurrences: 1, isNew: true })
      .mockResolvedValueOnce({ occurrences: 2, isNew: false })
      .mockResolvedValueOnce({ occurrences: 3, isNew: false })
      .mockResolvedValueOnce({ occurrences: 4, isNew: false });
    const p = { plataforma: "FOTOFFICE:ws1", ids: { conversationId: "c1" }, cantidad: 1, ahora: new Date("2026-10-20T15:00:00Z") };
    for (let i = 0; i < 4; i++) await reportarCifraNoRespaldada(p);
    const firmas = new Set(m.registrar.mock.calls.map((c) => (c[0] as { signature: string }).signature));
    expect(firmas.size).toBe(1);
    expect(m.registrar.mock.calls[0]![0]).toMatchObject({ plataforma: "FOTOFFICE:ws1", title: "cifras: cifra_no_respaldada (2026-10-20)" });
    expect(m.tg).toHaveBeenCalledTimes(1);
    expect(m.tg.mock.calls[0]![1]).toMatch(/^⚠️ FOTOFFICE · /);
  });
  it("otro día, otra firma", async () => {
    m.registrar.mockResolvedValue({ occurrences: 1, isNew: true });
    await reportarCifraNoRespaldada({ plataforma: "FOTOFFICE:ws1", ids: {}, cantidad: 1, ahora: new Date("2026-10-20T15:00:00Z") });
    await reportarCifraNoRespaldada({ plataforma: "FOTOFFICE:ws1", ids: {}, cantidad: 1, ahora: new Date("2026-10-21T15:00:00Z") });
    const [a, b] = m.registrar.mock.calls.map((c) => (c[0] as { signature: string }).signature);
    expect(a).not.toBe(b);
  });
});
