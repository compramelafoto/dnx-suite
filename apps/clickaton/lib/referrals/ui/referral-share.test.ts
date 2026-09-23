import assert from "node:assert/strict";
import test from "node:test";

import { buildReferralShareMessage, buildReferralWhatsappUrl } from "./referral-share";

const LINK = "https://maratonfotografica.com/i/CK-7F3K2";

test("el mensaje termina con el link, para que WhatsApp lo previsualice", () => {
  const msg = buildReferralShareMessage({ link: LINK });
  assert.ok(msg.trimEnd().endsWith(LINK));
});

test("el mensaje menciona el descuento del invitado, no el premio de quien invita", () => {
  // Compartir el link tiene que sonar a regalo, no a pedido de favor.
  const msg = buildReferralShareMessage({ link: LINK });
  assert.ok(msg.includes("10%"));
  assert.ok(!msg.includes("gratis"), "el premio propio no va en el mensaje al colega");
});

test("el link de WhatsApp lleva el mensaje codificado", () => {
  const url = buildReferralWhatsappUrl({ link: LINK });
  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.ok(decodeURIComponent(url).includes(LINK));
});
