import assert from "node:assert/strict";
import test from "node:test";

import { buildReferralInviteContent } from "./referral-invite-content";

const BASE = {
  firstName: "Ana",
  code: "CK-7F3K2",
  colegas: 0,
  baseUrl: "https://maratonfotografica.com",
};

test("el link personal se arma con el código de la persona", () => {
  const c = buildReferralInviteContent(BASE);
  assert.equal(c.link, "https://maratonfotografica.com/i/CK-7F3K2");
  assert.ok(c.html.includes("https://maratonfotografica.com/i/CK-7F3K2"));
  assert.ok(c.text.includes("https://maratonfotografica.com/i/CK-7F3K2"));
});

test("saluda por el nombre, y sin nombre no queda un hueco raro", () => {
  assert.ok(buildReferralInviteContent(BASE).text.startsWith("Hola Ana,"));
  assert.ok(
    buildReferralInviteContent({ ...BASE, firstName: null }).text.startsWith("Hola,"),
  );
});

test("a quien todavía no invitó a nadie no se le habla de sus amigos", () => {
  const c = buildReferralInviteContent(BASE);
  assert.ok(!c.text.includes("Ya se sumaron"));
  assert.ok(!c.text.includes("Ya se sumó"));
  assert.equal(
    c.subject,
    "Invitá a tus amigos a Clickatón y vení gratis a la próxima",
  );
});

test("a quien ya invitó se le dice cómo va, en singular y en plural", () => {
  const uno = buildReferralInviteContent({ ...BASE, colegas: 1 });
  assert.ok(uno.text.includes("Ya se sumó 1 amigo"));

  const varios = buildReferralInviteContent({ ...BASE, colegas: 3 });
  assert.ok(varios.text.includes("Ya se sumaron 3 amigos"));
});

test("el asunto de quien ya arrancó muestra su progreso", () => {
  // Abrir un correo que dice "ya vas 3 de 5" es más tentador que uno que
  // repite la propuesta desde cero.
  const c = buildReferralInviteContent({ ...BASE, colegas: 3 });
  assert.equal(c.subject, "Ya vas 3 de 5 para tu próxima Clickatón gratis");
});

test("la escalera completa aparece en el correo", () => {
  const c = buildReferralInviteContent(BASE);
  for (const p of ["10%", "20%", "35%", "60%"]) {
    assert.ok(c.text.includes(p), `falta ${p}`);
  }
  assert.ok(c.text.includes("GRATIS"));
});

test("el botón de WhatsApp lleva la invitación ya redactada", () => {
  // Un email no puede copiar al portapapeles: este botón es el que reemplaza
  // ese gesto de verdad.
  const c = buildReferralInviteContent(BASE);
  const url = c.html.match(/https:\/\/wa\.me\/\?text=[^"]+/)?.[0];
  assert.ok(url, "no hay botón de WhatsApp");
  const texto = decodeURIComponent(url.replace("https://wa.me/?text=", ""));
  assert.ok(texto.includes(c.link), "el mensaje no lleva el link");
  assert.ok(texto.includes("10% de descuento"), "no le ofrece nada al invitado");
});

test("avisa que hay que iniciar sesión para que el descuento se aplique", () => {
  // Sin esto, alguien se inscribe como invitado y el descuento no sale.
  const c = buildReferralInviteContent(BASE);
  assert.ok(c.text.includes("iniciá sesión"));
  assert.ok(c.html.includes("iniciá sesión"));
});

test("dice que lo acumulado no vence", () => {
  const c = buildReferralInviteContent(BASE);
  assert.ok(c.text.includes("no vence nunca"));
});

test("un nombre con caracteres raros no rompe el HTML", () => {
  const c = buildReferralInviteContent({ ...BASE, firstName: '<script>"Ana"' });
  assert.ok(!c.html.includes("<script>"));
  assert.ok(c.html.includes("&lt;script&gt;"));
});

test("el logo apunta a una URL absoluta: un email no resuelve rutas relativas", () => {
  const c = buildReferralInviteContent(BASE);
  assert.ok(
    c.html.includes("https://maratonfotografica.com/brand/logo-horizontal-web.png"),
  );
  assert.ok(c.html.includes('alt="Clickatón'), "el logo necesita texto alternativo");
});

test("la escalera marca hasta dónde llegó cada uno", () => {
  // Ver los escalones que ya alcanzó, encendidos, es la mitad del incentivo.
  const sinNadie = buildReferralInviteContent(BASE);
  const conTres = buildReferralInviteContent({ ...BASE, colegas: 3 });

  const encendidos = (html: string) => (html.match(/border:2px solid #F9B114/g) ?? []).length;
  assert.equal(encendidos(sinNadie.html), 0);
  assert.equal(encendidos(conTres.html), 3);
});

test("el maquetado usa tablas, no flexbox: Gmail y Outlook no entienden el resto", () => {
  const c = buildReferralInviteContent(BASE);
  assert.ok(c.html.includes('role="presentation"'));
  assert.ok(!c.html.includes("display:flex"));
  assert.ok(!c.html.includes("display:grid"));
});

test("un baseUrl con barra al final no produce una doble barra", () => {
  const c = buildReferralInviteContent({
    ...BASE,
    baseUrl: "https://maratonfotografica.com/",
  });
  assert.equal(c.link, "https://maratonfotografica.com/i/CK-7F3K2");
});
