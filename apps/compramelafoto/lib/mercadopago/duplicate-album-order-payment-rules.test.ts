import { describe, expect, it } from "vitest";
import {
  buildDuplicatePaymentEmail,
  classifyApprovedPaymentOnAlbumOrder,
  duplicatePaymentEmailIdempotencyKey,
} from "./duplicate-album-order-payment-rules";

describe("classifyApprovedPaymentOnAlbumOrder", () => {
  it("pedido no pagado: primer pago", () => {
    expect(classifyApprovedPaymentOnAlbumOrder({ status: "PENDING", mpPaymentId: null }, "1")).toBe(
      "first_payment"
    );
    expect(classifyApprovedPaymentOnAlbumOrder({ status: "FAILED", mpPaymentId: "9" }, "1")).toBe(
      "first_payment"
    );
  });

  it("mismo pago repetido (reintento de webhook): no es duplicado", () => {
    expect(
      classifyApprovedPaymentOnAlbumOrder(
        { status: "PAID", mpPaymentId: "183000000001" },
        "183000000001"
      )
    ).toBe("same_payment");
  });

  it("pedido PAID con otro pago: duplicado (caso 4645)", () => {
    expect(
      classifyApprovedPaymentOnAlbumOrder(
        { status: "PAID", mpPaymentId: "183000000001" },
        183660994910
      )
    ).toBe("duplicate_payment");
  });

  it("pedido PAID sin pago registrado: no se puede comparar", () => {
    expect(classifyApprovedPaymentOnAlbumOrder({ status: "PAID", mpPaymentId: null }, "1")).toBe(
      "paid_without_mp_payment"
    );
  });
});

describe("avisos de cobro duplicado", () => {
  const input = {
    orderId: 4645,
    albumTitle: "Recital",
    buyerName: "Juan",
    buyerEmail: "juan@example.com",
    buyerPhone: null,
    originalPaymentId: "111",
    duplicatePaymentId: "222",
    amountPesos: 15000,
    approvedAtLabel: "11/10/26 18:30",
  };

  it("una clave por destinatario, pedido y pago", () => {
    expect(duplicatePaymentEmailIdempotencyKey("admin", 4645, "222")).toBe(
      "duplicate_payment_admin_4645_222"
    );
    expect(duplicatePaymentEmailIdempotencyKey("photographer", 4645, "222")).not.toBe(
      duplicatePaymentEmailIdempotencyKey("admin", 4645, "222")
    );
  });

  it("el email incluye pedido, los dos pagos y el monto en pesos", () => {
    for (const recipient of ["admin", "photographer"] as const) {
      const mail = buildDuplicatePaymentEmail(recipient, input, "Ana");
      expect(mail.subject).toContain("4645");
      expect(mail.body).toContain("111");
      expect(mail.body).toContain("222");
      expect(mail.body).toMatch(/\$\s?15\.000/);
    }
  });
});
