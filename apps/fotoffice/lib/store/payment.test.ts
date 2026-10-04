import { describe, expect, it } from "vitest";
import { storeCheckoutBlocker, storePaymentDescription, storeReturnUrls } from "./payment";

describe("storePaymentDescription", () => {
  it("nombra la institución y el número de pedido", () => {
    expect(storePaymentDescription("Sociedad Fotográfica", 42)).toBe("Compra en Sociedad Fotográfica — pedido #42");
  });
});

describe("storeReturnUrls", () => {
  it("agrega el resultado del pago a la vuelta", () => {
    expect(storeReturnUrls("https://app.test", "/w/sfpr/tienda/pedido/ped_x")).toEqual({
      successUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=ok",
      pendingUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=pendiente",
      failureUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=error",
    });
  });

  it("si la vuelta ya trae parámetros (el token), suma con & sin romperlos", () => {
    expect(storeReturnUrls("https://app.test", "/w/sfpr/tienda/pedido/ped_x?t=abc").successUrl).toBe(
      "https://app.test/w/sfpr/tienda/pedido/ped_x?t=abc&pago=ok",
    );
  });
});

describe("storeCheckoutBlocker", () => {
  const now = new Date("2026-10-04T15:00:00Z");
  const vigente = { status: "PENDING_PAYMENT" as const, holdExpiresAt: new Date("2026-10-04T15:10:00Z"), totalMinor: 1000 };

  it("un pedido esperando el pago, con la retención vigente y algo que cobrar, se puede pagar", () => {
    expect(storeCheckoutBlocker(vigente, now)).toBeNull();
  });

  it("uno que ya no espera el pago, no", () => {
    expect(storeCheckoutBlocker({ ...vigente, status: "PAID" }, now)).toBe("Ese pedido ya no está esperando el pago.");
  });

  it("uno con la retención vencida, no: el stock ya se liberó", () => {
    expect(storeCheckoutBlocker({ ...vigente, holdExpiresAt: new Date("2026-10-04T15:00:00Z") }, now)).toMatch(/venció/);
    expect(storeCheckoutBlocker({ ...vigente, holdExpiresAt: null }, now)).toMatch(/venció/);
  });

  it("uno en cero, no", () => {
    expect(storeCheckoutBlocker({ ...vigente, totalMinor: 0 }, now)).toBe("Ese pedido no tiene nada que pagar.");
  });
});
