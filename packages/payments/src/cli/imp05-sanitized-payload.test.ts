/**
 * El payload se comparte con Mercado Pago en el ticket de homologación, así que
 * lo que importa fijar no es sólo que tenga los campos, sino que NO lleve el
 * token de tarjeta ni el email completo del comprador.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSanitizedHomologationPayload } from "./imp05-sanitized-payload.js";

describe("payload sanitizado para homologación", () => {
  const body = buildSanitizedHomologationPayload() as Record<string, any>;

  it("evidencia los datos del pagador que MP pidió ver", () => {
    assert.equal(body.payer.first_name, "Comprador");
    assert.equal(body.payer.last_name, "De Prueba");
    assert.equal(body.payer.identification.number, "12345678");
    assert.equal(body.payer.address.zip_code, "2000");
    assert.ok(body.payer.email.includes("@"), "el email tiene que seguir siendo legible como tal");
  });

  it("evidencia el ítem con su código interno y la categoría", () => {
    assert.equal(body.items[0].external_code, "CLF-FOTO-001");
    assert.equal(body.items[0].category_id, "virtual_goods");
  });

  it("lleva las señales antifraude con claves planas", () => {
    assert.equal(body.additional_info["payer.authentication_type"], "WEB");
    assert.equal(body.additional_info["payer.is_prime_user"], false);
    assert.equal(body.additional_info["payer.is_first_purchase_online"], true);
    assert.ok(body.additional_info["payer.registration_date"]);
    assert.ok(body.additional_info["payer.last_purchase"]);
    // El nodo anidado `payer` es de la API de Payments: Orders lo rechaza.
    assert.equal(body.additional_info.payer, undefined);
  });

  it("lleva la dirección completa dentro de payer", () => {
    assert.equal(body.payer.address.neighborhood, "Centro");
    assert.equal(body.payer.address.city, "Rosario");
  });

  it("no filtra el token de tarjeta", () => {
    const token = body.transactions.payments[0].payment_method.token;
    assert.equal(token, "«card_token»");
    assert.doesNotMatch(JSON.stringify(body), /[0-9a-f]{32}/, "no debe quedar ningún token hexadecimal");
  });

  it("no filtra el email completo del comprador", () => {
    assert.doesNotMatch(JSON.stringify(body), /buyer\.imp05@/);
  });

  it("enmascara los receiver_id de los partners pero deja el del owner", () => {
    const splits = body.splits as Array<Record<string, string>>;
    const owner = splits.find((s) => s.receiver_type === "owner");
    const partners = splits.filter((s) => s.receiver_type === "partner");
    assert.equal(owner?.receiver_id, "3141372692");
    for (const p of partners) assert.match(p.receiver_id, /…$/);
  });

  it("la suma de los splits da el total", () => {
    const suma = (body.splits as Array<Record<string, string>>)
      .reduce((acc, s) => acc + Math.round(Number(s.amount) * 100), 0);
    assert.equal(suma, Math.round(Number(body.total_amount) * 100));
  });
});
