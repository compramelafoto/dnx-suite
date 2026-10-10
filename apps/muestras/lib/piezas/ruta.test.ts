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
  cargar.cargarMuestraParaPiezas.mockResolvedValue({ id: "a1", slug: "m" });
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
  it("si armar no encuentra la obra, 404; si se rompe, 500", async () => {
    armar.armarPieza.mockResolvedValue(null);
    expect((await pedir("marcos", "?obra=x")).status).toBe(404);
    armar.armarPieza.mockRejectedValue(new Error("pdf-lib"));
    expect((await pedir("cartel")).status).toBe(500);
  });
});
