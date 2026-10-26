import { describe, expect, it, vi } from "vitest";
import { crearFuenteAlboom, ESPACIO_ENTRE_PEDIDOS_MS, USER_AGENT_IMPORTADOR } from "./fuente";

function reloj() {
  let t = 0;
  return { ahora: () => t, esperar: vi.fn(async (ms: number) => void (t += ms)) };
}

describe("crearFuenteAlboom", () => {
  it("pide con el User-Agent del importador y, por AJAX, con X-Requested-With", async () => {
    const r = reloj();
    const fetchFn = vi.fn(async () => new Response("<html>ok</html>", { status: 200 }));
    const fuente = crearFuenteAlboom("https://www.dnxfotografia.com.ar/", { fetch: fetchFn, ...r });
    expect(await fuente.traer("/portfolio?page=2", { ajax: true })).toEqual({ status: 200, html: "<html>ok</html>" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.dnxfotografia.com.ar/portfolio?page=2");
    expect(init.headers).toEqual({ "User-Agent": USER_AGENT_IMPORTADOR, "X-Requested-With": "XMLHttpRequest" });
    expect(init.method ?? "GET").toBe("GET");
  });

  it("como mucho 2 pedidos por segundo, aunque se pidan en paralelo", async () => {
    const r = reloj();
    const momentos: number[] = [];
    const fetchFn = vi.fn(async () => {
      momentos.push(r.ahora());
      return new Response("x");
    });
    const fuente = crearFuenteAlboom("https://x.test", { fetch: fetchFn, ...r });
    await Promise.all([fuente.traer("/a"), fuente.traer("/b"), fuente.traer("/c")]);
    expect(momentos).toEqual([ESPACIO_ENTRE_PEDIDOS_MS, ESPACIO_ENTRE_PEDIDOS_MS * 2, ESPACIO_ENTRE_PEDIDOS_MS * 3]);
  });

  it("un 404 es una respuesta, no un error; un 500 se reintenta", async () => {
    const r = reloj();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("bien", { status: 200 }));
    const fuente = crearFuenteAlboom("https://x.test", { fetch: fetchFn, ...r });
    expect(await fuente.traer("/no")).toEqual({ status: 404, html: "" });
    expect(await fuente.traer("/si")).toEqual({ status: 200, html: "bien" });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
