import { describe, expect, it, vi } from "vitest";
import { AlboomApiError, AlboomLoginError, crearClienteAlboom, horaLocalAlboom } from "./client";

const cred = { subdomain: "dnxprueba", username: "a@b.com", password: "x" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("crearClienteAlboom", () => {
  it("inicia sesión y manda el token como Bearer", async () => {
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/users/login")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ email: "a@b.com", password: "x", type: "simple", keepme: true });
        return json({ status: "ok", token: "T1", data: {} });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer T1");
      return json({ rows: [{ id: "1", status_id: "421" }, { id: "2", status_id: "422" }], count: "2" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    const filas = await c.listarAbiertas();
    expect(filas.map((f) => f.id)).toEqual(["1"]);
    expect(fetchFalso.mock.calls[0][0]).toBe("https://dnxprueba.alboomcrm.com/api/users/login");
  });

  it("rechaza con AlboomLoginError si status no es ok", async () => {
    const fetchFalso = vi.fn(async () => json({ status: "error", message: "invalid" }));
    await expect(crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch)).rejects.toBeInstanceOf(AlboomLoginError);
  });

  it("un 401 en el login es credencial rechazada", async () => {
    const fetchFalso = vi.fn(async () => json({ status: "error" }, 401));
    await expect(crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch)).rejects.toBeInstanceOf(AlboomLoginError);
  });

  it.each([403, 429, 404, 400])("un %i en el login es un problema de Alboom, no de la credencial", async (status) => {
    const fetchFalso = vi.fn(async () => json({ status: "error", message: "blocked" }, status));
    const error = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(AlboomApiError);
    expect(error).not.toBeInstanceOf(AlboomLoginError);
  });

  it("un 200 que no es la respuesta de login (p. ej. una página HTML) es AlboomApiError", async () => {
    const fetchFalso = vi.fn(async () => new Response("<html>firewall</html>", { status: 200 }));
    await expect(crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch)).rejects.toBeInstanceOf(AlboomApiError);
  });

  it("pagina hasta traer count filas", async () => {
    let pagina = 0;
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/login")) return json({ status: "ok", token: "T", data: {} });
      pagina = JSON.parse(String(init?.body)).pageNumber;
      const rows = pagina === 1
        ? Array.from({ length: 100 }, (_, i) => ({ id: String(i), status_id: "421" }))
        : [{ id: "100", status_id: "421" }];
      return json({ rows, count: "101" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    expect((await c.listarAbiertas()).length).toBe(101);
    expect(pagina).toBe(2);
  });

  it("reintenta el login una vez ante un 401", async () => {
    let logins = 0;
    let llamadas = 0;
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith("/login")) { logins++; return json({ status: "ok", token: `T${logins}`, data: {} }); }
      llamadas++;
      return llamadas === 1 ? json({}, 401) : json({ rows: [], count: "0" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    await c.listarAbiertas();
    expect(logins).toBe(2);
  });

  it("rechaza subdominios con caracteres raros", async () => {
    await expect(crearClienteAlboom({ ...cred, subdomain: "evil.com/x" }, vi.fn() as unknown as typeof fetch)).rejects.toThrow();
  });

  it("rechaza con AlboomApiError cuando fetch lanza error durante login", async () => {
    const fetchFalso = vi.fn(async () => {
      throw new Error("Network error");
    });
    await expect(crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch)).rejects.not.toBeInstanceOf(AlboomLoginError);
  });

  it("rechaza con AlboomApiError cuando /leads/paginate devuelve 500", async () => {
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith("/login")) return json({ status: "ok", token: "T", data: {} });
      return json({}, 500);
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    const error = await c.listarAbiertas().catch((e) => e);
    expect(error).toHaveProperty("status", 500);
  });
});

describe("horaLocalAlboom", () => {
  it("es la hora de Argentina sin zona", () => {
    expect(horaLocalAlboom(new Date("2026-09-28T13:00:00.000Z"))).toBe("2026-09-28T10:00:00.000");
  });
});
