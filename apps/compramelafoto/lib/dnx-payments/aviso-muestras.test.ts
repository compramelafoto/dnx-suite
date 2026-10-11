import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { avisarAMuestras, esOrdenDeMuestras, firmarAviso, olvidarAvisoSinSecreto } from "./aviso-muestras";

/**
 * Vector fijo: el mismo en `apps/muestras/lib/ventas/aviso-firma.test.ts`. Si cambia acá, Muestras
 * deja de aceptar los avisos de CLF.
 */
const SECRETO = "muestras-aviso-test";
const T = 1760000000;
const CUERPO = '{"providerOrderId":"ORDTST01ABC"}';
const FIRMA = "t=1760000000,v1=34d01d20f565cec491c2f4ef14aed21211567adf8a0f910c58f2ee5799597c4e";

type Llamada = { url: string; init: RequestInit };

function fetchFalso(respuesta: () => Promise<Response>) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return respuesta();
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

const silenciar = () => {
  const orig = console.warn;
  const mensajes: string[] = [];
  console.warn = (...a: unknown[]) => void mensajes.push(a.map(String).join(" "));
  return { mensajes, restaurar: () => void (console.warn = orig) };
};

beforeEach(() => olvidarAvisoSinSecreto());

describe("aviso a Muestras", () => {
  it("prefijo de las órdenes de Muestras", () => {
    assert.equal(esOrdenDeMuestras("muestras-venta-abcd1234abcd1234"), true);
    assert.equal(esOrdenDeMuestras("muestras-venta-"), false);
    assert.equal(esOrdenDeMuestras("clf-order-123"), false);
    assert.equal(esOrdenDeMuestras(null), false);
    assert.equal(esOrdenDeMuestras(undefined), false);
  });

  it("vector fijo de la firma (igual al de Muestras)", () => {
    assert.equal(firmarAviso(SECRETO, T, CUERPO), FIRMA);
  });

  it("sin secreto no llama a fetch", async () => {
    const { f, llamadas } = fetchFalso(async () => new Response(null, { status: 202 }));
    const s = silenciar();
    await avisarAMuestras("ORDTST01ABC", { fetch: f, env: {}, ahora: () => T * 1000 });
    await avisarAMuestras("ORDTST01ABC", { fetch: f, env: { MUESTRAS_AVISO_PAGOS_SECRET: "  " }, ahora: () => T * 1000 });
    s.restaurar();
    assert.equal(llamadas.length, 0);
    assert.equal(s.mensajes.length, 1);
  });

  it("con secreto manda URL, encabezado firmado y cuerpo", async () => {
    const { f, llamadas } = fetchFalso(async () => new Response(null, { status: 202 }));
    await avisarAMuestras("ORDTST01ABC", { fetch: f, env: { MUESTRAS_AVISO_PAGOS_SECRET: SECRETO }, ahora: () => T * 1000 });
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0]!.url, "https://muestrasfotograficas.com/api/pagos/aviso");
    assert.equal(llamadas[0]!.init.method, "POST");
    assert.equal(llamadas[0]!.init.body, CUERPO);
    assert.equal((llamadas[0]!.init.headers as Record<string, string>)["x-dnx-aviso"], FIRMA);
    assert.ok(llamadas[0]!.init.signal instanceof AbortSignal);

    await avisarAMuestras("ORDTST01ABC", { fetch: f, env: { MUESTRAS_AVISO_PAGOS_SECRET: SECRETO, MUESTRAS_AVISO_PAGOS_URL: "http://localhost:3014/api/pagos/aviso" }, ahora: () => T * 1000 });
    assert.equal(llamadas[1]!.url, "http://localhost:3014/api/pagos/aviso");
  });

  it("un fetch que tira o que se corta por tiempo nunca lanza ni muestra el secreto", async () => {
    const s = silenciar();
    const tira = fetchFalso(async () => {
      throw new Error("ECONNRESET");
    });
    await avisarAMuestras("ORDTST01ABC", { fetch: tira.f, env: { MUESTRAS_AVISO_PAGOS_SECRET: SECRETO }, ahora: () => T * 1000 });
    const tarda = fetchFalso(async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    });
    await avisarAMuestras("ORDTST01ABC", { fetch: tarda.f, env: { MUESTRAS_AVISO_PAGOS_SECRET: SECRETO }, ahora: () => T * 1000 });
    const mal = fetchFalso(async () => new Response("no", { status: 500 }));
    await avisarAMuestras("ORDTST01ABC", { fetch: mal.f, env: { MUESTRAS_AVISO_PAGOS_SECRET: SECRETO }, ahora: () => T * 1000 });
    s.restaurar();
    assert.equal(s.mensajes.length, 3);
    assert.ok(s.mensajes.every((m) => !m.includes(SECRETO)));
  });
});
