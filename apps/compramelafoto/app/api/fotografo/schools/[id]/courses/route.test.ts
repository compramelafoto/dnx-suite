import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Caracterización del POST de /api/fotografo/schools/[id]/courses: escrita contra
  el código original y mantenida al mover la creación a lib/schools/school-setup.ts.
  La ruta sigue sin evitar repetidos (crea el curso aunque ya exista).
*/

const schoolFindUnique = vi.fn();
const courseCreate = vi.fn();
const courseFindMany = vi.fn();
const requireAuth = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma = {
    school: { findUnique: (...a: unknown[]) => schoolFindUnique(...a) },
    schoolCourse: {
      create: (...a: unknown[]) => courseCreate(...a),
      findMany: (...a: unknown[]) => courseFindMany(...a),
    },
    $transaction: async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(prisma),
  };
  return {
    prisma,
    Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
  };
});
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));

import { POST } from "./route";

async function callPost(id: string, body: unknown, opts: { badJson?: boolean } = {}) {
  const req = {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return body;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

describe("POST /api/fotografo/schools/[id]/courses (caracterización)", () => {
  beforeEach(() => {
    requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 10 } });
    schoolFindUnique.mockReset().mockResolvedValue({ id: 4, name: "Escuela", ownerId: 10 });
    courseFindMany.mockReset().mockResolvedValue([{ id: 1, name: "1ro", division: "A" }]);
    courseCreate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 77, ...data }));
  });

  it("sin sesión → 401", async () => {
    requireAuth.mockResolvedValue({ error: null, user: null });
    const { status, body } = await callPost("4", { name: "1ro" });
    expect(status).toBe(401);
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("id no numérico → 400 'ID de escuela inválido'", async () => {
    const { status, body } = await callPost("abc", { name: "1ro" });
    expect(status).toBe(400);
    expect(body).toEqual({ error: "ID de escuela inválido" });
    expect(schoolFindUnique).not.toHaveBeenCalled();
  });

  it("escuela ajena o inexistente → 404 'Escuela no encontrada', aun con nombre vacío", async () => {
    schoolFindUnique.mockResolvedValue({ id: 4, name: "Otra", ownerId: 99 });
    let r = await callPost("4", { name: "" });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "Escuela no encontrada" });
    schoolFindUnique.mockResolvedValue(null);
    r = await callPost("4", { name: "1ro" });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "Escuela no encontrada" });
    expect(courseCreate).not.toHaveBeenCalled();
  });

  it("nombre vacío → 400 'El nombre del curso es requerido'", async () => {
    let r = await callPost("4", { name: "  " });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "El nombre del curso es requerido" });
    r = await callPost("4", null, { badJson: true });
    expect(r.status).toBe(400);
    expect(courseCreate).not.toHaveBeenCalled();
  });

  it("crea recortando nombre y división; sortOrder numérico o null", async () => {
    const { status, body } = await callPost("4", { name: " 2do ", division: " B ", sortOrder: "3" });
    expect(status).toBe(200);
    expect(courseCreate.mock.calls[0][0]).toEqual({
      data: { schoolId: 4, name: "2do", division: "B", sortOrder: 3 },
    });
    expect(body).toEqual({ id: 77, schoolId: 4, name: "2do", division: "B", sortOrder: 3 });

    await callPost("4", { name: "3ro", division: "   ", sortOrder: "x" });
    expect(courseCreate.mock.calls[1][0].data).toEqual({ schoolId: 4, name: "3ro", division: null, sortOrder: null });

    await callPost("4", { name: "4to" });
    expect(courseCreate.mock.calls[2][0].data).toEqual({ schoolId: 4, name: "4to", division: null, sortOrder: null });
  });

  it("un curso que ya existe se vuelve a crear (la ruta no evita repetidos)", async () => {
    const { status } = await callPost("4", { name: "1ro", division: "A" });
    expect(status).toBe(200);
    expect(courseCreate).toHaveBeenCalledTimes(1);
  });

  it("cuerpo JSON null → 500 'Error creando curso' sin crear", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await callPost("4", null);
    err.mockRestore();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error creando curso" });
    expect(courseCreate).not.toHaveBeenCalled();
  });

  it("si la base falla → 500 'Error creando curso'", async () => {
    courseCreate.mockRejectedValue(new Error("boom"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await callPost("4", { name: "1ro" });
    err.mockRestore();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error creando curso" });
  });
});
