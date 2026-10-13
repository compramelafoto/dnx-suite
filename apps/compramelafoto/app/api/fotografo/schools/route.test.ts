import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Caracterización del POST de /api/fotografo/schools: escrita contra el código
  original y mantenida al mover la creación a lib/schools/school-setup.ts.
*/

const schoolCreate = vi.fn();
const requireAuth = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    school: {
      create: (...a: unknown[]) => schoolCreate(...a),
      findMany: vi.fn(),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));

import { POST } from "./route";

async function callPost(body: unknown, opts: { badJson?: boolean } = {}) {
  const req = {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return body;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any);
  return { status: res.status, body: await res.json() };
}

describe("POST /api/fotografo/schools (caracterización)", () => {
  beforeEach(() => {
    requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 10 } });
    schoolCreate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 55, slug: null, ...data }));
  });

  it("sin sesión → 401 con el error de requireAuth", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    const { status, body } = await callPost({ name: "X" });
    expect(status).toBe(401);
    expect(body).toEqual({ error: "No autenticado" });
    expect(requireAuth).toHaveBeenCalledWith(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
  });

  it("sin sesión ni error → 401 'No autorizado'", async () => {
    requireAuth.mockResolvedValue({ error: null, user: null });
    const { status, body } = await callPost({ name: "X" });
    expect(status).toBe(401);
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("nombre vacío o ausente → 400 'El nombre es requerido' sin crear", async () => {
    for (const body of [{}, { name: "   " }, { name: null }]) {
      const r = await callPost(body);
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: "El nombre es requerido" });
    }
    const bad = await callPost(null, { badJson: true });
    expect(bad.status).toBe(400);
    expect(schoolCreate).not.toHaveBeenCalled();
  });

  it("recorta textos, vacíos → null, coordenadas sólo números finitos, logo no vacío", async () => {
    const { status, body } = await callPost({
      name: "  Escuela 1  ",
      contactEmail: " a@b.com ",
      contactPhone: "",
      notes: "  nota ",
      address: " Calle 1 ",
      city: " Rosario ",
      province: " Santa Fe ",
      country: undefined,
      latitude: -32.9,
      longitude: "-60.6",
      logoUrl: "   ",
      slug: "ignorado",
    });
    expect(status).toBe(200);
    expect(schoolCreate).toHaveBeenCalledTimes(1);
    expect(schoolCreate.mock.calls[0][0]).toEqual({
      data: {
        ownerId: 10,
        name: "Escuela 1",
        contactEmail: "a@b.com",
        contactPhone: null,
        notes: "nota",
        address: "Calle 1",
        city: "Rosario",
        province: "Santa Fe",
        country: null,
        latitude: -32.9,
        longitude: null,
        logoUrl: null,
      },
    });
    expect(body).toMatchObject({ id: 55, name: "Escuela 1", ownerId: 10 });
  });

  it("valores no texto se convierten con String; NaN/Infinity → null; logo válido se recorta", async () => {
    await callPost({ name: 123, city: 5, latitude: Number.NaN, longitude: Infinity, logoUrl: " https://x/l.png " });
    const data = schoolCreate.mock.calls[0][0].data;
    expect(data.name).toBe("123");
    expect(data.city).toBe("5");
    expect(data.latitude).toBeNull();
    expect(data.longitude).toBeNull();
    expect(data.logoUrl).toBe("https://x/l.png");
  });

  it("cuerpo JSON null → 500 (se lee body.name sobre null), sin crear", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await callPost(null);
    err.mockRestore();
    expect(status).toBe(500);
    expect(body.error).toBe("Error creando escuela");
    expect(schoolCreate).not.toHaveBeenCalled();
  });

  it("si la base falla → 500 con detalle", async () => {
    schoolCreate.mockRejectedValue(new Error("boom"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await callPost({ name: "X" });
    err.mockRestore();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error creando escuela", detail: "boom" });
  });
});
