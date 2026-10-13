import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cabeceras = vi.hoisted(() => ({ ip: "200.1.2.3" }));
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); }));

vi.mock("next/headers", () => ({ headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? cabeceras.ip : null) }) }));
vi.mock("next/navigation", () => ({ redirect }));
// Sin la caché de Next en los tests: cada llamada va al proveedor (el fetch simulado).
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const { buscarCerca } = await import("./buscar-cerca");
const { fetchConTiempoMaximo, normalizarBusqueda, ubicarTexto, TIEMPO_MAXIMO_MS } = await import("./geocodificar");
const { LIMITES_PUBLICOS, resetRateLimit } = await import("@/lib/limite");

const fetchSimulado = vi.fn<typeof fetch>();
const respuesta = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json" } });
const rio = { lat: "-27.42", lon: "-56.60", class: "waterway", display_name: "Río Paraná", address: { country_code: "ar" } };
const parana = { lat: "-31.733", lon: "-60.5299", class: "boundary", display_name: "Paraná, Entre Ríos", address: { city: "Paraná", country_code: "ar" } };

function form(q: string) {
  const f = new FormData();
  f.set("q", q);
  return f;
}
const buscar = (q: string) => buscarCerca({ error: null }, form(q));

beforeEach(() => {
  resetRateLimit();
  cabeceras.ip = "200.1.2.3";
  fetchSimulado.mockReset();
  redirect.mockClear();
  vi.stubGlobal("fetch", fetchSimulado);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("buscarCerca", () => {
  it("encuentra la ciudad (saltando el río) y lleva a la portada ordenada por cercanía", async () => {
    fetchSimulado.mockResolvedValue(respuesta([rio, parana]));
    await expect(buscar("Paraná")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/?cerca=-31.7330%2C-60.5299&lugar=Paran%C3%A1#muestras");
    const url = new URL(String(fetchSimulado.mock.calls[0]![0]));
    expect(url.searchParams.get("countrycodes")).toBe("ar,bo,br,cl,py,pe,uy,ve");
    expect(url.searchParams.get("q")).toBe("paraná");
  });
  it("encuentra una ciudad de otro país con muestras", async () => {
    const montevideo = { lat: "-34.9011", lon: "-56.1645", class: "boundary", display_name: "Montevideo, Uruguay", address: { city: "Montevideo", country_code: "uy" } };
    fetchSimulado.mockResolvedValue(respuesta([montevideo]));
    await expect(buscar("Montevideo")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/?cerca=-34.9011%2C-56.1645&lugar=Montevideo#muestras");
  });
  it("texto corto: no busca", async () => {
    expect(await buscar(" ab ")).toEqual({ error: "Escribí una ciudad o una dirección." });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
  it("frena por IP pasado el tope, sin ir a Nominatim", async () => {
    fetchSimulado.mockImplementation(async () => respuesta([]));
    for (let i = 0; i < LIMITES_PUBLICOS.buscarCerca.limit; i++) await buscar("Rosario");
    const llamadas = fetchSimulado.mock.calls.length;
    expect(await buscar("Rosario")).toEqual({ error: "Demasiadas búsquedas seguidas. Probá en un minuto." });
    expect(fetchSimulado.mock.calls.length).toBe(llamadas);
    cabeceras.ip = "200.9.9.9";
    expect(await buscar("Rosario")).not.toEqual({ error: "Demasiadas búsquedas seguidas. Probá en un minuto." });
  });
  it("sin resultado habitable avisa", async () => {
    fetchSimulado.mockResolvedValue(respuesta([rio]));
    expect(await buscar("Paraná")).toEqual({ error: "No encontramos ese lugar. Probá con el nombre de la ciudad." });
    expect(redirect).not.toHaveBeenCalled();
  });
  it("error del proveedor: mensaje fijo", async () => {
    fetchSimulado.mockResolvedValue(new Response("caído", { status: 503 }));
    expect(await buscar("Rosario")).toEqual({ error: "No pudimos buscar ese lugar. Probá de nuevo en un rato." });
  });
  it("tiempo agotado: mensaje fijo", async () => {
    fetchSimulado.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    expect(await buscar("Rosario")).toEqual({ error: "No pudimos buscar ese lugar. Probá de nuevo en un rato." });
  });
});

describe("geocodificar", () => {
  it("el pedido lleva una señal de corte", async () => {
    fetchSimulado.mockResolvedValue(respuesta([]));
    await fetchConTiempoMaximo("https://x.test");
    expect(fetchSimulado.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    expect(TIEMPO_MAXIMO_MS).toBe(5000);
  });
  it("corta de verdad cuando el proveedor no contesta", async () => {
    const colgado: typeof fetch = (_u, init) => new Promise((_ok, mal) => {
      init?.signal?.addEventListener("abort", () => mal(init.signal!.reason));
    });
    const corto: typeof fetch = (u, init) => colgado(u, { ...init, signal: AbortSignal.timeout(10) });
    await expect(ubicarTexto("Rosario", corto)).rejects.toThrow();
  });
  it("normaliza la clave de la caché", () => expect(normalizarBusqueda("  San   Luis ")).toBe("san luis"));
  it("manda un User-Agent con contacto", async () => {
    fetchSimulado.mockResolvedValue(respuesta([]));
    await ubicarTexto("Rosario");
    const h = new Headers(fetchSimulado.mock.calls[0]![1]?.headers);
    expect(h.get("user-agent")).toContain("+https://muestrasfotograficas.com");
  });
});
