import assert from "node:assert/strict";
import test from "node:test";

import { buildOutreachInviteContent } from "./outreach-invite-content";

const BASE = {
  firstName: "Marcelo",
  origen: "compramelafoto" as const,
  baseUrl: "https://maratonfotografica.com",
};

test("el asunto dice de dónde viene el correo", () => {
  // Aparecer de la nada en la casilla de alguien que nunca interactuó con
  // Clickatón es lo que dispara el botón de spam.
  const c = buildOutreachInviteContent(BASE);
  assert.equal(
    c.subject,
    "Te escribimos desde Clickatón, la maratón de los que ya usan CompraMeLaFoto",
  );
});

test("el asunto se adapta a cada plataforma", () => {
  assert.ok(
    buildOutreachInviteContent({ ...BASE, origen: "fotoffice" }).subject.includes(
      "FOTOFFICE",
    ),
  );
  assert.ok(
    buildOutreachInviteContent({ ...BASE, origen: "fotorank" }).subject.includes(
      "FotoRank",
    ),
  );
});

test("NO les pide copiar un link: todavía no tienen cuenta", () => {
  // Es la diferencia con el correo de la comunidad. Si les dijéramos "copiá
  // tu link", harían clic y no encontrarían nada.
  const c = buildOutreachInviteContent(BASE);
  assert.ok(!c.text.includes("/i/"), "no debe haber un link de invitación");
  assert.ok(!c.html.includes("Tu link personal"));
});

test("el botón los lleva a crearse la cuenta", () => {
  const c = buildOutreachInviteContent(BASE);
  assert.ok(c.html.includes("https://maratonfotografica.com/crear-cuenta"));
  assert.ok(c.text.includes("/crear-cuenta"));
});

test("avisa que la cuenta es aparte de la de la otra plataforma", () => {
  // Sin esto intentan entrar con la clave de CompraMeLaFoto y abandonan.
  const c = buildOutreachInviteContent(BASE);
  assert.ok(c.html.includes("aparte de la de CompraMeLaFoto"));
});

test("ofrece una salida clara", () => {
  // En un envío a gente que no pidió nada, esto es lo que separa un correo
  // legítimo de uno que termina marcado como spam.
  const c = buildOutreachInviteContent(BASE);
  assert.ok(c.text.includes("no te escribimos nunca más"));
  assert.ok(c.html.includes("no te escribimos nunca más"));
});

test("dice por qué le llega el correo", () => {
  const c = buildOutreachInviteContent(BASE);
  assert.ok(c.html.includes("porque tenés una cuenta en CompraMeLaFoto"));
});

test("la escalera completa aparece", () => {
  const c = buildOutreachInviteContent(BASE);
  for (const p of ["10%", "20%", "35%", "60%"]) {
    assert.ok(c.text.includes(p), `falta ${p}`);
  }
  assert.ok(c.text.includes("GRATIS"));
});

test("habla de la PRIMERA Clickatón, no de la próxima", () => {
  // Esta gente nunca vino: no tiene una "próxima".
  const c = buildOutreachInviteContent(BASE);
  assert.ok(c.text.includes("PRIMERA") || c.html.includes("primera"));
  assert.ok(!c.text.includes("tu próxima Clickatón"));
});

test("sin nombre el saludo no queda con un hueco", () => {
  const c = buildOutreachInviteContent({ ...BASE, firstName: null });
  assert.ok(c.text.startsWith("Hola,"));
});

test("un nombre con HTML no rompe el correo", () => {
  const c = buildOutreachInviteContent({ ...BASE, firstName: '<script>x' });
  assert.ok(!c.html.includes("<script>"));
});
