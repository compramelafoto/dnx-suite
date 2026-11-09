import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { conectarCoexistencia, MENSAJES_COEXISTENCIA } = await import("./coexistencia");

const CTX = { workspaceId: "w1", userId: 1, userLabel: "Daniel", role: "OWNER", acceso: {} } as never;
const DATOS = { code: "codigo-de-meta", wabaId: "288314434371834", phoneNumberId: "1111222233334444" };

type Llamada = { url: string; init?: RequestInit };
function metaFalsa(r: { canje?: unknown; numeroOk?: (token: string) => boolean }) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    if (url.includes("/oauth/access_token")) return new Response(JSON.stringify(r.canje ?? { access_token: "token-canjeado" }), { status: 200 });
    if (url.includes("/1111222233334444?")) {
      const token = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
      return r.numeroOk && !r.numeroOk(token) ? new Response("{}", { status: 403 }) : new Response(JSON.stringify({ id: "1111222233334444", display_phone_number: "+54 9 341 341-9869" }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { f, llamadas };
}

describe("conectarCoexistencia", () => {
  it("canjea el código, usa el token permanente si ya alcanza al número y guarda la conexión real", async () => {
    const { f, llamadas } = metaFalsa({});
    const guardar = vi.fn(async () => ({ ok: true as const }));
    const r = await conectarCoexistencia(CTX, DATOS, { fetch: f, guardar, leerToken: async () => "token-permanente", appSecret: "secreto" });
    expect(r).toEqual({ ok: true, tokenPermanente: true });
    expect(llamadas[0].url).toContain("client_id=2188321802064982");
    expect(llamadas[0].url).toContain("code=codigo-de-meta");
    expect(guardar).toHaveBeenCalledWith(CTX, { modo: "REAL", phoneNumberId: DATOS.phoneNumberId, wabaId: DATOS.wabaId, displayPhone: "+54 9 341 341-9869", token: undefined });
  });

  it("si el token permanente no alcanza al número, guarda el token del canje (vence a los 60 días)", async () => {
    const { f } = metaFalsa({ numeroOk: (t) => t === "token-canjeado" });
    const guardar = vi.fn(async () => ({ ok: true as const }));
    const r = await conectarCoexistencia(CTX, DATOS, { fetch: f, guardar, leerToken: async () => "token-permanente", appSecret: "secreto" });
    expect(r).toEqual({ ok: true, tokenPermanente: false });
    expect(guardar).toHaveBeenCalledWith(CTX, expect.objectContaining({ token: "token-canjeado" }));
  });

  it("rechaza datos inválidos, sin secreto de la app o si Meta no canjea el código", async () => {
    const { f } = metaFalsa({ canje: { error: { message: "expired" } } });
    const guardar = vi.fn();
    expect(await conectarCoexistencia(CTX, { ...DATOS, wabaId: "abc" }, { fetch: f, guardar, appSecret: "s" })).toEqual({ ok: false, error: MENSAJES_COEXISTENCIA.datos });
    expect(await conectarCoexistencia(CTX, DATOS, { fetch: f, guardar, appSecret: "" })).toEqual({ ok: false, error: MENSAJES_COEXISTENCIA.sinSecreto });
    expect(await conectarCoexistencia(CTX, DATOS, { fetch: f, guardar, appSecret: "s" })).toEqual({ ok: false, error: MENSAJES_COEXISTENCIA.canje });
    expect(guardar).not.toHaveBeenCalled();
  });
});
