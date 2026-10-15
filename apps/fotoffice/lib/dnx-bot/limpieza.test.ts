import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ conv: vi.fn(), acc: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: { botConversation: { deleteMany: H.conv }, botAction: { deleteMany: H.acc } } }));
import { borrarConversacionesViejas, DIAS_DE_RETENCION } from "./limpieza";

const AHORA = new Date("2026-10-20T15:00:00.000Z");
beforeEach(() => {
  H.conv.mockReset().mockResolvedValue({ count: 3 });
  H.acc.mockReset().mockResolvedValue({ count: 5 });
});

describe("borrarConversacionesViejas", () => {
  it("sólo las de FOTOFFICE (nunca las de CLF), sin movimiento hace 90 días; también sus acciones", async () => {
    expect(DIAS_DE_RETENCION).toBe(90);
    expect(await borrarConversacionesViejas(AHORA)).toEqual({ conversaciones: 3, acciones: 5 });
    const corte = new Date("2026-07-22T15:00:00.000Z");
    expect(H.conv.mock.calls[0]![0]).toEqual({ where: { platform: { startsWith: "FOTOFFICE:" }, updatedAt: { lt: corte } } });
    expect(H.acc.mock.calls[0]![0]).toEqual({ where: { platform: { startsWith: "FOTOFFICE:" }, createdAt: { lt: corte } } });
  });
});
