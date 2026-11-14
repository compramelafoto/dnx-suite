// pnpm --filter compramelafoto test:meta-pixel
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildMetaServerEvent, getMetaCapiConfig, normalizePhoneForMeta, sendMetaServerEvent, sha256Normalized } from "./meta-capi";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } });

test("sin píxel o sin token no hay configuración ni envío", async () => {
  delete process.env.META_CAPI_ACCESS_TOKEN;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890";
  assert.equal(getMetaCapiConfig(), null);
  const sent = await sendMetaServerEvent({ eventName: "PrimerAlbum", eventId: "x", user: { id: 1, email: "a@b.c" } });
  assert.equal(sent, false);
});

test("el correo viaja cifrado y normalizado, nunca en texto", () => {
  assert.equal(sha256Normalized("  Foto@Ejemplo.COM "), sha("foto@ejemplo.com"));
  const ev = buildMetaServerEvent({ eventName: "PrimeraVenta", eventId: "primera-venta-7", user: { id: 7, email: "Foto@Ejemplo.com" } }, 1_700_000_000_000);
  assert.deepEqual(ev.user_data.em, [sha("foto@ejemplo.com")]);
  assert.deepEqual(ev.user_data.external_id, [sha("clf-user-7")]);
  assert.ok(!JSON.stringify(ev).includes("Ejemplo"));
  assert.equal(ev.event_time, 1_700_000_000);
});

test("teléfono argentino con código de país", () => {
  assert.equal(normalizePhoneForMeta("0341 155-123456"), "54341155123456");
  assert.equal(normalizePhoneForMeta("+54 9 341 5123456"), "5493415123456");
  assert.equal(normalizePhoneForMeta("123"), null);
});

test("con navegador del fotógrafo es 'website' y lleva cookies, IP y navegador", () => {
  const ev = buildMetaServerEvent({
    eventName: "CompleteRegistration",
    eventId: "registro-fotografo-3",
    user: { id: 3, email: "x@y.z" },
    req: req({ cookie: "a=1; _fbp=fb.1.123.456; _fbc=fb.1.123.abc", "x-forwarded-for": "200.1.2.3, 10.0.0.1", "user-agent": "Mozilla/5.0" }),
    eventSourceUrl: "https://www.compramelafoto.com/registro",
  });
  assert.equal(ev.action_source, "website");
  assert.equal(ev.user_data.fbp, "fb.1.123.456");
  assert.equal(ev.user_data.fbc, "fb.1.123.abc");
  assert.equal(ev.user_data.client_ip_address, "200.1.2.3");
  assert.equal(ev.user_data.client_user_agent, "Mozilla/5.0");
  assert.equal((ev as { event_source_url?: string }).event_source_url, "https://www.compramelafoto.com/registro");
});

test("la primera venta, sin navegador del fotógrafo, es 'system_generated'", () => {
  const ev = buildMetaServerEvent({
    eventName: "PrimeraVenta",
    eventId: "primera-venta-9",
    user: { id: 9, email: "f@g.h" },
    customData: { value: 5980, currency: "ARS" },
    eventSourceUrl: "https://ignorada",
  });
  assert.equal(ev.action_source, "system_generated");
  assert.equal("event_source_url" in ev, false);
  assert.deepEqual(ev.custom_data, { value: 5980, currency: "ARS" });
});

test("con token configurado arma el pedido a Meta con código de prueba", async () => {
  process.env.META_CAPI_ACCESS_TOKEN = "tok";
  process.env.META_CAPI_TEST_EVENT_CODE = "TEST123";
  const orig = globalThis.fetch;
  let url = ""; let body: any = null;
  globalThis.fetch = (async (u: string, init: RequestInit) => { url = u; body = JSON.parse(String(init.body)); return new Response("{}", { status: 200 }); }) as typeof fetch;
  try {
    const ok = await sendMetaServerEvent({ eventName: "PrimerAlbum", eventId: "primer-album-5", user: { id: 5, email: "a@b.c" } });
    assert.equal(ok, true);
    assert.match(url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1234567890\/events\?access_token=tok$/);
    assert.equal(body.test_event_code, "TEST123");
    assert.equal(body.data[0].event_id, "primer-album-5");
  } finally {
    globalThis.fetch = orig;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
  }
});
