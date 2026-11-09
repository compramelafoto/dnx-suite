import { describe, expect, it } from "vitest";
import { buscarLugares } from "./places";

type Pedido = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

/** Un `fetch` falso que devuelve las respuestas en orden y anota cada pedido. */
function fetchFalso(respuestas: Array<{ status: number; json: unknown }>) {
  const pedidos: Pedido[] = [];
  let i = 0;
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({
      url: String(url),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { f, pedidos };
}

const lugar = (n: number) => ({
  id: `place-${n}`,
  displayName: { text: `Estudio ${n}`, languageCode: "es" },
  websiteUri: `https://estudio${n}.com.ar`,
  formattedAddress: `Calle ${n}, Rosario`,
});

describe("buscarLugares", () => {
  it("manda la clave, el field mask y es/AR", async () => {
    const { f, pedidos } = fetchFalso([{ status: 200, json: { places: [lugar(1), { id: "place-2", displayName: { text: "Sin web" } }] } }]);
    const r = await buscarLugares("estudio fotográfico en Rosario", { paginas: 1, region: "ar" }, { fetch: f, clave: "CLAVE-PRUEBA" });

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(pedidos[0].headers["x-goog-api-key"]).toBe("CLAVE-PRUEBA");
    expect(pedidos[0].headers["x-goog-fieldmask"]).toBe("places.id,places.displayName,places.websiteUri,places.formattedAddress,nextPageToken");
    expect(pedidos[0].body).toEqual({ textQuery: "estudio fotográfico en Rosario", languageCode: "es", regionCode: "AR" });
    expect(r).toEqual({
      lugares: [
        { placeId: "place-1", nombre: "Estudio 1", web: "https://estudio1.com.ar", direccion: "Calle 1, Rosario", lat: null, lng: null },
        { placeId: "place-2", nombre: "Sin web", web: null, direccion: null, lat: null, lng: null },
      ],
      llamadas: { TEXT_SEARCH_ENTERPRISE: 1 },
    });
  });

  it("pagina hasta 3 con nextPageToken", async () => {
    const { f, pedidos } = fetchFalso([
      { status: 200, json: { places: [lugar(1)], nextPageToken: "t1" } },
      { status: 200, json: { places: [lugar(2)], nextPageToken: "t2" } },
      { status: 200, json: { places: [lugar(3)], nextPageToken: "t3" } },
      { status: 200, json: { places: [lugar(4)] } },
    ]);
    const r = await buscarLugares("fotógrafos", { paginas: 3 }, { fetch: f, clave: "k" });

    expect(pedidos).toHaveLength(3);
    expect(pedidos[0].body.pageToken).toBeUndefined();
    expect(pedidos[1].body.pageToken).toBe("t1");
    expect(pedidos[2].body.pageToken).toBe("t2");
    expect(pedidos[2].body.textQuery).toBe("fotógrafos");
    if ("error" in r) throw new Error("no debía fallar");
    expect(r.lugares.map((l) => l.placeId)).toEqual(["place-1", "place-2", "place-3"]);
    expect(r.llamadas).toEqual({ TEXT_SEARCH_ENTERPRISE: 3 });
  });

  it("corta antes si no viene nextPageToken", async () => {
    const { f, pedidos } = fetchFalso([{ status: 200, json: { places: [lugar(1)] } }]);
    const r = await buscarLugares("fotógrafos", { paginas: 3 }, { fetch: f, clave: "k" });
    expect(pedidos).toHaveLength(1);
    expect(r).toMatchObject({ llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } });
  });

  it("sin clave devuelve SIN_CLAVE sin llamar", async () => {
    const { f, pedidos } = fetchFalso([{ status: 200, json: {} }]);
    const anterior = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    try {
      const r = await buscarLugares("x", { paginas: 1 }, { fetch: f });
      expect(r).toMatchObject({ error: "SIN_CLAVE" });
      const r2 = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: null });
      expect(r2).toMatchObject({ error: "SIN_CLAVE" });
    } finally {
      if (anterior !== undefined) process.env.GOOGLE_PLACES_API_KEY = anterior;
    }
    expect(pedidos).toHaveLength(0);
  });

  it("429 devuelve CUOTA", async () => {
    const { f } = fetchFalso([{ status: 429, json: { error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } } }]);
    const r = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: "k" });
    expect(r).toMatchObject({ error: "CUOTA" });
  });

  it("RESOURCE_EXHAUSTED en el cuerpo también es CUOTA", async () => {
    const { f } = fetchFalso([{ status: 403, json: { error: { code: 403, message: "Quota", status: "RESOURCE_EXHAUSTED" } } }]);
    const r = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: "k" });
    expect(r).toMatchObject({ error: "CUOTA" });
  });

  it("otro error HTTP devuelve HTTP con el código y sin la clave", async () => {
    const { f } = fetchFalso([{ status: 400, json: { error: { code: 400, message: "API key not valid: CLAVE-SECRETA", status: "INVALID_ARGUMENT" } } }]);
    const r = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: "CLAVE-SECRETA" });
    expect(r).toMatchObject({ error: "HTTP" });
    if (!("error" in r)) throw new Error("debía fallar");
    expect(r.detalle).toContain("400");
    expect(r.detalle).not.toContain("CLAVE-SECRETA");
  });

  it("si falla una página siguiente, el error informa las llamadas ya cobradas", async () => {
    const { f } = fetchFalso([
      { status: 200, json: { places: [lugar(1)], nextPageToken: "t1" } },
      { status: 500, json: { error: { code: 500, message: "Internal", status: "INTERNAL" } } },
    ]);
    const r = await buscarLugares("x", { paginas: 3 }, { fetch: f, clave: "k" });
    expect(r).toMatchObject({ error: "HTTP", llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } });
  });
  it("401 o 403 (API sin habilitar, clave sin permiso) devuelven ACCESO", async () => {
    for (const status of [401, 403]) {
      const { f } = fetchFalso([{ status, json: { error: { code: status, message: "Places API (New) has not been used", status: "PERMISSION_DENIED" } } }]);
      const r = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: "k" });
      expect(r).toMatchObject({ error: "ACCESO" });
    }
  });

  it("una clave inválida (400 con API_KEY_INVALID) también es ACCESO", async () => {
    const { f } = fetchFalso([
      { status: 400, json: { error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } } },
    ]);
    const r = await buscarLugares("x", { paginas: 1 }, { fetch: f, clave: "k" });
    expect(r).toMatchObject({ error: "ACCESO" });
  });

  it("si el pedido se corta por tiempo o red, la llamada se cuenta igual", async () => {
    const f = (async () => {
      throw Object.assign(new Error("tiempo"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    const r = await buscarLugares("x", { paginas: 2 }, { fetch: f, clave: "k" });
    expect(r).toMatchObject({ error: "HTTP", llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } });
  });
});
