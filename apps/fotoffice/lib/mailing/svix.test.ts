import { describe, expect, it } from "vitest";
import { signSvix, verifySvix } from "./svix";

const secret = `whsec_${Buffer.from("clave-de-prueba-123").toString("base64")}`;
const body = JSON.stringify({ type: "email.opened", data: { email_id: "e1" } });
const now = 1_760_000_000;

function input(over: Partial<Parameters<typeof verifySvix>[0]> = {}) {
  const sig = signSvix(secret, "msg_1", String(now), body);
  return { secret, id: "msg_1", timestamp: String(now), signatureHeader: `v1,${sig}`, body, nowSeconds: now, ...over };
}

describe("firma de los webhooks de Resend", () => {
  it("acepta una firma válida, también entre varias", () => {
    expect(verifySvix(input())).toEqual({ ok: true });
    const sig = signSvix(secret, "msg_1", String(now), body);
    expect(verifySvix(input({ signatureHeader: `v1,AAAA v1,${sig}` }))).toEqual({ ok: true });
  });

  it("rechaza cuerpo cambiado, otro secreto y cabeceras faltantes", () => {
    expect(verifySvix(input({ body: body.replace("opened", "clicked") })).ok).toBe(false);
    expect(verifySvix(input({ secret: `whsec_${Buffer.from("otra").toString("base64")}` })).ok).toBe(false);
    expect(verifySvix(input({ id: null }))).toEqual({ ok: false, reason: "MISSING" });
    expect(verifySvix(input({ secret: "whsec_" }))).toEqual({ ok: false, reason: "BAD_SECRET" });
  });

  it("rechaza avisos viejos o del futuro (más de 5 minutos)", () => {
    expect(verifySvix(input({ nowSeconds: now + 301 }))).toEqual({ ok: false, reason: "STALE" });
    expect(verifySvix(input({ nowSeconds: now - 301 }))).toEqual({ ok: false, reason: "STALE" });
    expect(verifySvix(input({ nowSeconds: now + 299 })).ok).toBe(true);
  });
});
