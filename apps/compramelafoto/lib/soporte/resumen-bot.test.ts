import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ conv: vi.fn(), raw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { botConversation: { findUnique: (...a: unknown[]) => m.conv(...a) }, $queryRaw: (...a: unknown[]) => m.raw(...a) },
}));
import { clasificarConversacion, leerConversacion, periodoDeResumen, resumenBot } from "./resumen-bot";

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("clasificarConversacion", () => {
  it("un solo texto es un toque; dos o más, charla; escalada, ticket", () => {
    expect(clasificarConversacion({ textosDelUsuario: 0, status: "OPEN" })).toBe("UN_TOQUE");
    expect(clasificarConversacion({ textosDelUsuario: 1, status: "OPEN" })).toBe("UN_TOQUE");
    expect(clasificarConversacion({ textosDelUsuario: 2, status: "OPEN" })).toBe("CHARLA");
    expect(clasificarConversacion({ textosDelUsuario: 5, status: "ESCALATED" })).toBe("TICKET");
  });
});

describe("resumenBot", () => {
  it("cuenta por tipo y audiencia; resueltas por el bot = todo lo que no fue ticket", async () => {
    m.raw.mockResolvedValue([
      { audience: "BUYER", status: "OPEN", textos: 1 },
      { audience: "BUYER", status: "OPEN", textos: 3 },
      { audience: "BUYER", status: "ESCALATED", textos: 4 },
      { audience: "PHOTOGRAPHER", status: "OPEN", textos: 2 },
    ]);
    const r = await resumenBot(new Date("2026-10-12T03:00:00Z"), new Date("2026-10-27T03:00:00Z"));
    expect(r).toEqual({ total: 4, unToque: 1, charlas: 2, tickets: 1, resueltasPorBot: 3, porAudiencia: { BUYER: 3, PHOTOGRAPHER: 1 } });
  });
});

describe("periodoDeResumen", () => {
  it("por defecto son los últimos 15 días argentinos, con el día de hoy incluido", () => {
    const p = periodoDeResumen(null, null, new Date("2026-10-26T15:00:00Z"));
    expect(p.desde.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(p.hasta.toISOString()).toBe("2026-10-27T03:00:00.000Z");
  });
  it("respeta fechas pedidas (hasta inclusive)", () => {
    const p = periodoDeResumen("2026-10-01", "2026-10-02", new Date());
    expect(p.desde.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.hasta.toISOString()).toBe("2026-10-03T03:00:00.000Z");
  });
});

describe("leerConversacion", () => {
  it("muestra lo que escribió la persona y lo que contestó el bot, sin resultados de herramientas", async () => {
    m.conv.mockResolvedValue({
      id: "c1",
      audience: "BUYER",
      messages: [
        { role: "user", content: "¿Cómo encuentro mis fotos?", createdAt: new Date("2026-10-25T10:00:00Z") },
        { role: "assistant", content: [{ type: "text", text: "Buscá con tu selfie." }, { type: "tool_use", name: "ver_album" }], createdAt: new Date("2026-10-25T10:00:01Z") },
        { role: "user", content: [{ type: "tool_result", content: "{}" }], createdAt: new Date("2026-10-25T10:00:02Z") },
      ],
      actions: [{ toolName: "reenviar_descarga", summary: "Reenvío", status: "EXECUTED" }],
    });
    const r = await leerConversacion("c1");
    expect(r?.items).toEqual([
      { rol: "usuario", texto: "¿Cómo encuentro mis fotos?", fecha: new Date("2026-10-25T10:00:00Z") },
      { rol: "bot", texto: "Buscá con tu selfie.", fecha: new Date("2026-10-25T10:00:01Z") },
    ]);
    expect(r?.acciones).toEqual([{ toolName: "reenviar_descarga", summary: "Reenvío", status: "EXECUTED" }]);
  });

  it("los avisos del sistema ([Sistema] …) se muestran aparte", async () => {
    m.conv.mockResolvedValue({ id: "c2", audience: "PHOTOGRAPHER", actions: [], messages: [{ role: "user", content: "[Sistema] Se aplicó el cambio.", createdAt: new Date(0) }] });
    expect((await leerConversacion("c2"))?.items[0]?.rol).toBe("sistema");
  });

  it("inexistente → null", async () => {
    m.conv.mockResolvedValue(null);
    expect(await leerConversacion("x")).toBeNull();
  });
});
