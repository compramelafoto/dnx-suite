import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCanjeWhatsAppMessage, buildWhatsAppUrl, telefonoWhatsAppArgentina } from "./canje-whatsapp";

describe("telefonoWhatsAppArgentina", () => {
  it("arma 549 + área + número", () => {
    assert.equal(telefonoWhatsAppArgentina("3415320475"), "5493415320475");
    assert.equal(telefonoWhatsAppArgentina("341 532-0475"), "5493415320475");
  });
  it("acepta el número ya con 54 9 o con 0 adelante", () => {
    assert.equal(telefonoWhatsAppArgentina("+54 9 341 532 0475"), "5493415320475");
    assert.equal(telefonoWhatsAppArgentina("03415320475"), "5493415320475");
  });
  it("rechaza un número incompleto en vez de inventar uno", () => {
    assert.equal(telefonoWhatsAppArgentina("315776232"), null);
    assert.equal(buildWhatsAppUrl("315776232", "hola"), null);
  });
});

describe("buildCanjeWhatsAppMessage", () => {
  it("usa el primer nombre del alumno y termina con el link", () => {
    const m = buildCanjeWhatsAppMessage({
      parentName: "María Jimena",
      studentName: "Josefina Altamirano",
      albumTitle: "Colegio Los Ángeles",
      comboLabel: "3 fotos impresas 15x21 con su digital",
      printUnits: 3,
      link: "https://www.compramelafoto.com/canje/abc",
    });
    assert.ok(m.startsWith("¡Hola María Jimena! Te paso el link para elegir las fotos de Josefina"));
    assert.ok(m.includes("elegí las 3 fotos del combo"));
    assert.ok(m.endsWith("https://www.compramelafoto.com/canje/abc"));
  });
});
