import { describe, expect, it, vi } from "vitest";
import {
  AlboomApiError,
  AlboomLoginError,
  AlboomRutaNoPermitidaError,
  RUTAS_DE_LECTURA,
  crearClienteAlboom,
  esRutaDeLectura,
} from "./client";
import { ENTIDADES } from "./entidades";

const CRED = { subdomain: "estudio-prueba", username: "dueno@estudio.test", password: "clave-de-prueba" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Llamada = { url: string; method: string; body: string | null; auth: string | null };

function fetchFalso(responder: (url: string, init: RequestInit, n: number) => Response) {
  const llamadas: Llamada[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const headers = (init.headers ?? {}) as Record<string, string>;
    llamadas.push({ url, method: String(init.method), body: (init.body as string) ?? null, auth: headers.authorization ?? null });
    return responder(url, init, llamadas.length);
  });
  return { impl: impl as unknown as typeof fetch, llamadas };
}

/** Reloj y espera falsos: la espera avanza el reloj, así se ve el ritmo sin dormir. */
function relojFalso() {
  let t = 1_000_000;
  const esperas: number[] = [];
  return {
    ahora: () => t,
    esperar: async (ms: number) => {
      esperas.push(ms);
      t += ms;
    },
    esperas,
    avanzar: (ms: number) => {
      t += ms;
    },
  };
}

const loginOk = (url: string) => (url.endsWith("/users/login") ? json(200, { status: "ok", token: "tok-1" }) : null);

describe("lista blanca de lectura", () => {
  it("acepta las rutas de lectura documentadas", () => {
    for (const [m, r] of [
      ["GET", "/settings/"],
      ["GET", "/stages/list?type=lead_stage"],
      ["GET", "/leads/progress/123/0/9999"],
      ["GET", "/orders?id=55"],
      ["GET", "/orders/items?id=55"],
      ["GET", "/tasks?offset=200&filteruser=all"],
      ["POST", "/leads/paginate"],
      ["POST", "/account_trans/paginate_apr"],
    ] as const) {
      expect(esRutaDeLectura(m, r), `${m} ${r}`).toBe(true);
    }
  });

  it("rechaza escrituras, incluidos los GET de Alboom que escriben", () => {
    for (const [m, r] of [
      ["PUT", "/leads/12"],
      ["DELETE", "/contacts/12"],
      ["PATCH", "/orders/1"],
      ["POST", "/leads/save"],
      ["POST", "/leads/batch_delete"],
      ["POST", "/account_trans/clear_apr"],
      ["POST", "/account_trans"],
      ["POST", "/settings/"],
      ["POST", "/stages"],
      ["POST", "/participants"],
      ["POST", "/mails/send"],
      ["GET", "/settings/erase_finance"],
      ["GET", "/settings/update_apikey"],
      ["GET", "/settings/update_field/x"],
      ["GET", "/products/clone_costs/1/2"],
      ["GET", "/products/clone_pack/1/2"],
      ["GET", "/boleto_set/3"],
      ["GET", "/leads/12"],
      ["GET", "/orders?id=55&x=1"],
      ["GET", "/orders?id=abc"],
      ["GET", "/leads/progress/../users/0/1"],
      ["GET", "/settings"],
      ["POST", "/leads/paginate?x=1"],
    ] as const) {
      expect(esRutaDeLectura(m, r), `${m} ${r}`).toBe(false);
    }
  });

  it("sólo GET y POST de listados; ningún patrón habla de borrar, guardar ni cobrar", () => {
    for (const r of RUTAS_DE_LECTURA) {
      expect(["GET", "POST"]).toContain(r.method);
      if (r.method === "POST") expect(r.patron.source).toMatch(/paginate/);
      expect(r.patron.source).not.toMatch(/delete|save|batch|clear|erase|update|clone|send|sign|set_/);
    }
  });

  it("todo pedido del catálogo de entidades está en la lista blanca", () => {
    for (const e of ENTIDADES) {
      const f = e.fuente;
      const pedidos =
        f.tipo === "simple" ? [f.pedido]
        : f.tipo === "varias" ? f.pedidos.map((p) => p.pedido)
        : f.tipo === "paginada" ? [{ method: "POST" as const, ruta: f.ruta }]
        : f.tipo === "porDesplazamiento" ? [{ method: "GET" as const, ruta: f.ruta(0) }, { method: "GET" as const, ruta: f.ruta(100) }]
        : f.tipo === "porPadre" ? [f.pedido("123", 0), f.pedido("123", 50)]
        : [];
      for (const p of pedidos) expect(esRutaDeLectura(p.method, p.ruta), `${e.clave}: ${p.method} ${p.ruta}`).toBe(true);
    }
  });
});

describe("cliente de Alboom", () => {
  it("inicia sesión con POST /users/login y lee con el token Bearer", async () => {
    const reloj = relojFalso();
    const { impl, llamadas } = fetchFalso((url) => loginOk(url) ?? json(200, { rows: [{ id: "1" }], count: 1 }));
    const c = await crearClienteAlboom(CRED, { fetchImpl: impl, ...reloj });
    const r = await c.leer({ method: "POST", ruta: "/leads/paginate", body: { pageNumber: 1 } });
    expect(r).toEqual({ rows: [{ id: "1" }], count: 1 });
    expect(llamadas[0]!.url).toBe("https://estudio-prueba.alboomcrm.com/api/users/login");
    expect(llamadas[0]!.method).toBe("POST");
    expect(llamadas[1]).toMatchObject({ url: "https://estudio-prueba.alboomcrm.com/api/leads/paginate", method: "POST", auth: "Bearer tok-1" });
    expect(JSON.parse(llamadas[1]!.body!)).toEqual({ pageNumber: 1 });
    expect(c.pedidosHechos()).toBe(2);
  });

  it("una ruta fuera de la lista blanca lanza ANTES de tocar la red", async () => {
    const reloj = relojFalso();
    const { impl, llamadas } = fetchFalso((url) => loginOk(url) ?? json(200, {}));
    const c = await crearClienteAlboom(CRED, { fetchImpl: impl, ...reloj });
    const antes = llamadas.length;
    await expect(c.leer({ method: "POST", ruta: "/leads/batch_delete", body: { rows: [1] } })).rejects.toBeInstanceOf(AlboomRutaNoPermitidaError);
    await expect(c.leer({ method: "GET", ruta: "/settings/erase_finance" })).rejects.toBeInstanceOf(AlboomRutaNoPermitidaError);
    await expect(c.leer({ method: "PUT" as "GET", ruta: "/leads/1" })).rejects.toBeInstanceOf(AlboomRutaNoPermitidaError);
    await expect(c.leer({ method: "DELETE" as "GET", ruta: "/settings/" })).rejects.toBeInstanceOf(AlboomRutaNoPermitidaError);
    await expect(c.leer({ method: "GET", ruta: "/settings/", body: { x: 1 } })).rejects.toBeInstanceOf(AlboomRutaNoPermitidaError);
    expect(llamadas.length).toBe(antes);
  });

  it("respeta un pedido por segundo, contando el inicio de sesión", async () => {
    const reloj = relojFalso();
    const { impl } = fetchFalso((url) => loginOk(url) ?? json(200, []));
    const c = await crearClienteAlboom(CRED, { fetchImpl: impl, ...reloj });
    await c.leer({ method: "GET", ruta: "/eventtypes" });
    reloj.avanzar(300);
    await c.leer({ method: "GET", ruta: "/eventtypes" });
    reloj.avanzar(1500);
    await c.leer({ method: "GET", ruta: "/eventtypes" });
    expect(reloj.esperas).toEqual([1000, 700]);
  });

  it("login rechazado (401 o status error) → AlboomLoginError, sin la contraseña en el mensaje", async () => {
    for (const r of [json(401, {}), json(200, { status: "error", message: "bad" })]) {
      const { impl } = fetchFalso(() => r);
      const err = await crearClienteAlboom(CRED, { fetchImpl: impl, ...relojFalso() }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AlboomLoginError);
      expect(String((err as Error).message)).not.toContain(CRED.password);
      expect(String((err as Error).message)).not.toContain(CRED.username);
    }
  });

  it("login con 429 o 5xx es transitorio, no un rechazo de la credencial", async () => {
    for (const status of [429, 503]) {
      const { impl } = fetchFalso(() => json(status, {}));
      const err = await crearClienteAlboom(CRED, { fetchImpl: impl, ...relojFalso() }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AlboomApiError);
      expect((err as AlboomApiError).transitorio).toBe(true);
    }
  });

  it("un 401 al leer reintenta el inicio de sesión una vez; si sigue, AlboomLoginError", async () => {
    let tokens = 0;
    const { impl, llamadas } = fetchFalso((url) => {
      if (url.endsWith("/users/login")) return json(200, { status: "ok", token: `tok-${++tokens}` });
      return llamadas.filter((l) => l.url.endsWith("/eventtypes")).length === 1 ? json(401, {}) : json(200, [{ id: 1 }]);
    });
    const c = await crearClienteAlboom(CRED, { fetchImpl: impl, ...relojFalso() });
    expect(await c.leer({ method: "GET", ruta: "/eventtypes" })).toEqual([{ id: 1 }]);
    expect(llamadas.at(-1)!.auth).toBe("Bearer tok-2");

    const siempre401 = fetchFalso((url) => loginOk(url) ?? json(401, {}));
    const c2 = await crearClienteAlboom(CRED, { fetchImpl: siempre401.impl, ...relojFalso() });
    await expect(c2.leer({ method: "GET", ruta: "/eventtypes" })).rejects.toBeInstanceOf(AlboomLoginError);
  });

  it("429 y 5xx al leer son transitorios; 404 y respuestas no JSON no", async () => {
    const casos: [Response, boolean][] = [
      [json(429, {}), true],
      [json(502, {}), true],
      [json(404, {}), false],
      [new Response("<html>", { status: 200 }), false],
    ];
    for (const [respuesta, transitorio] of casos) {
      const { impl } = fetchFalso((url) => loginOk(url) ?? respuesta);
      const c = await crearClienteAlboom(CRED, { fetchImpl: impl, ...relojFalso() });
      const err = await c.leer({ method: "GET", ruta: "/eventtypes" }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AlboomApiError);
      expect((err as AlboomApiError).transitorio).toBe(transitorio);
    }
  });

  it("la red caída es transitoria", async () => {
    const impl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await crearClienteAlboom(CRED, { fetchImpl: impl, ...relojFalso() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlboomApiError);
    expect((err as AlboomApiError).transitorio).toBe(true);
  });

  it("subdominio inválido: no sale a la red", async () => {
    const { impl, llamadas } = fetchFalso(() => json(200, {}));
    await expect(crearClienteAlboom({ ...CRED, subdomain: "evil.com/x" }, { fetchImpl: impl })).rejects.toBeInstanceOf(AlboomApiError);
    expect(llamadas).toHaveLength(0);
  });
});
