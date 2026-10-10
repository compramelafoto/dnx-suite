import { beforeEach, describe, expect, it, vi } from "vitest";

const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
const cargar = vi.hoisted(() => ({ cargarMuestraParaPiezas: vi.fn() }));
const armar = vi.hoisted(() => ({ armarPieza: vi.fn() }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/piezas/cargar", () => cargar);
vi.mock("@/lib/piezas/armar", () => armar);
vi.mock("@/lib/imagenes/r2", () => ({ subirPdfAR2: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { GET } = await import("@/app/api/piezas/[id]/[pieza]/route");
const { resetRateLimit } = await import("@/lib/limite");

const pedir = (pieza: string, q = "", id = "a1") =>
  GET(new Request(`http://localhost:3014/api/piezas/${id}/${pieza}${q}`), { params: Promise.resolve({ id, pieza }) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false };
  cargar.cargarMuestraParaPiezas.mockResolvedValue({ id: "a1", slug: "m", works: [] });
  armar.armarPieza.mockResolvedValue({ bytes: new Uint8Array([1, 2]), nombre: "cartel-m-A3" });
});

describe("GET /api/piezas/[id]/[pieza]", () => {
  it("sin sesión, a ingresar y de vuelta a Montaje, sin mirar la muestra", async () => {
    usuarioActual.valor = null;
    const r = await pedir("cartel");
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).searchParams.get("next")).toBe("/panel/montaje");
    expect(cargar.cargarMuestraParaPiezas).not.toHaveBeenCalled();
  });
  it("una pieza desconocida o una muestra ajena dan 404", async () => {
    expect((await pedir("fichas")).status).toBe(404);
    cargar.cargarMuestraParaPiezas.mockResolvedValue(null);
    expect((await pedir("cartel")).status).toBe(404);
  });
  it("las piezas con QR piden la muestra publicada; marcos y plano, no", async () => {
    await pedir("cartel");
    await pedir("marcos");
    await pedir("montaje");
    expect(cargar.cargarMuestraParaPiezas.mock.calls.map((c) => c[2])).toEqual([{ publicada: true }, { publicada: false }, { publicada: false }]);
  });
  it("entrega el PDF", async () => {
    const r = await pedir("cartel", "?tamano=A2");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cartel-m-A3.pdf"');
    expect(armar.armarPieza.mock.calls[0]![1]).toEqual({ pieza: "cartel", tamano: "A2" });
  });
  it("si armar no encuentra la obra, 404; si se rompe, 500; los errores en texto, en español", async () => {
    armar.armarPieza.mockResolvedValue(null);
    const r404 = await pedir("marcos", "?obra=x");
    expect(r404.status).toBe(404);
    expect(r404.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await r404.text()).toBe("Esa obra no es de esta muestra.");
    armar.armarPieza.mockRejectedValue(new Error("pdf-lib"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r500 = await pedir("cartel");
    error.mockRestore();
    expect(r500.status).toBe(500);
    expect(await r500.text()).toBe("No pudimos armar el PDF. Probá de nuevo.");
  });
  it("marcos con foto de más de 40 obras, sin obra ni tanda: 404 que pide bajarlos por tandas (etapa 6)", async () => {
    const works = Array.from({ length: 41 }, (_, i) => ({ id: `w${i}` }));
    cargar.cargarMuestraParaPiezas.mockResolvedValue({ id: "a1", slug: "m", works });
    const r = await pedir("marcos");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Con más de 40 obras, bajá los marcos por tandas.");
    expect(armar.armarPieza).not.toHaveBeenCalled();
    // Por tandas, una obra sola o sin foto, sí.
    expect((await pedir("marcos", "?tanda=2")).status).toBe(200);
    expect((await pedir("marcos", "?obra=w3")).status).toBe(200);
    expect((await pedir("marcos", "?foto=no")).status).toBe(200);
  });
  it("puede tardar hasta 5 minutos (catálogo de 300 obras)", async () => {
    const ruta = await import("@/app/api/piezas/[id]/[pieza]/route");
    expect(ruta.maxDuration).toBe(300);
  });
  it("pasado el tope, 429 en texto", async () => {
    let r = await pedir("cartel");
    for (let i = 0; i < 70 && r.status !== 429; i++) r = await pedir("cartel");
    expect(r.status).toBe(429);
    expect(await r.text()).toBe("Pediste muchos PDF seguidos. Esperá unos minutos.");
  });
});
