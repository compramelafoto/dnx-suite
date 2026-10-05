import { describe, expect, it } from "vitest";
import { canTransition } from "./transitions";

describe("canTransition", () => {
  it.each([
    ["PENDING_PAYMENT", "PAID", "system", true],
    ["PENDING_PAYMENT", "EXPIRED", "system", true],
    ["PENDING_PAYMENT", "CANCELLED", "staff", true],
    ["EXPIRED", "PAID", "system", true],
    ["EXPIRED", "PAID_NO_STOCK", "system", true],
    ["CANCELLED", "PAID_NO_STOCK", "system", true],
    ["PAID", "READY", "staff", true],
    ["READY", "DELIVERED", "staff", true],
    ["PAID", "DELIVERED", "staff", true],
    ["PAID", "CANCELLED", "staff", true],
    ["READY", "CANCELLED", "staff", true],
    ["PAID_NO_STOCK", "PAID", "staff", true],
    ["PAID_NO_STOCK", "CANCELLED", "staff", true],
    ["DELIVERED", "CANCELLED", "staff", false],
    ["PAID", "PENDING_PAYMENT", "staff", false],
    ["PENDING_PAYMENT", "PAID", "staff", false],
    ["EXPIRED", "PAID", "staff", false],
  ] as const)("%s → %s (%s) = %s", (from, to, actor, esperado) => {
    expect(canTransition(from, to, actor)).toBe(esperado);
  });
});
