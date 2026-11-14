import { beforeEach, describe, expect, it, vi } from "vitest";

const schoolFindUnique = vi.fn();
const schoolCreate = vi.fn();
const schoolUpdate = vi.fn();
const schoolDelete = vi.fn();
const courseFindMany = vi.fn();
const courseCreate = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    school: {
      findUnique: (...a: unknown[]) => schoolFindUnique(...a),
      create: (...a: unknown[]) => schoolCreate(...a),
      update: (...a: unknown[]) => schoolUpdate(...a),
      delete: (...a: unknown[]) => schoolDelete(...a),
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
  deleteSchoolForOwner,
  describeSchoolDeletionBlockers,
  findOwnedSchool,
  getSchoolForDeletion,
  renameSchoolForOwner,
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

  it("renameSchoolForOwner: limpia espacios, devuelve el nombre anterior; vacío → 400; ajena → 404", async () => {
    schoolUpdate.mockReset().mockImplementation(async ({ data }: { data: { name: string } }) => ({ id: 4, name: data.name }));
    expect(await renameSchoolForOwner(10, 4, "  Escuela   Nº8 ")).toEqual({ ok: true, before: "Escuela Sol", school: { id: 4, name: "Escuela Nº8" } });
    expect(await renameSchoolForOwner(10, 4, "  ")).toEqual({ ok: false, status: 400, error: "El nombre es requerido" });
    schoolFindUnique.mockResolvedValue({ id: 4, name: "Escuela Sol", ownerId: 99 });
    expect(await renameSchoolForOwner(10, 4, "X")).toEqual({ ok: false, status: 404, error: "Escuela no encontrada" });
    expect(schoolUpdate).toHaveBeenCalledTimes(1);
  });

  it("describeSchoolDeletionBlockers: vacía → null; si no, dice qué la frena", () => {
    expect(describeSchoolDeletionBlockers({ albums: 0, students: 0, organizers: 0, commissions: 0 })).toBeNull();
    expect(describeSchoolDeletionBlockers({ albums: 1, students: 30, organizers: 0, commissions: 2 })).toBe(
      "No se puede eliminar porque tiene 1 álbum vinculado, 30 alumnos cargados y 2 comisiones anotadas. Si es la escuela equivocada, cambiale el nombre en lugar de borrarla."
    );
  });

  const conConteo = (c: Partial<Record<string, number>>, ownerId = 10) => ({
    id: 4,
    name: "Escuela Sol",
    ownerId,
    _count: { albums: 0, students: 0, organizers: 0, organizerCommissions: 0, courses: 2, ...c },
  });

  it("getSchoolForDeletion: propia con conteos; ajena → null", async () => {
    schoolFindUnique.mockResolvedValue(conConteo({ albums: 1 }));
    const r = await getSchoolForDeletion(10, 4);
    expect(r).toMatchObject({ id: 4, courses: 2, blockers: { albums: 1 } });
    expect(r?.blockedReason).toContain("1 álbum vinculado");
    schoolFindUnique.mockResolvedValue(conConteo({}, 99));
    expect(await getSchoolForDeletion(10, 4)).toBeNull();
  });

  describe("deleteSchoolForOwner", () => {
    beforeEach(() => {
      transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({ school: { findUnique: (...a: unknown[]) => schoolFindUnique(...a), delete: (...a: unknown[]) => schoolDelete(...a) } })
      );
      schoolDelete.mockReset().mockResolvedValue({});
    });
    it("vacía (sólo cursos) → la borra", async () => {
      schoolFindUnique.mockResolvedValue(conConteo({}));
      expect(await deleteSchoolForOwner(10, 4)).toEqual({ ok: true, school: { id: 4, name: "Escuela Sol" } });
      expect(schoolDelete).toHaveBeenCalledWith({ where: { id: 4 } });
    });
    it("con álbum, alumnos, administradores o comisiones → 409 sin borrar", async () => {
      for (const c of [{ albums: 1 }, { students: 3 }, { organizers: 1 }, { organizerCommissions: 1 }]) {
        schoolFindUnique.mockResolvedValue(conConteo(c));
        const r = await deleteSchoolForOwner(10, 4);
        expect(r).toMatchObject({ ok: false, status: 409 });
      }
      expect(schoolDelete).not.toHaveBeenCalled();
    });
    it("ajena o inexistente → 404 sin borrar", async () => {
      schoolFindUnique.mockResolvedValue(conConteo({}, 99));
      expect(await deleteSchoolForOwner(10, 4)).toEqual({ ok: false, status: 404, error: "Escuela no encontrada" });
      schoolFindUnique.mockResolvedValue(null);
      expect(await deleteSchoolForOwner(10, 4)).toMatchObject({ ok: false, status: 404 });
      expect(schoolDelete).not.toHaveBeenCalled();
    });
  });
});
