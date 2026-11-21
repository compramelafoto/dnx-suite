import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { recordarConsultasDeAnuncio } = await import("./recordatorio-anuncio-servidor");
type Deps = NonNullable<Parameters<typeof recordarConsultasDeAnuncio>[0]>;

const T0 = new Date("2026-11-21T15:00:00Z");
const AHORA = new Date(T0.getTime() + 70 * 60_000);
const CHAT = { id: "chat1", workspaceId: "w1", nombre: "Marta", estado: "BOT" as const, asignadoUserId: null as number | null, botPausadoHasta: null, botExcluido: false, ultimoEntranteEn: T0 };
const CHARLA = [
  { id: "m1", direccion: "ENTRANTE", autor: "CLIENTE", texto: "¡Hola! Quiero más información.", media: { anuncio: { texto: "¿TENÉS VHS GUARDADOS?" } }, createdAt: T0 },
  { id: "m2", direccion: "SALIENTE", autor: "BOT", texto: "¡Hola Marta! …", media: null, createdAt: new Date(T0.getTime() + 20_000) },
];

function deps(extra: Partial<Deps> = {}) {
  const enviar = vi.fn(async () => "enviado" as const);
  const marcar = vi.fn(async () => undefined);
  const d: Deps = { ahora: AHORA, botActivo: async () => true, candidatos: async () => [CHAT], charla: async () => CHARLA, enviar, marcar, ...extra };
  return { d, enviar, marcar };
}

describe("recordarConsultasDeAnuncio", () => {
  it("a la hora le escribe al que no contestó y lo deja anotado en el chat", async () => {
    const { d, enviar, marcar } = deps();
    expect(await recordarConsultasDeAnuncio(d)).toEqual({ revisados: 1, enviados: 1 });
    expect(enviar).toHaveBeenCalledWith("w1", "chat1", expect.stringContaining("Marta"), { ultimoMensajeId: "m2" });
    expect(marcar).toHaveBeenCalledWith("w1", "chat1", "Recordatorio de consulta de anuncio 1 enviado");
  });
  it("con el bot apagado o el chat tomado por una persona no manda nada", async () => {
    const a = deps({ botActivo: async () => false });
    await recordarConsultasDeAnuncio(a.d);
    expect(a.enviar).not.toHaveBeenCalled();
    const b = deps({ candidatos: async () => [{ ...CHAT, estado: "HUMANO" as const, asignadoUserId: 1102 }] });
    await recordarConsultasDeAnuncio(b.d);
    expect(b.enviar).not.toHaveBeenCalled();
  });
  it("si el envío se omite (otro mensaje llegó en el medio) no lo anota", async () => {
    const { d, marcar } = deps({ enviar: vi.fn(async () => "omitido" as const) });
    await recordarConsultasDeAnuncio(d);
    expect(marcar).not.toHaveBeenCalled();
  });
});
