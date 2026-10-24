import assert from "node:assert/strict";
import { test } from "node:test";
import { pedirRecorte, servicioDeRecortes } from "./proveedor";

test("sin clave el servicio está apagado", () => {
  assert.equal(servicioDeRecortes({}), null);
  assert.deepEqual(servicioDeRecortes({ REMOVE_BG_API_KEY: " k " }), { url: "https://api.remove.bg/v1.0/removebg", clave: "k" });
  assert.equal(servicioDeRecortes({ REMOVE_BG_API_KEY: "k", REMOVE_BG_API_URL: "https://otro/x" })!.url, "https://otro/x");
});

test("manda la foto con la clave y pide una persona en PNG", async () => {
  let pedido: { url: string; init: RequestInit } | null = null;
  const fetchFalso = (async (url: string, init: RequestInit) => {
    pedido = { url, init };
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await pedirRecorte(new Uint8Array([1, 2, 3]), { url: "https://api.remove.bg/v1.0/removebg", clave: "k" }, fetchFalso);
  assert.deepEqual([...r], [137, 80, 78, 71]);
  assert.equal(pedido!.url, "https://api.remove.bg/v1.0/removebg");
  assert.equal((pedido!.init.headers as Record<string, string>)["X-Api-Key"], "k");
  const form = pedido!.init.body as FormData;
  assert.equal(form.get("type"), "person");
  assert.equal(form.get("format"), "png");
  assert.equal(form.get("size"), "auto");
});

test("un error del servicio se informa con su mensaje", async () => {
  const fetchFalso = (async () =>
    new Response(JSON.stringify({ errors: [{ title: "No se encontró una persona" }] }), { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    pedirRecorte(new Uint8Array([1]), { url: "https://x", clave: "k" }, fetchFalso),
    /No se encontró una persona/,
  );
});
