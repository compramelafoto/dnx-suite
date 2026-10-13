import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ upsert: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { botOutreach: m } }));
import { leerOutreachPanel, registrarOutreach, registrarVisto } from "./outreach";

beforeEach(() => { m.upsert.mockReset(); m.findMany.mockReset(); });

describe("outreach", () => {
  it("registrarOutreach hace upsert por la clave única y actualiza el estado", async () => {
    await registrarOutreach({ userId: 7, campaign: "nuevo", channel: "PANEL", status: "DISMISSED", answer: "x" });
    const a = m.upsert.mock.calls[0]![0];
    expect(a.where).toEqual({ platform_userId_campaign_channel: { platform: "CLF", userId: 7, campaign: "nuevo", channel: "PANEL" } });
    expect(a.create).toMatchObject({ status: "DISMISSED", answer: "x" });
    expect(a.update).toEqual({ status: "DISMISSED", answer: "x" });
  });
  it("registrarVisto no pisa un estado posterior (update vacío)", async () => {
    await registrarVisto(7, "sin_ventas");
    const a = m.upsert.mock.calls[0]![0];
    expect(a.create).toMatchObject({ status: "SHOWN", channel: "PANEL", campaign: "sin_ventas" });
    expect(a.update).toEqual({});
  });
  it("leerOutreachPanel filtra por plataforma, usuario y canal PANEL", async () => {
    const d = new Date();
    m.findMany.mockResolvedValue([{ campaign: "nuevo", status: "SHOWN", updatedAt: d }]);
    expect(await leerOutreachPanel(7)).toEqual([{ campaign: "nuevo", status: "SHOWN", updatedAt: d }]);
    expect(m.findMany.mock.calls[0]![0].where).toEqual({ platform: "CLF", userId: 7, channel: "PANEL" });
  });
});
