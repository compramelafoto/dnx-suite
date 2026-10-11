import { describe, expect, it } from "vitest";
import { checkLimits } from "./limits";

const limits = { maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: 30_000_000 };

describe("checkLimits", () => {
  it("permite debajo de los topes", () => {
    expect(checkLimits(limits, { userMessagesToday: 49, monthMicroUsd: 29_999_999 })).toEqual({ allowed: true });
  });
  it("corta por tope diario del usuario", () => {
    const d = checkLimits(limits, { userMessagesToday: 50, monthMicroUsd: 0 });
    expect(d).toMatchObject({ allowed: false, reason: "user_daily" });
  });
  it("corta por tope mensual global aunque el usuario tenga margen", () => {
    const d = checkLimits(limits, { userMessagesToday: 0, monthMicroUsd: 30_000_000 });
    expect(d).toMatchObject({ allowed: false, reason: "monthly_cap" });
  });
  it("tope mensual 0 significa sin tope", () => {
    expect(checkLimits({ ...limits, monthlyCapMicroUsd: 0 }, { userMessagesToday: 0, monthMicroUsd: 9e9 })).toEqual({ allowed: true });
  });
});
