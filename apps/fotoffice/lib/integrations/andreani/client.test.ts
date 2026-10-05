import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANDREANI_BASE_URLS,
  createAndreaniClient,
  parseAndreaniPriceToMinor,
  resetAndreaniTokenCacheForTests,
} from "./client";
import { AndreaniError } from "./errors";

/**
 * Las respuestas salen de la referencia (`docs/integraciones/andreani-api.md`). Ningún test
 * sale a la red: todo pasa por un `fetchImpl` falso que registra las llamadas.
 */

type Call = { url: string; method: string; headers: Record<string, string> };
type Handler = (call: Call) => Response | Promise<Response>;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function fakeFetch(routes: Record<string, Handler | Handler[]>) {
  const calls: Call[] = [];
  const counters: Record<string, number> = {};
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const call: Call = { url, method, headers };
    calls.push(call);
    const key = `${method} ${new URL(url).pathname}`;
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

/** El login no documenta cuerpo: el token viene en el encabezado. */
const login = (token: string) => () =>
  new Response("", { status: 200, headers: { "x-authorization-token": token } });
const LOGIN_OK = login("tok-1");

const TARIFA_OK = () =>
  json(200, {
    pesoAforado: "70.00",
    tarifaSinIva: { seguroDistribucion: "12.21", distribucion: "5806.97", total: "5819.18" },
    tarifaConIva: { seguroDistribucion: "14.77", distribucion: "7026.43", total: "7041.21" },
  });

const NOW = new Date("2026-10-05T15:00:00Z");
const base = { env: "QA" as const, user: "usuario-api", password: "clave-secreta" };

const cotizacion = {
  clientCode: "CL0003750",
  contract: "300006611",
  postalCodeDestination: "1832",
  packages: [{ weightKg: 1.3, lengthCm: 30, widthCm: 20, heightCm: 10, declaredValueMinor: 120000 }],
};

beforeEach(() => resetAndreaniTokenCacheForTests());
afterEach(() => vi.useRealTimers());

describe("URLs por ambiente", () => {
  it("QA y producción son las de la referencia", () => {
    expect(ANDREANI_BASE_URLS.QA).toBe("https://apisqa.andreani.com");
    expect(ANDREANI_BASE_URLS.PROD).toBe("https://apis.andreani.com");
  });

  it("producción pega contra la URL de producción", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK });
    await createAndreaniClient({ ...base, env: "PROD", fetchImpl: f.impl, now: () => NOW }).getToken();
    expect(f.calls[0]!.url).toBe("https://apis.andreani.com/login");
  });

  it("un ambiente inventado no se acepta", () => {
    expect(() => createAndreaniClient({ ...base, env: "STAGING" as unknown as "QA" })).toThrow(AndreaniError);
  });
});

describe("token", () => {
  it("hace GET /login con Basic y toma el token del encabezado x-authorization-token", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(await client.getToken()).toBe("tok-1");
    expect(f.calls[0]).toMatchObject({ url: "https://apisqa.andreani.com/login", method: "GET" });
    expect(f.calls[0]!.headers.authorization).toBe(
      `Basic ${Buffer.from("usuario-api:clave-secreta").toString("base64")}`,
    );
  });

  it("si el encabezado no viene pero el cuerpo trae `token`, lo acepta", async () => {
    const f = fakeFetch({ "GET /login": () => json(200, { token: "del-cuerpo" }) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(await client.getToken()).toBe("del-cuerpo");
  });

  it("sin token en la respuesta → UNEXPECTED", async () => {
    const f = fakeFetch({ "GET /login": () => json(200, { ok: true }) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.getToken()).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });

  it("lo reutiliza 24 h menos 60 s, y después pide otro", async () => {
    const f = fakeFetch({ "GET /login": [login("tok-1"), login("tok-2")] });
    let ahora = NOW.getTime();
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => new Date(ahora) });
    expect(await client.getToken()).toBe("tok-1");
    ahora += 24 * 3600_000 - 61_000;
    expect(await client.getToken()).toBe("tok-1");
    ahora += 2_000; // ya dentro del último minuto
    expect(await client.getToken()).toBe("tok-2");
    expect(f.calls).toHaveLength(2);
  });

  it("la caché es por ambiente + usuario + hash de la clave, compartida entre clientes", async () => {
    const f = fakeFetch({ "GET /login": [login("tok-1"), login("tok-2"), login("tok-3")] });
    const opts = { fetchImpl: f.impl, now: () => NOW };
    expect(await createAndreaniClient({ ...base, ...opts }).getToken()).toBe("tok-1");
    expect(await createAndreaniClient({ ...base, ...opts }).getToken()).toBe("tok-1");
    expect(await createAndreaniClient({ ...base, ...opts, env: "PROD" }).getToken()).toBe("tok-2");
    // Mismo usuario, otra clave: NO reusa el token de la primera.
    expect(await createAndreaniClient({ ...base, ...opts, password: "otra" }).getToken()).toBe("tok-3");
    expect(f.calls).toHaveLength(3);
  });

  it("la clave de caché lleva el sha256 de la contraseña, nunca la contraseña", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(client.cacheKey).toBe(
      `QA:usuario-api:${createHash("sha256").update("clave-secreta", "utf8").digest("hex")}`,
    );
    expect(client.cacheKey).not.toContain("clave-secreta");
  });

  it("getToken({ fresh: true }) ignora la caché", async () => {
    const f = fakeFetch({ "GET /login": [login("tok-1"), login("tok-2")] });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await client.getToken();
    expect(await client.getToken({ fresh: true })).toBe("tok-2");
    expect(await client.getToken()).toBe("tok-2");
  });

  it("credenciales inválidas (401) → AUTH, sin la clave ni el usuario en el mensaje", async () => {
    const f = fakeFetch({ "GET /login": () => json(401, { message: "Credenciales incorrectas" }) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    const e = (await client.getToken().catch((x) => x)) as AndreaniError;
    expect(e).toBeInstanceOf(AndreaniError);
    expect(e.kind).toBe("AUTH");
    expect(e.status).toBe(401);
    expect(e.message).not.toContain("clave-secreta");
    expect(e.message).not.toContain("usuario-api");
  });
});

describe("quote", () => {
  it("arma los parámetros de la referencia y devuelve tarifaConIva.total en centavos", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v1/tarifas": TARIFA_OK });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    const r = await client.quote({ ...cotizacion, originBranch: "SFN" });
    expect(r.priceMinor).toBe(704121);
    expect(r.raw).toMatchObject({ pesoAforado: "70.00" });

    const llamada = f.calls[1]!;
    expect(llamada.headers["x-authorization-token"]).toBe("tok-1");
    expect(llamada.headers.authorization).toBeUndefined();
    const q = new URL(llamada.url).searchParams;
    expect(Object.fromEntries(q.entries())).toEqual({
      cpDestino: "1832",
      contrato: "300006611",
      cliente: "CL0003750",
      sucursalOrigen: "SFN",
      "bultos[0][kilos]": "1.3",
      "bultos[0][largoCm]": "30",
      "bultos[0][anchoCm]": "20",
      "bultos[0][altoCm]": "10",
      "bultos[0][volumen]": "6000",
      "bultos[0][valorDeclarado]": "1200.00",
    });
  });

  it("sin sucursal de origen no la manda; varios bultos van indexados; medidas hacia arriba", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v1/tarifas": TARIFA_OK });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await client.quote({
      ...cotizacion,
      packages: [
        { weightKg: 0.25, lengthCm: 10.2, widthCm: 10, heightCm: 5, declaredValueMinor: 0 },
        { weightKg: 2, lengthCm: 40, widthCm: 30, heightCm: 20, declaredValueMinor: 5050 },
      ],
    });
    const q = new URL(f.calls[1]!.url).searchParams;
    expect(q.has("sucursalOrigen")).toBe(false);
    expect(q.get("bultos[0][largoCm]")).toBe("11");
    expect(q.get("bultos[0][volumen]")).toBe("550");
    expect(q.get("bultos[0][kilos]")).toBe("0.25");
    expect(q.get("bultos[0][valorDeclarado]")).toBe("0.00");
    expect(q.get("bultos[1][kilos]")).toBe("2");
    expect(q.get("bultos[1][volumen]")).toBe("24000");
    expect(q.get("bultos[1][valorDeclarado]")).toBe("50.50");
  });

  it("sin bultos o con medidas inválidas → BUSINESS sin salir a la red", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v1/tarifas": TARIFA_OK });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.quote({ ...cotizacion, packages: [] })).rejects.toMatchObject({ kind: "BUSINESS" });
    await expect(
      client.quote({ ...cotizacion, packages: [{ ...cotizacion.packages[0]!, weightKg: 0 }] }),
    ).rejects.toMatchObject({ kind: "BUSINESS" });
    expect(f.calls).toHaveLength(0);
  });

  it.each([
    ["7041.21", 704121],
    ["7041,21", 704121],
    ["7.041,21", 704121],
    ["7,041.21", 704121],
    [7041.21, 704121],
    ["5819", 581900],
  ])("total %s → %s centavos", async (total, esperado) => {
    const f = fakeFetch({
      "GET /login": LOGIN_OK,
      "GET /v1/tarifas": () => json(200, { tarifaConIva: { total } }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect((await client.quote(cotizacion)).priceMinor).toBe(esperado);
  });

  it.each([["0"], [0], ["-5"], ["abc"], [null], [""]])("total %s → UNEXPECTED", async (total) => {
    const f = fakeFetch({
      "GET /login": LOGIN_OK,
      "GET /v1/tarifas": () => json(200, { tarifaConIva: { total } }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.quote(cotizacion)).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });

  it("sin tarifaConIva → UNEXPECTED", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v1/tarifas": () => json(200, { pesoAforado: "1" }) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.quote(cotizacion)).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });

  it("401 con un token que creíamos vigente: pide uno nuevo y reintenta una vez", async () => {
    const f = fakeFetch({
      "GET /login": [login("tok-1"), login("tok-2")],
      "GET /v1/tarifas": [() => json(401, { message: "Unauthorized" }), TARIFA_OK],
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect((await client.quote(cotizacion)).priceMinor).toBe(704121);
    expect(f.calls.map((c) => `${new URL(c.url).pathname} ${c.headers["x-authorization-token"] ?? ""}`)).toEqual([
      "/login ",
      "/v1/tarifas tok-1",
      "/login ",
      "/v1/tarifas tok-2",
    ]);
  });

  it("dos 401 seguidos → AUTH", async () => {
    const f = fakeFetch({
      "GET /login": [login("tok-1"), login("tok-2")],
      "GET /v1/tarifas": () => json(401, { message: "Unauthorized" }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.quote(cotizacion)).rejects.toMatchObject({ kind: "AUTH", status: 401 });
    expect(f.calls.filter((c) => c.url.includes("/v1/tarifas"))).toHaveLength(2);
  });

  it("400 ProblemDetails → BUSINESS con detail, sin reintentar", async () => {
    const f = fakeFetch({
      "GET /login": LOGIN_OK,
      "GET /v1/tarifas": () =>
        json(400, {
          type: "about:blank",
          title: "Error en la validacion de su pedido",
          detail: "No se pudo obtener la tarifa",
          status: 400,
          errors: null,
        }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    const e = (await client.quote(cotizacion).catch((x) => x)) as AndreaniError;
    expect(e.kind).toBe("BUSINESS");
    expect(e.status).toBe(400);
    expect(e.message).toContain("No se pudo obtener la tarifa");
    expect(f.calls).toHaveLength(2);
  });
});

describe("parseAndreaniPriceToMinor", () => {
  it("recorta a dos decimales sin redondear y rechaza lo que no es importe", () => {
    expect(parseAndreaniPriceToMinor("10.999")).toBe(1099);
    expect(parseAndreaniPriceToMinor(" 12,5 ")).toBe(1250);
    expect(parseAndreaniPriceToMinor("1.234.567,89")).toBe(123456789);
    expect(parseAndreaniPriceToMinor("1,234,567.89")).toBe(123456789);
    expect(parseAndreaniPriceToMinor(Number.NaN)).toBeNull();
    expect(parseAndreaniPriceToMinor("12a")).toBeNull();
    expect(parseAndreaniPriceToMinor({})).toBeNull();
  });
});

describe("branches", () => {
  const SUCURSAL = {
    id: 10055,
    codigo: "SFN",
    numero: "55",
    descripcion: "SANTA FE (CENTRO)",
    canal: "B2C",
    direccion: {
      calle: "25 de Mayo",
      numero: "3340",
      provincia: "Santa Fe",
      localidad: "Santa Fe",
      region: "Litoral",
      pais: "Argentina",
      codigoPostal: "3000",
    },
    datosAdicionales: { seHaceAtencionAlCliente: true, tipo: "SUCURSAL", admiteEnvios: true, entregaEnvios: true },
  };

  it("GET /v2/sucursales con codigoPostal y canal=B2C; mapea la sucursal", async () => {
    const f = fakeFetch({ "GET /v2/sucursales": () => json(200, [SUCURSAL]) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(await client.branches({ postalCode: "3000" })).toEqual([
      {
        id: "10055",
        code: "SFN",
        name: "SANTA FE (CENTRO)",
        address: "25 de Mayo 3340",
        postalCode: "3000",
        city: "Santa Fe",
      },
    ]);
    const url = new URL(f.calls[0]!.url);
    expect(url.pathname).toBe("/v2/sucursales");
    expect(url.searchParams.get("codigoPostal")).toBe("3000");
    expect(url.searchParams.get("canal")).toBe("B2C");
    // Es público: sin token en caché no hace login.
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.headers["x-authorization-token"]).toBeUndefined();
  });

  it("si hay un token en caché lo manda igual", async () => {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v2/sucursales": () => json(200, [SUCURSAL]) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await client.getToken();
    await client.branches({ postalCode: "3000" });
    expect(f.calls[1]!.headers["x-authorization-token"]).toBe("tok-1");
  });

  it("descarta las que no entregan envíos y las que no tienen identificador", async () => {
    const f = fakeFetch({
      "GET /v2/sucursales": () =>
        json(200, [
          SUCURSAL,
          { ...SUCURSAL, id: 2, datosAdicionales: { entregaEnvios: false } },
          { ...SUCURSAL, id: 3, datosAdicionales: {} },
          { ...SUCURSAL, id: 4, datosAdicionales: undefined },
          { ...SUCURSAL, id: undefined, codigo: undefined },
          null,
          "basura",
        ]),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect((await client.branches({ postalCode: "3000" })).map((b) => b.id)).toEqual(["10055"]);
  });

  it("tolera la lista envuelta, entregaEnvios como texto y datos faltantes", async () => {
    const f = fakeFetch({
      "GET /v2/sucursales": () =>
        json(200, {
          sucursales: [{ codigo: "XYZ", datosAdicionales: { entregaEnvios: "true" } }],
        }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(await client.branches({ postalCode: "3000" })).toEqual([
      { id: "XYZ", code: "XYZ", name: "XYZ", address: "", postalCode: "", city: "" },
    ]);
  });

  it("404 (sin sucursales para el filtro) es una lista vacía", async () => {
    const f = fakeFetch({
      "GET /v2/sucursales": () => json(404, { title: "No se encuentran sucursales para los filtros ingresados" }),
    });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    expect(await client.branches({ postalCode: "9999" })).toEqual([]);
  });

  it("respuesta que no es lista → UNEXPECTED", async () => {
    const f = fakeFetch({ "GET /v2/sucursales": () => json(200, { hola: 1 }) });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    await expect(client.branches({ postalCode: "3000" })).rejects.toMatchObject({ kind: "UNEXPECTED" });
  });
});

describe("errores", () => {
  async function errorPara(response: () => Response | Promise<Response>) {
    const f = fakeFetch({ "GET /login": LOGIN_OK, "GET /v1/tarifas": response });
    const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
    return (await client.quote(cotizacion).catch((e) => e)) as AndreaniError;
  }

  it.each([400, 402, 403, 404, 409])("%s → BUSINESS", async (status) => {
    const e = await errorPara(() => json(status, { title: "Algo de negocio" }));
    expect(e.kind).toBe("BUSINESS");
    expect(e.status).toBe(status);
    expect(e.message).toContain("Algo de negocio");
  });

  it("BUSINESS acepta `message` (formato del login) y, sin cuerpo, usa un texto fijo", async () => {
    expect((await errorPara(() => json(409, { message: "Conflicto" }))).message).toContain("Conflicto");
    expect((await errorPara(() => new Response("<html>", { status: 400 }))).message).toBe(
      "Andreani rechazó el pedido.",
    );
  });

  it("429 → RATE_LIMIT", async () => {
    expect((await errorPara(() => json(429, {}))).kind).toBe("RATE_LIMIT");
  });

  it("500 → UNEXPECTED", async () => {
    expect((await errorPara(() => json(500, { title: "Error" }))).kind).toBe("UNEXPECTED");
  });

  it("200 con cuerpo que no es JSON → UNEXPECTED", async () => {
    expect((await errorPara(() => new Response("no json", { status: 200 }))).kind).toBe("UNEXPECTED");
  });

  it("fetch que rechaza → NETWORK, sin arrastrar el error original", async () => {
    const e = await errorPara(() => {
      throw new TypeError("fetch failed https://usuario-api:clave-secreta@x");
    });
    expect(e.kind).toBe("NETWORK");
    expect(e.message).not.toContain("clave-secreta");
  });

  it("corta a los 5 segundos → NETWORK", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const impl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      });
    });
    const client = createAndreaniClient({ ...base, fetchImpl: impl as unknown as typeof fetch, now: () => NOW });
    const promesa = client.branches({ postalCode: "3000" }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const e = (await promesa) as AndreaniError;
    expect(e.kind).toBe("NETWORK");
  });
});

describe("nunca se loguea la contraseña", () => {
  it("ni en éxito ni en error, por ningún canal de consola", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const f = fakeFetch({
        "GET /login": [LOGIN_OK, () => json(401, { message: "Credenciales incorrectas" })],
        "GET /v1/tarifas": [TARIFA_OK, () => json(401, {})],
      });
      const client = createAndreaniClient({ ...base, fetchImpl: f.impl, now: () => NOW });
      await client.quote(cotizacion);
      await client.quote(cotizacion).catch(() => undefined);
      const todo = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      expect(todo).not.toContain("clave-secreta");
      expect(todo).not.toContain(Buffer.from("usuario-api:clave-secreta").toString("base64"));
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});
