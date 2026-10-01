import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { welcomeCardMediaUrl } from "./media-url";

/**
 * La placa lleva la cara de una persona, así que no se sirve por el proxy público de medios:
 * `isPublicMediaKey` rechaza a propósito las claves `clickaton/welcome/…`. La dirección que
 * guarda el archivo apunta igual a ese proxy, así que usarla da 404 — que es lo que le pasaba
 * a la vista previa del panel.
 */
describe("dirección de la placa de bienvenida", () => {
  it("usa el proxy autenticado, no el de medios públicos", () => {
    const url = welcomeCardMediaUrl("reg_123");

    assert.equal(url, "/api/public/registrations/reg_123/welcome-card?format=png&disposition=inline");
    assert.ok(!url.startsWith("/api/media/"), "el proxy público rechaza las placas");
  });

  it("puede pedir la versión liviana", () => {
    assert.match(welcomeCardMediaUrl("reg_123", { format: "webp" }), /format=webp/);
  });

  it("puede pedirla como descarga", () => {
    assert.match(
      welcomeCardMediaUrl("reg_123", { disposition: "attachment" }),
      /disposition=attachment/
    );
  });

  it("escapa un identificador con caracteres raros", () => {
    assert.match(welcomeCardMediaUrl("a/b?c"), /registrations\/a%2Fb%3Fc\//);
  });
});
