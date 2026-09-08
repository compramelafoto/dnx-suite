import { describe, expect, it } from "vitest";
import { extractPaymentId } from "./webhook-payload";

const u = (q: string) => new URL(`https://app.example${q}`);

describe("de dónde sale el identificador del pago", () => {
  it("del cuerpo, que es lo habitual", () => {
    expect(extractPaymentId({ type: "payment", data: { id: 123 } }, u("/"))).toBe("123");
  });

  it("de la query, que es como avisa el modo viejo", () => {
    expect(extractPaymentId({}, u("/?type=payment&data.id=456"))).toBe("456");
  });

  it("acepta el identificador como número o como texto", () => {
    expect(extractPaymentId({ data: { id: "789" } }, u("/"))).toBe("789");
  });

  it("un aviso que no es de pago se ignora", () => {
    expect(extractPaymentId({ type: "plan", data: { id: 1 } }, u("/"))).toBeNull();
    expect(extractPaymentId({}, u("/?type=subscription&data.id=1"))).toBeNull();
  });

  it("sin identificador devuelve null, no un texto vacío", () => {
    expect(extractPaymentId({}, u("/"))).toBeNull();
    expect(extractPaymentId(null, u("/"))).toBeNull();
    expect(extractPaymentId({ data: {} }, u("/"))).toBeNull();
    expect(extractPaymentId({ data: { id: "   " } }, u("/"))).toBeNull();
  });
});
