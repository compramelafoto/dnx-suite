import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMessage,
  firstName,
  toWhatsAppNumber,
} from "./build-mp-reconnect-whatsapp-list";

describe("toWhatsAppNumber", () => {
  it("le agrega el 9 que WhatsApp exige a los celulares argentinos", () => {
    assert.equal(toWhatsAppNumber("3415551234"), "5493415551234");
    assert.equal(toWhatsAppNumber("11 5555 1234"), "5491155551234");
    assert.equal(toWhatsAppNumber("+54 341 555 1234"), "5493415551234");
  });

  it("saca el 0 inicial del formato local", () => {
    assert.equal(toWhatsAppNumber("03415551234"), "5493415551234");
    assert.equal(toWhatsAppNumber("011 5555-1234"), "5491155551234");
  });

  it("no duplica el 9 si ya está", () => {
    assert.equal(toWhatsAppNumber("+5493415551234"), "5493415551234");
    assert.equal(toWhatsAppNumber("5493415551234"), "5493415551234");
  });

  it("respeta los números de otros países escritos como internacionales", () => {
    assert.equal(toWhatsAppNumber("+56 9 8765 4321"), "56987654321");
    assert.equal(toWhatsAppNumber("+52 55 1234 5678"), "525512345678");
  });

  it("descarta lo que no sirve en vez de inventar un número", () => {
    assert.equal(toWhatsAppNumber(null), null);
    assert.equal(toWhatsAppNumber(""), null);
    assert.equal(toWhatsAppNumber("no tengo"), null);
    assert.equal(toWhatsAppNumber("1234"), null);
    assert.equal(toWhatsAppNumber("54 341"), null);
    // 9 dígitos sueltos: no se sabe si falta el área o sobra algo.
    assert.equal(toWhatsAppNumber("341555123"), null);
  });
});

describe("firstName", () => {
  it("toma el primer nombre y lo capitaliza", () => {
    assert.equal(firstName("eugenia cejas"), "Eugenia");
    assert.equal(firstName("MARÍA JOSÉ PÉREZ"), "María");
  });

  it("devuelve null cuando no hay un nombre usable", () => {
    assert.equal(firstName(null), null);
    assert.equal(firstName("   "), null);
    assert.equal(firstName("123"), null);
    assert.equal(firstName("A"), null);
  });
});

describe("buildMessage", () => {
  it("saluda por el nombre cuando lo hay", () => {
    assert.match(buildMessage("Eugenia"), /^Hola Eugenia, ¿cómo estás\? Soy Daniel Cuart, de Comprame la Foto\./);
  });

  it("sin nombre no deja un saludo roto", () => {
    const msg = buildMessage(null);
    assert.match(msg, /^Hola, ¿cómo estás\?/);
    assert.doesNotMatch(msg, /Hola null/);
  });

  it("dice que es una disposición de Mercado Pago y cómo se arregla", () => {
    const msg = buildMessage("Eugenia");
    assert.match(msg, /disposición de Mercado Pago/);
    assert.match(msg, /Reconectar Mercado Pago/);
    assert.match(msg, /compramelafoto\.com\/fotografo\/configuracion/);
  });
});
