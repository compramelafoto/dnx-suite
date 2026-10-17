import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enParalelo, esArchivoDeFuente, fetchConReintentos } from "./red-de-pruebas";

/**
 * La prueba que baja de verdad las tipografías reintenta los cortes de red, pero no los
 * errores reales: un 404 es una familia mal escrita y tiene que fallar al primer intento.
 */
type Llamada = Response | Error;

function fetchFalso(guion: Llamada[]) {
  let llamadas = 0;
  const f = (async () => {
    const paso = guion[Math.min(llamadas, guion.length - 1)]!;
    llamadas++;
    if (paso instanceof Error) throw paso;
    return paso;
  }) as unknown as typeof fetch;
  return { f, llamadas: () => llamadas };
}

const sinEsperar = { dormir: async () => {}, alReintentar: () => {} };
const cortado = () => new TypeError("fetch failed");

describe("fetchConReintentos", () => {
  it("reintenta un corte de red y devuelve la respuesta buena", async () => {
    const { f, llamadas } = fetchFalso([cortado(), cortado(), new Response("ok")]);
    const res = await fetchConReintentos(f, sinEsperar)("https://x");
    assert.equal(res.status, 200);
    assert.equal(llamadas(), 3);
  });

  it("reintenta un tiempo agotado", async () => {
    const vencido = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const { f, llamadas } = fetchFalso([vencido, new Response("ok")]);
    assert.equal((await fetchConReintentos(f, sinEsperar)("https://x")).status, 200);
    assert.equal(llamadas(), 2);
  });

  it("reintenta 429 y 5xx", async () => {
    const { f, llamadas } = fetchFalso([
      new Response("", { status: 429 }),
      new Response("", { status: 503 }),
      new Response("ok"),
    ]);
    assert.equal((await fetchConReintentos(f, sinEsperar)("https://x")).status, 200);
    assert.equal(llamadas(), 3);
  });

  it("un 404 no se reintenta: se devuelve tal cual", async () => {
    const { f, llamadas } = fetchFalso([new Response("", { status: 404 }), new Response("ok")]);
    assert.equal((await fetchConReintentos(f, sinEsperar)("https://x")).status, 404);
    assert.equal(llamadas(), 1);
  });

  it("un error que no es de red no se reintenta", async () => {
    const { f, llamadas } = fetchFalso([new RangeError("dirección inválida"), new Response("ok")]);
    await assert.rejects(fetchConReintentos(f, sinEsperar)("https://x"), RangeError);
    assert.equal(llamadas(), 1);
  });

  it("se rinde después de los intentos y deja ver el último error", async () => {
    const { f, llamadas } = fetchFalso([cortado()]);
    await assert.rejects(fetchConReintentos(f, { ...sinEsperar, intentos: 4 })("https://x"), /fetch failed/);
    assert.equal(llamadas(), 4);
  });

  it("si el servidor sigue caído devuelve su última respuesta", async () => {
    const { f, llamadas } = fetchFalso([new Response("", { status: 502 })]);
    const res = await fetchConReintentos(f, { ...sinEsperar, intentos: 3 })("https://x");
    assert.equal(res.status, 502);
    assert.equal(llamadas(), 3);
  });

  it("espera cada vez el doble", async () => {
    const esperas: number[] = [];
    const { f } = fetchFalso([cortado(), cortado(), cortado(), new Response("ok")]);
    await fetchConReintentos(f, {
      esperaInicialMs: 100,
      dormir: async (ms) => void esperas.push(ms),
      alReintentar: () => {},
    })("https://x");
    assert.deepEqual(esperas, [100, 200, 400]);
  });
});

describe("enParalelo", () => {
  it("nunca tiene más de `limite` tareas a la vez y las hace todas", async () => {
    let activas = 0;
    let maximo = 0;
    const hechas: number[] = [];
    await enParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((r) => setTimeout(r, 5));
      hechas.push(n);
      activas--;
    });
    assert.equal(maximo, 3);
    assert.deepEqual(hechas.sort(), [1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("esArchivoDeFuente", () => {
  const con = (cabecera: number[]) => Uint8Array.from([...cabecera, ...new Array(2000).fill(0)]);

  it("reconoce TrueType, OpenType y WOFF", () => {
    assert.equal(esArchivoDeFuente(con([0x00, 0x01, 0x00, 0x00])), true);
    for (const firma of ["OTTO", "true", "wOFF", "wOF2"]) {
      assert.equal(esArchivoDeFuente(con([...firma].map((c) => c.charCodeAt(0)))), true, firma);
    }
  });

  it("rechaza una página de error y un archivo vacío", () => {
    assert.equal(esArchivoDeFuente(new TextEncoder().encode("<!DOCTYPE html>" + " ".repeat(2000))), false);
    assert.equal(esArchivoDeFuente(new Uint8Array(0)), false);
  });
});
