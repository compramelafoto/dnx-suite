import { beforeEach, describe, expect, it, vi } from "vitest";

const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
const cargar = vi.hoisted(() => ({ cargarFichas: vi.fn() }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/fichas/cargar", () => cargar);

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
});
