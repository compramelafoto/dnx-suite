import { beforeEach, describe, expect, it, vi } from "vitest";

const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
const cargar = vi.hoisted(() => ({ cargarFichas: vi.fn() }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/fichas/cargar", () => cargar);
vi.mock("@/lib/imagenes/r2", () => ({ subirPdfAR2: vi.fn() }));

const { GET } = await import("@/app/api/fichas/[id]/route");
const { resetRateLimit } = await import("@/lib/limite");

const pedir = (id = "a1") => GET(new Request(`http://localhost:3014/api/fichas/${id}?tamano=A6`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
});

describe("GET /api/fichas/[id]", () => {
  it("sin sesión manda a ingresar y vuelve a Montaje (no dice si la muestra existe)", async () => {
    usuarioActual.valor = null;
    const r = await pedir();
    expect(r.status).toBe(307);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("next")).toBe("/panel/montaje");
    expect(cargar.cargarFichas).not.toHaveBeenCalled();
  });
  it("con sesión, una muestra ajena o inexistente da 404", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    cargar.cargarFichas.mockResolvedValue(null);
    const r = await pedir("ajena");
    expect(r.status).toBe(404);
  });
  it("entrega el PDF con entregarPdf (directo si es liviano) y declara un minuto de tope", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    cargar.cargarFichas.mockResolvedValue({
      nombre: "fichas-m", activityId: "a1",
      fichas: [{ muestra: "M", titulo: "T", autor: "A", detalle: null, url: "https://muestrasfotograficas.com/q/s/abcdefghjkmn" }],
    });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="fichas-m-A6.pdf"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const ruta = await import("@/app/api/fichas/[id]/route");
    expect(ruta.maxDuration).toBe(60);
  });
});
