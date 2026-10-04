import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveGiftRecipient,
  sendGiftEmail,
  type SendGiftEmailInput,
} from "./gift-email";

function base(overrides: Partial<SendGiftEmailInput> = {}): SendGiftEmailInput {
  return {
    kind: "gift_purchased_buyer",
    to: "ana@example.test",
    buyerName: "Ana",
    recipientName: "Beto",
    editionName: "Clickatón Navidad 2026",
    voucherCode: "REGALO-7K3M-9QX2",
    editionDate: "12/12/2026",
    dryRunBuildOnly: true,
    ...overrides,
  };
}

describe("correos del regalo", () => {
  it("al que regala: trae el código, el link y el botón de WhatsApp", async () => {
    const mail = await sendGiftEmail(base());
    assert.match(mail.subject, /Tu regalo está listo/);
    assert.match(mail.text, /REGALO-7K3M-9QX2/);
    assert.match(mail.text, /\/regalo\/REGALO-7K3M-9QX2/);
    assert.match(mail.text, /wa\.me/);
    assert.match(mail.html, /Enviar por WhatsApp/);
    assert.match(mail.text, /No tiene que pagar nada/);
  });

  it("al amigo: dice quién se lo regala y lleva el botón de activar", async () => {
    const mail = await sendGiftEmail(
      base({ kind: "gift_invitation_recipient", to: "beto@example.test" }),
    );
    assert.match(mail.subject, /Ana te regaló la Clickatón Navidad 2026/);
    assert.match(mail.html, /Activar mi lugar/);
    assert.match(mail.text, /\/regalo\/REGALO-7K3M-9QX2/);
  });

  it("al amigo: incluye la dedicatoria cuando hay", async () => {
    const mail = await sendGiftEmail(
      base({
        kind: "gift_invitation_recipient",
        to: "beto@example.test",
        giftMessage: "¡Feliz cumple, salí a sacar fotos!",
      }),
    );
    assert.match(mail.text, /Feliz cumple, salí a sacar fotos/);
    assert.match(mail.html, /Feliz cumple, salí a sacar fotos/);
  });

  it("al amigo: sin dedicatoria no deja comillas vacías", async () => {
    const mail = await sendGiftEmail(
      base({ kind: "gift_invitation_recipient", to: "beto@example.test" }),
    );
    assert.doesNotMatch(mail.html, /«»/);
    assert.doesNotMatch(mail.text, /«»/);
  });

  it("al que regala cuando se activa: nombra a quien lo activó", async () => {
    const mail = await sendGiftEmail(
      base({ kind: "gift_redeemed_buyer", redeemedByName: "Beto Gómez" }),
    );
    assert.match(mail.subject, /Beto Gómez activó tu regalo/);
    assert.match(mail.text, /ya está inscripto/);
  });

  it("recordatorio: avisa que falta poco", async () => {
    const mail = await sendGiftEmail(
      base({ kind: "gift_reminder_recipient", to: "beto@example.test" }),
    );
    assert.match(mail.subject, /No te olvides de activar tu regalo/);
    assert.match(mail.text, /Falta poco/);
  });

  it("escapa el HTML de lo que escribe la gente", async () => {
    const mail = await sendGiftEmail(
      base({
        kind: "gift_invitation_recipient",
        to: "beto@example.test",
        giftMessage: '<script>alert("hola")</script>',
      }),
    );
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /&lt;script&gt;/);
  });

  it("en staging redirige el correo para no escribirle a un tercero", () => {
    const staging = {
      CLICKATON_PUBLIC_URL: "https://clickaton-staging.vercel.app",
      CLICKATON_EMAIL_TEST_TO: "pruebas@dnx.test",
    };
    assert.equal(
      resolveGiftRecipient("persona-real@gmail.com", staging),
      "pruebas@dnx.test",
    );
  });

  it("en staging sin casilla de pruebas cae al buzón de descarte", () => {
    const staging = { CLICKATON_PUBLIC_URL: "https://clickaton-staging.vercel.app" };
    assert.equal(
      resolveGiftRecipient("persona-real@gmail.com", staging),
      "clickaton-funnel-test@example.test",
    );
  });

  it("en producción sí va al correo real de la persona", () => {
    const prod = { CLICKATON_PUBLIC_URL: "https://maratonfotografica.com" };
    assert.equal(
      resolveGiftRecipient("  persona-real@gmail.com ", prod),
      "persona-real@gmail.com",
    );
  });

  it("funciona sin nombre de destinatario ni fecha", async () => {
    const mail = await sendGiftEmail(
      base({ recipientName: null, editionDate: null }),
    );
    assert.match(mail.text, /tu amigo/);
    assert.doesNotMatch(mail.text, /del null/);
  });
});
