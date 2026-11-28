import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const R = await import("./resumen");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const AHORA = new Date("2026-11-24T15:00:00.000Z");
const t = (min: number) => new Date(AHORA.getTime() - min * 60_000);

async function preparar() {
  const chat = await P.fotofficeWaChat.create({ data: { workspaceId: "w1", waId: "549341", ultimoMensajeEn: t(1), nombre: "María" } });
  const m = (min: number, p: Record<string, unknown>) => P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId: chat.id, tipo: "TEXTO", createdAt: t(min), ...p } });
  await m(10, { direccion: "ENTRANTE", autor: "CLIENTE", texto: "Quiero XV para el 14/2" });
  await m(9, { direccion: "SISTEMA", autor: "SISTEMA", texto: "Sabina tomó el chat" });
  await m(8, { direccion: "SALIENTE", autor: "USUARIO", autorLabel: "Sabina", texto: "El paquete Oro sale $850.000" });
  await m(7, { direccion: "NOTA", autor: "USUARIO", autorLabel: "Sabina", texto: "Pregunta si incluye video" });
  return chat.id as string;
}

const deps = (p: Partial<Parameters<typeof R.generarResumen>[2]> = {}) => ({
  ahora: AHORA,
  config: () => ({ enabled: true, anthropicApiKey: "k", model: "m", limits: { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 1, workspaceMonthlyCapMicroUsd: 1 } }),
  uso: vi.fn(async () => ({ mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 })),
  registrarUso: vi.fn(async () => undefined),
  llamar: vi.fn(async () => ({ texto: "Quiere XV el 14/2. Se le pasó el Oro ($850.000). Falta: si incluye video.", usage: { input_tokens: 10, output_tokens: 5 } })),
  ...p,
});

beforeEach(() => {
  B.vaciar();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("generarResumen", () => {
  it("arma la charla sin los SISTEMA (con las notas), guarda el resumen y cuenta el gasto", async () => {
    const id = await preparar();
    const d = deps();
    expect(await R.generarResumen("w1", id, d)).toContain("Quiere XV");
    const charla = ((d.llamar as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string])[0];
    expect(charla).toContain("Cliente: Quiero XV para el 14/2");
    expect(charla).toContain("Sabina: El paquete Oro sale $850.000");
    expect(charla).toContain("Nota interna de Sabina: Pregunta si incluye video");
    expect(charla).not.toContain("tomó el chat");
    expect(B.datos.fotofficeWaChat[0]).toMatchObject({ resumen: expect.stringContaining("Quiere XV"), resumenEn: AHORA });
    expect(d.registrarUso).toHaveBeenCalledTimes(1);
  });
  it("recorta a 800 caracteres", async () => {
    const id = await preparar();
    await R.generarResumen("w1", id, deps({ llamar: vi.fn(async () => ({ texto: "x".repeat(2000), usage: { input_tokens: 1, output_tokens: 1 } })) }));
    expect((B.datos.fotofficeWaChat[0].resumen as string).length).toBeLessThanOrEqual(800);
  });
  it("con el tope agotado, el bot apagado o un chat de otra institución: no llama", async () => {
    const id = await preparar();
    const tope = deps({ uso: vi.fn(async () => ({ mensajesHoyPersona: 0, gastoMesGlobal: 5, gastoMesWorkspace: 5 })) });
    expect(await R.generarResumen("w1", id, tope)).toBeNull();
    expect(tope.llamar).not.toHaveBeenCalled();
    const apagado = deps({ config: () => ({ enabled: false, anthropicApiKey: null, model: "m", limits: { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 0, workspaceMonthlyCapMicroUsd: 0 } }) });
    expect(await R.generarResumen("w1", id, apagado)).toBeNull();
    const otra = deps();
    expect(await R.generarResumen("w2", id, otra)).toBeNull();
    expect(otra.llamar).not.toHaveBeenCalled();
  });
  it("si Claude falla, no lanza ni guarda", async () => {
    const id = await preparar();
    expect(await R.generarResumen("w1", id, deps({ llamar: vi.fn(async () => { throw new Error("caído"); }) }))).toBeNull();
    expect(B.datos.fotofficeWaChat[0].resumen).toBeNull();
  });
});
