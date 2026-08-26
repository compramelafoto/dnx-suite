import test from "node:test";
import assert from "node:assert/strict";
import { createMercadoPagoCheckoutProLiveAdapter } from "./preference-adapter";

/**
 * Captura el cuerpo que se le manda a MercadoPago sin salir a la red.
 */
function clienteEspia() {
  const enviados: Array<{ path: string; body: unknown }> = [];
  return {
    enviados,
    http: {
      async request(input: { path: string; body?: unknown }) {
        enviados.push({ path: input.path, body: input.body });
        return {
          status: 201,
          body: {
            id: "pref-1",
            init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
          },
        };
      },
    } as never,
  };
}

const base = {
  amountMinor: 4700000,
  currency: "ARS" as const,
  description: "Cuota de agosto",
  externalReference: "intent-1",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  successUrl: "https://fotoffice.com/ok",
  pendingUrl: "https://fotoffice.com/pend",
  failureUrl: "https://fotoffice.com/mal",
  notificationUrl: "https://fotoffice.com/api/webhook",
  accessTokenOverride: "APP_USR-token-de-la-institucion",
};

test("manda marketplace_fee en unidades, no en centavos", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await adapter.createPreference({ ...base, marketplaceFeeMinor: 235000 });
  const body = espia.enviados[0]?.body as Record<string, unknown>;
  // 47.000,00 ARS de total; 2.350,00 de comisión.
  assert.equal(body.marketplace_fee, 2350);
  assert.equal((body.items as Array<{ unit_price: number }>)[0]?.unit_price, 47000);
});

test("sin comision, no manda el campo en vez de mandar cero", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await adapter.createPreference(base);
  const body = espia.enviados[0]?.body as Record<string, unknown>;
  assert.equal("marketplace_fee" in body, false);
});

test("rechaza una comision que se come el total", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await assert.rejects(
    () => adapter.createPreference({ ...base, marketplaceFeeMinor: base.amountMinor }),
    /smaller than the amount/,
  );
});

test("rechaza una comision negativa o con decimales", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await assert.rejects(
    () => adapter.createPreference({ ...base, marketplaceFeeMinor: -1 }),
    /non-negative integer/,
  );
  await assert.rejects(
    () => adapter.createPreference({ ...base, marketplaceFeeMinor: 10.5 }),
    /non-negative integer/,
  );
});

test("el identificador de item y el producto de origen se pueden declarar", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await adapter.createPreference({ ...base, itemId: "cuota-socio", sourceApp: "FOTOFFICE" });
  const body = espia.enviados[0]?.body as Record<string, unknown>;
  assert.equal((body.items as Array<{ id: string }>)[0]?.id, "cuota-socio");
  assert.equal((body.metadata as Record<string, string>).source_app, "FOTOFFICE");
});

test("sin declararlos, sigue comportandose como antes para Clickaton", async () => {
  const espia = clienteEspia();
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ httpClient: espia.http });
  await adapter.createPreference(base);
  const body = espia.enviados[0]?.body as Record<string, unknown>;
  assert.equal((body.items as Array<{ id: string }>)[0]?.id, "clickaton-registration");
  assert.equal((body.metadata as Record<string, string>).source_app, "CLICKATON");
});
