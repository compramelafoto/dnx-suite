import { describe, expect, it } from "vitest";
import { leerConfigBot, plataformaDe, workspaceDePlataforma, PLATAFORMA_GLOBAL, PREFIJO_PLATAFORMA } from "./config";

describe("leerConfigBot", () => {
  it("por omisión: apagado, Sonnet 5.5, esfuerzo medio, topes del spec, sin Telegram ni clave", () => {
    const c = leerConfigBot({});
    expect(c.enabled).toBe(false);
    expect(c.model).toBe("claude-sonnet-5-5");
    expect(c.effort).toBe("medium");
    expect(c.maxIterations).toBe(8);
    expect(c.limits).toEqual({
      maxMessagesPerUserPerDay: 60,
      monthlyCapMicroUsd: 15_000_000,
      workspaceMonthlyCapMicroUsd: 10_000_000,
    });
    expect(c.telegram).toBeNull();
    expect(c.anthropicApiKey).toBeNull();
  });

  it("sólo FOTOFFICE_BOT_ENABLED=1 lo prende", () => {
    expect(leerConfigBot({ FOTOFFICE_BOT_ENABLED: "1" }).enabled).toBe(true);
    expect(leerConfigBot({ FOTOFFICE_BOT_ENABLED: " 1 " }).enabled).toBe(true);
    expect(leerConfigBot({ FOTOFFICE_BOT_ENABLED: "true" }).enabled).toBe(false);
    expect(leerConfigBot({ FOTOFFICE_BOT_ENABLED: "0" }).enabled).toBe(false);
  });

  it("lee modelo, esfuerzo, vueltas y topes; los valores inválidos caen al de omisión", () => {
    const c = leerConfigBot({
      FOTOFFICE_BOT_MODEL: "claude-haiku-4-5",
      FOTOFFICE_BOT_EFFORT: "high",
      FOTOFFICE_BOT_MAX_ITERATIONS: "5",
      FOTOFFICE_BOT_MONTHLY_CAP_USD: "20.5",
      FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD: "3",
      FOTOFFICE_BOT_MAX_MESSAGES_PER_DAY: "10",
    });
    expect(c.model).toBe("claude-haiku-4-5");
    expect(c.effort).toBe("high");
    expect(c.maxIterations).toBe(5);
    expect(c.limits).toEqual({ maxMessagesPerUserPerDay: 10, monthlyCapMicroUsd: 20_500_000, workspaceMonthlyCapMicroUsd: 3_000_000 });

    const m = leerConfigBot({
      FOTOFFICE_BOT_EFFORT: "extremo",
      FOTOFFICE_BOT_MAX_ITERATIONS: "0",
      FOTOFFICE_BOT_MONTHLY_CAP_USD: "-1",
      FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD: "abc",
      FOTOFFICE_BOT_MAX_MESSAGES_PER_DAY: "2.5",
    });
    expect(m.effort).toBe("medium");
    expect(m.maxIterations).toBe(8);
    expect(m.limits).toEqual({ maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 15_000_000, workspaceMonthlyCapMicroUsd: 10_000_000 });
  });

  it("Telegram sólo con token y chat; la clave de Anthropic se recorta", () => {
    expect(leerConfigBot({ FOTOFFICE_BOT_TELEGRAM_TOKEN: "t" }).telegram).toBeNull();
    expect(leerConfigBot({ FOTOFFICE_BOT_TELEGRAM_TOKEN: "t", FOTOFFICE_BOT_TELEGRAM_CHAT_ID: "c" }).telegram).toEqual({ token: "t", chatId: "c" });
    expect(leerConfigBot({ ANTHROPIC_API_KEY: "  k  " }).anthropicApiKey).toBe("k");
    expect(leerConfigBot({ ANTHROPIC_API_KEY: "   " }).anthropicApiKey).toBeNull();
  });
});

describe("plataforma por workspace", () => {
  it("arma y lee FOTOFFICE:<workspaceId>", () => {
    expect(PLATAFORMA_GLOBAL).toBe("FOTOFFICE");
    expect(PREFIJO_PLATAFORMA).toBe("FOTOFFICE:");
    expect(plataformaDe("ws1")).toBe("FOTOFFICE:ws1");
    expect(workspaceDePlataforma("FOTOFFICE:ws1")).toBe("ws1");
  });
  it("rechaza ids vacíos y no confunde otras plataformas", () => {
    expect(() => plataformaDe("")).toThrow();
    expect(workspaceDePlataforma("CLF")).toBeNull();
    expect(workspaceDePlataforma("FOTOFFICE")).toBeNull();
    expect(workspaceDePlataforma("FOTOFFICE:")).toBeNull();
  });
});
