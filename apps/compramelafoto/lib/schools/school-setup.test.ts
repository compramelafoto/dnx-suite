import { beforeEach, describe, expect, it, vi } from "vitest";

const schoolFindUnique = vi.fn();
const schoolCreate = vi.fn();
const courseFindMany = vi.fn();
const courseCreate = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    school: {
      findUnique: (...a: unknown[]) => schoolFindUnique(...a),
      create: (...a: unknown[]) => schoolCreate(...a),
    },
    schoolCourse: {
      findMany: (...a: unknown[]) => courseFindMany(...a),
      create: (...a: unknown[]) => courseCreate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import {
  createSchoolCoursesForOwner,
  createSchoolForOwner,
  findOwnedSchool,
  schoolCourseKey,
} from "./school-setup";

describe("school-setup", () => {
  beforeEach(() => {
    schoolFindUnique.mockReset().mockResolvedValue({ id: 4, name: "Escuela Sol", ownerId: 10 });
    schoolCreate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 5, ...data }));
    courseFindMany.mockReset().mockResolvedValue([
      { name: "1ro", division: "A" },
      { name: "Sala 5", division: null },
    ]);
    courseCreate.mockReset().mockImplementation(({ data }: { data: object }) => ({ id: 90, ...data }));
    transaction.mockReset().mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it("createSchoolForOwner: nombre vacío → 400 sin crear", async () => {
    const r = await createSchoolForOwner(10, { name: "  " });
    expect(r).toEqual({ ok: false, status: 400, error: "El nombre es requerido" });
    expect(schoolCreate).not.toHaveBeenCalled();
  });

  it("createSchoolForOwner: crea a nombre del dueño recibido", async () => {
    const r = await createSchoolForOwner(10, { name: " Escuela Sol ", city: " Rosario " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.school).toMatchObject({ id: 5, name: "Escuela Sol", ownerId: 10, city: "Rosario" });
  });

  it("findOwnedSchool: propia → id y nombre; ajena o inexistente → null", async () => {
    expect(await findOwnedSchool(10, 4)).toEqual({ id: 4, name: "Escuela Sol" });
    schoolFindUnique.mockResolvedValue({ id: 4, name: "Escuela Sol", ownerId: 99 });
    expect(await findOwnedSchool(10, 4)).toBeNull();
    schoolFindUnique.mockResolvedValue(null);
    expect(await findOwnedSchool(10, 4)).toBeNull();
  });

  it("createSchoolCoursesForOwner: escuela ajena → 404 sin crear ni leer cursos", async () => {
    schoolFindUnique.mockResolvedValue({ id: 4, name: "X", ownerId: 99 });
    const r = await createSchoolCoursesForOwner(10, 4, [{ name: "1ro" }], { skipExisting: true });
    expect(r).toEqual({ ok: false, status: 404, error: "Escuela no encontrada" });
    expect(courseFindMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("createSchoolCoursesForOwner: un curso sin nombre → 400 y no se crea ninguno", async () => {
    const r = await createSchoolCoursesForOwner(10, 4, [{ name: "2do" }, { name: " " }], { skipExisting: false });
    expect(r).toEqual({ ok: false, status: 400, error: "El nombre del curso es requerido" });
    expect(courseCreate).not.toHaveBeenCalled();
  });

  it("skipExisting: saltea repetidos sin mayúsculas ni espacios (también dentro del mismo pedido)", async () => {
    const r = await createSchoolCoursesForOwner(
      10,
      4,
      [
        { name: " 1RO ", division: "a" },
        { name: "sala  5" },
        { name: "2do", division: "B" },
        { name: "2 do", division: " b" },
      ],
      { skipExisting: true }
    );
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 3 });
    expect(courseCreate).toHaveBeenCalledTimes(1);
    expect(courseCreate.mock.calls[0][0]).toEqual({
      data: { schoolId: 4, name: "2do", division: "B", sortOrder: null },
    });
  });

  it("skipExisting: todos repetidos → no abre transacción", async () => {
    const r = await createSchoolCoursesForOwner(10, 4, [{ name: "1ro", division: "A" }], { skipExisting: true });
    expect(r).toEqual({ ok: true, created: 0, skipped: 1, courses: [] });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("sin skipExisting: crea aunque exista y no consulta los cursos", async () => {
    const r = await createSchoolCoursesForOwner(10, 4, [{ name: "1ro", division: "A" }], { skipExisting: false });
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 0 });
    expect(courseFindMany).not.toHaveBeenCalled();
  });

  it("schoolCourseKey: división vacía y null son lo mismo", () => {
    expect(schoolCourseKey("Sala 5", null)).toBe(schoolCourseKey("sala5", ""));
    expect(schoolCourseKey("1ro", "A")).not.toBe(schoolCourseKey("1ro", "B"));
  });
});
