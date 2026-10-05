import { describe, expect, it } from "vitest";
import type { StoreOrderStatus } from "@repo/db";
import { canTransition } from "./transitions";

describe("canTransition — sistema", () => {
  it.each([
    ["PENDING_PAYMENT", "PAID", true],
    ["PENDING_PAYMENT", "EXPIRED", true],
    ["EXPIRED", "PAID", true],
    ["EXPIRED", "PAID_NO_STOCK", true],
    ["CANCELLED", "PAID_NO_STOCK", true],
    ["PAID", "SHIPPED", false],
    ["SHIPPED", "DELIVERED", false],
  ] as const)("%s → %s = %s", (from, to, esperado) => {
    expect(canTransition(from, to, "system")).toBe(esperado);
  });
});

describe("canTransition — personal, pedido con retiro", () => {
  it.each([
    ["PENDING_PAYMENT", "CANCELLED", true],
    ["PAID", "READY", true],
    ["READY", "DELIVERED", true],
    ["PAID", "DELIVERED", true],
    ["PAID", "CANCELLED", true],
    ["READY", "CANCELLED", true],
    ["PAID_NO_STOCK", "PAID", true],
    ["PAID_NO_STOCK", "CANCELLED", true],
    ["PAID", "SHIPPED", false],
    ["READY", "SHIPPED", false],
    ["DELIVERED", "CANCELLED", false],
    ["PAID", "PENDING_PAYMENT", false],
    ["PENDING_PAYMENT", "PAID", false],
    ["EXPIRED", "PAID", false],
  ] as const)("%s → %s = %s", (from, to, esperado) => {
    expect(canTransition(from, to, "staff", "PICKUP")).toBe(esperado);
  });
});

describe("canTransition — personal, pedido con envío", () => {
  it.each([
    ["PENDING_PAYMENT", "CANCELLED", true],
    ["PAID", "SHIPPED", true],
    ["PAID", "CANCELLED", true],
    ["SHIPPED", "DELIVERED", true],
    ["SHIPPED", "CANCELLED", true],
    ["PAID_NO_STOCK", "PAID", true],
    ["PAID_NO_STOCK", "CANCELLED", true],
    // "Listo para retirar" no existe para un envío; y no se entrega sin despachar.
    ["PAID", "READY", false],
    ["PAID", "DELIVERED", false],
    ["SHIPPED", "PAID", false],
    ["SHIPPED", "READY", false],
    ["DELIVERED", "CANCELLED", false],
    ["PENDING_PAYMENT", "SHIPPED", false],
    ["PAID_NO_STOCK", "SHIPPED", false],
  ] as const)("%s → %s = %s", (from, to, esperado) => {
    expect(canTransition(from, to, "staff", "SHIPPING")).toBe(esperado);
  });

  it("nadie sale de un estado final", () => {
    const todos: StoreOrderStatus[] = ["PENDING_PAYMENT", "PAID", "READY", "SHIPPED", "DELIVERED", "CANCELLED", "EXPIRED", "PAID_NO_STOCK"];
    for (const metodo of ["PICKUP", "SHIPPING"]) {
      for (const to of todos) {
        expect(canTransition("DELIVERED", to, "staff", metodo)).toBe(false);
        expect(canTransition("CANCELLED", to, "staff", metodo)).toBe(false);
      }
    }
  });

  it("un método desconocido se trata como retiro (los pedidos de la etapa 1 no tienen otro)", () => {
    expect(canTransition("PAID", "READY", "staff", "")).toBe(true);
    expect(canTransition("PAID", "SHIPPED", "staff", "")).toBe(false);
  });
});
