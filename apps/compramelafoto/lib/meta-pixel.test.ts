// pnpm --filter compramelafoto test:meta-pixel
import { test } from "node:test";
import assert from "node:assert/strict";
import { getMetaPixelId, isMetaPixelPathAllowed, metaEventForFunnel, metaTrack, metaTrackPurchase } from "./meta-pixel";
import { FUNNEL_EVENTS } from "./funnel-events";

function fakeWindow() {
  const calls: unknown[][] = [];
  const store = new Map<string, string>();
  (globalThis as any).window = {
    fbq: (...args: unknown[]) => calls.push(args),
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
  return calls;
}

test("sin NEXT_PUBLIC_META_PIXEL_ID no hay píxel ni eventos", () => {
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  assert.equal(getMetaPixelId(), null);
  const calls = fakeWindow();
  metaTrack("PageView");
  assert.equal(calls.length, 0);
});

test("un identificador que no es numérico se ignora", () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "abc');alert(1);//";
  assert.equal(getMetaPixelId(), null);
  process.env.NEXT_PUBLIC_META_PIXEL_ID = " 1234567890 ";
  assert.equal(getMetaPixelId(), "1234567890");
});

test("los paneles internos quedan fuera; lo público adentro", () => {
  assert.equal(isMetaPixelPathAllowed("/admin"), false);
  assert.equal(isMetaPixelPathAllowed("/dashboard/albums/3"), false);
  assert.equal(isMetaPixelPathAllowed("/fotografo/pedidos"), false);
  assert.equal(isMetaPixelPathAllowed("/a/123/comprar"), true);
  assert.equal(isMetaPixelPathAllowed("/"), true);
  assert.equal(isMetaPixelPathAllowed("/administracion-publica"), true);
});

test("pasos del embudo → eventos estándar de Meta", () => {
  assert.equal(metaEventForFunnel(FUNNEL_EVENTS.ORDER_CONFIG_VIEW), "ViewContent");
  assert.equal(metaEventForFunnel(FUNNEL_EVENTS.ORDER_FINAL_VIEW), "InitiateCheckout");
  assert.equal(metaEventForFunnel(FUNNEL_EVENTS.PAYMENT_START), "AddPaymentInfo");
  // La compra sale aparte, con importe: no desde el embudo.
  assert.equal(metaEventForFunnel(FUNNEL_EVENTS.PAYMENT_SUCCESS), null);
  assert.equal(metaEventForFunnel(FUNNEL_EVENTS.REFERRAL_COPY_LINK), null);
});

test("Purchase lleva importe y moneda y sale una sola vez por pedido", () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890";
  const calls = fakeWindow();
  metaTrackPurchase({ orderType: "ALBUM_ORDER", orderId: 42, value: 15000, currency: "ars" });
  metaTrackPurchase({ orderType: "ALBUM_ORDER", orderId: 42, value: 15000, currency: "ars" });
  assert.equal(calls.length, 1);
  const [method, event, params, opts] = calls[0] as [string, string, Record<string, unknown>, Record<string, unknown>];
  assert.equal(method, "track");
  assert.equal(event, "Purchase");
  assert.equal(params.value, 15000);
  assert.equal(params.currency, "ARS");
  assert.deepEqual(opts, { eventID: "purchase-ALBUM_ORDER-42" });
});
