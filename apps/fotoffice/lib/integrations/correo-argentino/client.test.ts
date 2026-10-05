import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MICORREO_BASE_URLS,
  createMiCorreoClient,
  parseMiCorreoExpires,
  parseMiCorreoPriceToMinor,
  resetMiCorreoTokenCacheForTests,
} from "./client";
import { MiCorreoError } from "./errors";

/**
 * Las respuestas de estos tests salen tal cual de la referencia
 * (`docs/integraciones/correo-argentino-micorreo-api.md`). Ningún test sale a la red: todo
 * pasa por un `fetchImpl` falso que registra las llamadas.
 */

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null };
type Handler = (call: Call) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(routes: Record<string, Handler | Handler[]>) {
  const calls: Call[] = [];
  const counters: Record<string, number> = {};
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const call: Call = { url, method, headers, body: (init?.body as string) ?? null };
    calls.push(call);
    const path = new URL(url).pathname.replace("/micorreo/v1", "");
    const key = `${method} ${path}`;
    const route = routes[key];
    if (!route) throw new Error(`ruta no simulada: ${key}`);
    if (Array.isArray(route)) {
      const i = counters[key] ?? 0;
      counters[key] = i + 1;
      return route[Math.min(i, route.length - 1)]!(call);
    }
    return route(call);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

// 2022-04-26 21:16:20 en hora argentina = 2022-04-27T00:16:20Z.
const TOKEN_OK = () => json(200, { token: "jwt-1", expires: "2022-04-26 21:16:20" });
const NOW_ANTES = new Date("2022-04-26T23:00:00Z"); // 1 h 16 min antes del vencimiento

const base = { env: "TEST" as const, apiUser: "api-user", apiPassword: "api-secreta" };

beforeEach(() => resetMiCorreoTokenCacheForTests());
afterEach(() => vi.useRealTimers());

describe("URLs por ambiente", () => {
  it("pruebas y producción son las de la referencia", () => {
    expect(MICORREO_BASE_URLS.TEST).toBe("https://apitest.correoargentino.com.ar/micorreo/v1");
    expect(MICORREO_BASE_URLS.PROD).toBe("https://api.correoargentino.com.ar/micorreo/v1");
  });

  it("producción pega contra la URL de producción", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK });
    await createMiCorreoClient({ ...base, env: "PROD", fetchImpl: f.impl, now: () => NOW_ANTES }).getToken();
    expect(f.calls[0]!.url).toBe("https://api.correoargentino.com.ar/micorreo/v1/token");
  });
});

describe("token", () => {
  it("pide el token con Basic Auth y sin cuerpo", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.getToken()).toBe("jwt-1");
    expect(f.calls[0]!.url).toBe("https://apitest.correoargentino.com.ar/micorreo/v1/token");
    expect(f.calls[0]!.headers.authorization).toBe(
      `Basic ${Buffer.from("api-user:api-secreta").toString("base64")}`,
    );
    expect(f.calls[0]!.body).toBeNull();
  });

  it("lo reutiliza hasta 60 s antes de que venza", async () => {
    let now = NOW_ANTES;
    const f = fakeFetch({
      "POST /token": [TOKEN_OK, () => json(200, { token: "jwt-2", expires: "2022-04-27 00:00:00" })],
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => now });
    await client.getToken();
    now = new Date("2022-04-27T00:15:19Z"); // 61 s antes
    expect(await client.getToken()).toBe("jwt-1");
    expect(f.calls).toHaveLength(1);
    now = new Date("2022-04-27T00:15:20Z"); // justo 60 s antes: se renueva
    expect(await client.getToken()).toBe("jwt-2");
    expect(f.calls).toHaveLength(2);
  });

  it("la caché es por ambiente y usuario, compartida entre clientes", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK });
    const opts = { fetchImpl: f.impl, now: () => NOW_ANTES };
    await createMiCorreoClient({ ...base, ...opts }).getToken();
    await createMiCorreoClient({ ...base, ...opts }).getToken();
    expect(f.calls).toHaveLength(1);
    await createMiCorreoClient({ ...base, env: "PROD", ...opts }).getToken();
    await createMiCorreoClient({ ...base, apiUser: "otro", ...opts }).getToken();
    expect(f.calls).toHaveLength(3);
  });

  it("si `expires` no se entiende, cachea 10 minutos", async () => {
    let now = NOW_ANTES;
    const f = fakeFetch({ "POST /token": () => json(200, { token: "jwt-x", expires: "mañana" }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => now });
    await client.getToken();
    now = new Date(NOW_ANTES.getTime() + 8 * 60_000);
    await client.getToken();
    expect(f.calls).toHaveLength(1);
    now = new Date(NOW_ANTES.getTime() + 9 * 60_000); // 10 min − 60 s
    await client.getToken();
    expect(f.calls).toHaveLength(2);
  });

  it("credenciales de API inválidas → AUTH, sin la clave en el mensaje", async () => {
    const f = fakeFetch({ "POST /token": () => json(401, { code: "401", message: "Unauthorized" }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const error = await client.getToken().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MiCorreoError);
    expect((error as MiCorreoError).kind).toBe("AUTH");
    expect((error as MiCorreoError).message).not.toContain("api-secreta");
    expect((error as MiCorreoError).message).not.toContain("api-user");
  });

  it("respuesta sin token → UNEXPECTED", async () => {
    const f = fakeFetch({ "POST /token": () => json(200, { expires: "2022-04-26 21:16:20" }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    await expect(client.getToken()).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });
});

describe("parseMiCorreoExpires", () => {
  it("sin zona se toma como hora argentina", () => {
    expect(parseMiCorreoExpires("2022-04-26 21:16:20")?.toISOString()).toBe(
      "2022-04-27T00:16:20.000Z",
    );
  });
  it("con zona explícita la respeta", () => {
    expect(parseMiCorreoExpires("2022-04-26T21:16:20Z")?.toISOString()).toBe(
      "2022-04-26T21:16:20.000Z",
    );
  });
  it("lo que no es fecha da null", () => {
    expect(parseMiCorreoExpires("mañana")).toBeNull();
    expect(parseMiCorreoExpires(undefined)).toBeNull();
    expect(parseMiCorreoExpires(12)).toBeNull();
  });
});

describe("validateUser", () => {
  it("manda email y contraseña con Bearer y devuelve el customerId como texto", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /users/validate": () => json(200, { customerId: "0090000025", createdAt: "2021-03-10" }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.validateUser("email2@mail.com", "secret")).toEqual({ customerId: "0090000025" });
    const call = f.calls[1]!;
    expect(call.headers.authorization).toBe("Bearer jwt-1");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(call.body!)).toEqual({ email: "email2@mail.com", password: "secret" });
  });

  it("un customerId numérico recupera los ceros a la izquierda", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /users/validate": () => json(200, { customerId: 90000025 }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.validateUser("a@b.com", "x")).toEqual({ customerId: "0090000025" });
  });

  it("usuario inexistente (404) → BUSINESS con el mensaje de Correo, sin la contraseña", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /users/validate": () =>
        json(404, { code: "404", message: "Usuario no valido o inexistente" }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const error = (await client.validateUser("a@b.com", "clave-cuenta").catch((e) => e)) as MiCorreoError;
    expect(error.kind).toBe("BUSINESS");
    expect(error.status).toBe(404);
    expect(error.message).toContain("Usuario no valido o inexistente");
    expect(error.message).not.toContain("clave-cuenta");
  });

  it("si el token venció antes de lo esperado (401), lo renueva y reintenta una vez", async () => {
    const f = fakeFetch({
      "POST /token": [TOKEN_OK, () => json(200, { token: "jwt-2", expires: "2022-04-26 21:16:20" })],
      "POST /users/validate": [
        () => json(401, { code: "401", message: "Unauthorized" }),
        () => json(200, { customerId: "0090000025" }),
      ],
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.validateUser("a@b.com", "x")).toEqual({ customerId: "0090000025" });
    expect(f.calls.map((c) => c.headers.authorization?.split(" ")[0])).toEqual([
      "Basic",
      "Bearer",
      "Basic",
      "Bearer",
    ]);
    expect(f.calls[3]!.headers.authorization).toBe("Bearer jwt-2");
  });

  it("dos 401 seguidos → AUTH", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /users/validate": () => json(401, { code: "401", message: "Unauthorized" }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    await expect(client.validateUser("a@b.com", "x")).rejects.toMatchObject({ kind: "AUTH" });
  });
});

describe("rates", () => {
  const pedido = {
    customerId: "0000550137",
    postalCodeOrigin: "1757",
    postalCodeDestination: "1704",
    dimensions: { weight: 2500, height: 10, width: 20, length: 30 },
  };

  it("manda el cuerpo con los nombres de la referencia y convierte el precio a centavos", async () => {
    const respuesta = {
      customerId: "0000550997",
      validTo: "2022-06-07T10:31:27.881-03:00",
      rates: [
        { deliveredType: "D", productType: "CP", productName: "Paq.ar Clásico", price: 498.06 },
        { deliveredType: "S", productType: "CP", productName: "Paq.ar Clásico", price: 398.06 },
      ],
    };
    const f = fakeFetch({ "POST /token": TOKEN_OK, "POST /rates": () => json(200, respuesta) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const rates = await client.rates(pedido);
    expect(JSON.parse(f.calls[1]!.body!)).toEqual(pedido); // sin deliveredType: pide ambas
    expect(rates).toEqual([
      { deliveredType: "D", productName: "Paq.ar Clásico", priceMinor: 49806, raw: respuesta.rates[0] },
      { deliveredType: "S", productName: "Paq.ar Clásico", priceMinor: 39806, raw: respuesta.rates[1] },
    ]);
  });

  it("con deliveredType lo manda, y redondea las medidas hacia arriba a enteros", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /rates": () =>
        json(200, { rates: [{ deliveredType: "S", productName: "Paq.ar Clásico", price: "398,06" }] }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const rates = await client.rates({
      ...pedido,
      deliveredType: "S",
      dimensions: { weight: 2500.2, height: 9.1, width: 20, length: 30 },
    });
    const body = JSON.parse(f.calls[1]!.body!);
    expect(body.deliveredType).toBe("S");
    expect(body.dimensions).toEqual({ weight: 2501, height: 10, width: 20, length: 30 });
    expect(rates[0]!.priceMinor).toBe(39806);
  });

  it("ignora modalidades que no son D ni S", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /rates": () =>
        json(200, {
          rates: [
            { deliveredType: "X", productName: "Otra", price: 1 },
            { deliveredType: "D", productName: "Paq.ar Clásico", price: 10 },
          ],
        }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect((await client.rates(pedido)).map((r) => r.deliveredType)).toEqual(["D"]);
  });

  it("sin productName usa productType", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /rates": () => json(200, { rates: [{ deliveredType: "D", productType: "CP", price: 10 }] }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect((await client.rates(pedido))[0]!.productName).toBe("CP");
  });

  it("rates vacío es una respuesta válida", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK, "POST /rates": () => json(200, { rates: [] }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.rates(pedido)).toEqual([]);
  });

  it("precio negativo o no numérico → UNEXPECTED", async () => {
    for (const price of [-5, "abc", null]) {
      resetMiCorreoTokenCacheForTests();
      const f = fakeFetch({
        "POST /token": TOKEN_OK,
        "POST /rates": () => json(200, { rates: [{ deliveredType: "D", productName: "P", price }] }),
      });
      const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
      await expect(client.rates(pedido)).rejects.toMatchObject({ kind: "UNEXPECTED" });
    }
  });

  it("sin arreglo `rates` → UNEXPECTED", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK, "POST /rates": () => json(200, { hola: 1 }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    await expect(client.rates(pedido)).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });

  it("cliente no identificado (402) → BUSINESS, tolerando la coma final del JSON de la doc", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "POST /rates": () => json(402, '{"code": "402", "message": "Cliente FAP no identificado 0000550137",}'),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const error = (await client.rates(pedido).catch((e) => e)) as MiCorreoError;
    expect(error.kind).toBe("BUSINESS");
    expect(error.message).toContain("Cliente FAP no identificado");
  });
});

describe("parseMiCorreoPriceToMinor", () => {
  it.each([
    [498.06, 49806],
    [398, 39800],
    ["498.06", 49806],
    ["498,06", 49806],
    ["1.234,56", 123456],
    [" 10,5 ", 1050],
    [0.1 + 0.2, 30],
    [0, 0],
  ])("%s → %s centavos", (input, esperado) => {
    expect(parseMiCorreoPriceToMinor(input)).toBe(esperado);
  });

  it.each([[-1], ["-1"], ["abc"], [""], [null], [undefined], [Number.NaN], [Infinity], [{}]])(
    "%s → null",
    (input) => {
      expect(parseMiCorreoPriceToMinor(input)).toBeNull();
    },
  );
});

describe("agencies", () => {
  const sucursal = {
    code: "B0107",
    name: "Monte Grande",
    manager: "Denardo, Matías Gabriel",
    email: "sopoficina@correoargentino.com.ar",
    phone: "(03401) 448396",
    services: { packageReception: true, pickupAvailability: true },
    location: {
      address: {
        streetName: "Vicente Lopez",
        streetNumber: "448",
        floor: null,
        apartment: null,
        locality: "Monte Grande",
        city: "Esteban Echeverria",
        province: "Buenos Aires",
        provinceCode: "B",
        postalCode: "B1842ZAB",
      },
      latitude: "-34.81939997",
      longitude: "-58.46747615",
    },
    hours: { sunday: null, monday: { start: "0930", end: "1800" } },
    status: "ACTIVE",
  };

  it("es un GET con los parámetros en la query y mapea la sucursal", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK, "GET /agencies": () => json(200, [sucursal]) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    const agencias = await client.agencies({ customerId: "0090000025", provinceCode: "B" });
    const url = new URL(f.calls[1]!.url);
    expect(url.pathname).toBe("/micorreo/v1/agencies");
    expect(url.searchParams.get("customerId")).toBe("0090000025");
    expect(url.searchParams.get("provinceCode")).toBe("B");
    expect(f.calls[1]!.body).toBeNull();
    expect(agencias).toEqual([
      {
        id: "B0107",
        name: "Monte Grande",
        address: "Vicente Lopez 448",
        city: "Monte Grande",
        postalCode: "B1842ZAB",
      },
    ]);
  });

  it("descarta las inactivas, las que no entregan al público y las que no tienen código", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "GET /agencies": () =>
        json(200, [
          sucursal,
          { ...sucursal, code: "B0108", status: "INACTIVE" },
          { ...sucursal, code: "B0109", services: { packageReception: true, pickupAvailability: false } },
          { ...sucursal, code: undefined },
        ]),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect((await client.agencies({ customerId: "1", provinceCode: "B" })).map((a) => a.id)).toEqual([
      "B0107",
    ]);
  });

  it("tolera la lista envuelta en `agencies` y datos faltantes", async () => {
    const f = fakeFetch({
      "POST /token": TOKEN_OK,
      "GET /agencies": () =>
        json(200, { agencies: [{ code: "C0001", name: "Centro", location: { address: { city: "CABA" } } }] }),
    });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    expect(await client.agencies({ customerId: "1", provinceCode: "C" })).toEqual([
      { id: "C0001", name: "Centro", address: "", city: "CABA", postalCode: "" },
    ]);
  });

  it("respuesta que no es lista → UNEXPECTED", async () => {
    const f = fakeFetch({ "POST /token": TOKEN_OK, "GET /agencies": () => json(200, { hola: 1 }) });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    await expect(client.agencies({ customerId: "1", provinceCode: "B" })).rejects.toMatchObject({
      kind: "UNEXPECTED",
    });
  });
});

describe("errores", () => {
  async function errorPara(response: () => Response | Promise<Response>) {
    const f = fakeFetch({ "POST /token": TOKEN_OK, "POST /rates": response });
    const client = createMiCorreoClient({ ...base, fetchImpl: f.impl, now: () => NOW_ANTES });
    return (await client
      .rates({
        customerId: "1",
        postalCodeOrigin: "2000",
        postalCodeDestination: "1704",
        dimensions: { weight: 1, height: 1, width: 1, length: 1 },
      })
      .catch((e) => e)) as MiCorreoError;
  }

  it("403 → AUTH", async () => {
    expect((await errorPara(() => json(403, { code: "403", message: "Forbidden" }))).kind).toBe("AUTH");
  });

  it.each([400, 402, 404, 409])("%s con code y message → BUSINESS", async (status) => {
    const e = await errorPara(() => json(status, { code: String(status), message: "Algo de negocio" }));
    expect(e.kind).toBe("BUSINESS");
    expect(e.message).toContain("Algo de negocio");
  });

  it("402 sin cuerpo entendible → UNEXPECTED", async () => {
    expect((await errorPara(() => new Response("<html>", { status: 402 }))).kind).toBe("UNEXPECTED");
  });

  it("429 → RATE_LIMIT", async () => {
    expect((await errorPara(() => json(429, { code: "429", message: "Too Many" }))).kind).toBe("RATE_LIMIT");
  });

  it("500 → UNEXPECTED", async () => {
    expect((await errorPara(() => json(500, { code: "500", message: "Error" }))).kind).toBe("UNEXPECTED");
  });

  it("200 con cuerpo que no es JSON → UNEXPECTED", async () => {
    expect((await errorPara(() => new Response("no json", { status: 200 }))).kind).toBe("UNEXPECTED");
  });

  it("fetch que rechaza → NETWORK", async () => {
    const e = await errorPara(() => {
      throw new TypeError("fetch failed");
    });
    expect(e.kind).toBe("NETWORK");
  });

  it("corta a los 8 segundos → NETWORK", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const impl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/token")) return Promise.resolve(TOKEN_OK());
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      });
    });
    const client = createMiCorreoClient({
      ...base,
      fetchImpl: impl as unknown as typeof fetch,
      now: () => NOW_ANTES,
    });
    const promesa = client.agencies({ customerId: "1", provinceCode: "B" }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const e = (await promesa) as MiCorreoError;
    expect(e.kind).toBe("NETWORK");
    expect(signal?.aborted).toBe(true);
  });
});
