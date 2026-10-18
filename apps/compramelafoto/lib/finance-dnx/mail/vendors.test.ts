import assert from "node:assert/strict";
import test from "node:test";

import { gmailQueryFor, isAllowedAccount, matchVendorKey } from "./vendors";

const DNX = "dnxfotografia@gmail.com";
const CLF = "compramelafoto@gmail.com";
const CUART = "cuart.daniel@gmail.com";

test("sólo se aceptan las tres cuentas conocidas, sin importar mayúsculas", () => {
  assert.equal(isAllowedAccount("DnxFotografia@gmail.com"), true);
  assert.equal(isAllowedAccount(CLF), true);
  assert.equal(isAllowedAccount(CUART), true);
  assert.equal(isAllowedAccount("otra.persona@gmail.com"), false);
});

test("AWS se reconoce por dirección exacta en la cuenta de CLF", () => {
  assert.equal(matchVendorKey(CLF, "payment@aws.com", "Gracias por el pago"), "aws");
});

test("un dominio cubre sus subdominios", () => {
  assert.equal(matchVendorKey(CLF, "noreply@notify.cloudflare.com", "[Alerta] uso"), "cloudflare");
});

test("un dominio parecido no se confunde con el verdadero", () => {
  assert.equal(matchVendorKey(CLF, "noreply@fakecloudflare.com", "[Alerta] uso"), null);
});

test("el mismo remitente en otra cuenta no se asigna", () => {
  assert.equal(matchVendorKey(DNX, "payment@aws.com", "Gracias por el pago"), null);
});

test("un remitente de Stripe se identifica por su acct, no por el dominio", () => {
  assert.equal(
    matchVendorKey(DNX, "invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com", "Your refund from Cursor"),
    "cursor",
  );
  assert.equal(
    matchVendorKey(CUART, "invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com", "Your receipt from Eleven Labs"),
    "elevenlabs",
  );
  assert.equal(
    matchVendorKey(DNX, "invoice+statements+acct_OTROCOMERCIO@stripe.com", "Your receipt from Otro"),
    null,
  );
});

test("Anthropic: el recibo de crédito de API se separa de la suscripción", () => {
  const de = "invoice+statements@mail.anthropic.com";
  assert.equal(matchVendorKey(DNX, de, "Your receipt from Anthropic, PBC #2659-0290-2988"), "anthropic");
  assert.equal(matchVendorKey(DNX, de, "Your receipt from Anthropic - API credits"), "anthropic-api");
});

test("el remitente se compara sin importar nombre visible ni mayúsculas", () => {
  assert.equal(matchVendorKey(DNX, "Neon, LLC <NoReply@ar.neon.tech>", "Payment failed"), "neon");
});

test("la búsqueda de la primera vez no tiene fecha", () => {
  const q = gmailQueryFor(CLF, null);
  assert.equal(q, "from:(payment@aws.com OR cloudflare.com)");
});

test("las búsquedas siguientes filtran por fecha en segundos", () => {
  const q = gmailQueryFor(CLF, new Date("2026-10-15T00:00:00Z"));
  assert.equal(q, `from:(payment@aws.com OR cloudflare.com) after:${Date.UTC(2026, 9, 15) / 1000}`);
});

test("una cuenta sin proveedores no busca nada", () => {
  assert.equal(gmailQueryFor("otra@gmail.com", null), "");
});

test("una dirección falsa escrita en el nombre visible no engaña: vale la dirección real", () => {
  assert.equal(matchVendorKey(CLF, '"<payment@aws.com>" <x@atacante.com>', "Gracias por el pago"), null);
  assert.equal(matchVendorKey(CLF, '"Pagos AWS" <payment@aws.com>', "Gracias por el pago"), "aws");
});
