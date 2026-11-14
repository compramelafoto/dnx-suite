import assert from "node:assert/strict";
import { test } from "node:test";
import { armarCorreoAviso, avisarCobroDivididoAlSumarse, type DepsAvisoEvento } from "./aviso-evento";

function deps(over: Partial<DepsAvisoEvento> = {}): DepsAvisoEvento & { enviados: unknown[] } {
  const enviados: unknown[] = [];
  return {
    enviados,
    buscarFotografo: async () => ({ email: "foto@ejemplo.com", name: "Yael Yospa" }),
    buscarEvento: async () => ({ title: "Producción Epet 2", organizador: "FOTOLAB MIDI" }),
    tieneCobroDivididoActivo: async () => false,
    enviar: async (c) => {
      enviados.push(c);
      return { success: true };
    },
    ...over,
  };
}

test("avisa al fotógrafo que se suma al evento 193 sin cobro dividido", async () => {
  const d = deps();
  assert.equal(await avisarCobroDivididoAlSumarse({ eventId: 193, userId: 1 }, d), "enviado");
  assert.equal(d.enviados.length, 1);
  const c = d.enviados[0] as { to: string; subject: string; html: string };
  assert.equal(c.to, "foto@ejemplo.com");
  assert.match(c.subject, /Producción Epet 2/);
  assert.match(c.html, /Hola Yael,/);
  assert.match(c.html, /de FOTOLAB MIDI/);
  assert.match(c.html, /fotografo\/configuracion/);
});

test("no avisa en eventos fuera de la lista", async () => {
  const d = deps();
  assert.equal(await avisarCobroDivididoAlSumarse({ eventId: 192, userId: 1 }, d), "evento_sin_aviso");
  assert.equal(d.enviados.length, 0);
});

test("no avisa a quien ya aceptó", async () => {
  const d = deps({ tieneCobroDivididoActivo: async () => true });
  assert.equal(await avisarCobroDivididoAlSumarse({ eventId: 193, userId: 1 }, d), "ya_acepto");
  assert.equal(d.enviados.length, 0);
});

test("sin correo no envía", async () => {
  const d = deps({ buscarFotografo: async () => ({ email: null, name: "X" }) });
  assert.equal(await avisarCobroDivididoAlSumarse({ eventId: 193, userId: 1 }, d), "sin_correo");
  assert.equal(d.enviados.length, 0);
});

test("un error nunca se propaga", async () => {
  const d = deps({
    tieneCobroDivididoActivo: async () => {
      throw new Error("base caída");
    },
  });
  assert.equal(await avisarCobroDivididoAlSumarse({ eventId: 193, userId: 1 }, d), "fallo_envio");
});

test("escapa el HTML del nombre y del evento", () => {
  const { html } = armarCorreoAviso({ nombre: "<b>Ana</b>", evento: "A & B", organizador: null });
  assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
});
