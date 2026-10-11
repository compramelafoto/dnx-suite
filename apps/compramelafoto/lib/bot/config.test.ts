import { afterEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { systemSettings: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
import { isBotEnabledForUser, readBotConfig } from "./config";

afterEach(() => { vi.unstubAllEnvs(); findUnique.mockReset(); });

describe("config del bot", () => {
  it("defaults", () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    const c = readBotConfig();
    expect(c).toMatchObject({ enabled: true, model: "claude-sonnet-5-5", effort: "medium", maxIterations: 8 });
    expect(c.limits).toEqual({ maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: 30_000_000 });
  });
  it("apagado si falta la variable", async () => {
    expect(readBotConfig().enabled).toBe(false);
    expect(await isBotEnabledForUser(1)).toBe(false);
  });
  it("modo piloto: sólo los usuarios de la lista", async () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    findUnique.mockResolvedValue({ value: JSON.stringify({ soloPiloto: true, userIds: [5] }), isActive: true });
    expect(await isBotEnabledForUser(5)).toBe(true);
    expect(await isBotEnabledForUser(6)).toBe(false);
  });
  it("sin fila de piloto = modo piloto con lista vacía (nadie)", async () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    findUnique.mockResolvedValue(null);
    expect(await isBotEnabledForUser(5)).toBe(false);
  });
});
