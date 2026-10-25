import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const schoolFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findUnique: (...a: unknown[]) => albumFindUnique(...a),
      update: (...a: unknown[]) => albumUpdate(...a),
    },
    school: { findUnique: (...a: unknown[]) => schoolFindUnique(...a) },
  },
}));

import {
  buildAlbumSchoolSettingsUpdateData,
  updateAlbumSchoolSettingsForOwner,
} from "./album-school-settings";

const album = {
  id: 7,
  userId: 10,
  deletedAt: null as Date | null,
  mode: "SIMPLE",
  schoolId: null as number | null,
  studentIdentificationMode: null as string | null,
  allowManualStudentFallback: false,
  organizerCommissionEnabled: false,
  organizerCommissionPercentage: null as number | null,
  organizerCommissionAppliesTo: ["PREVENTA"],
};

describe("album-school-settings", () => {
  beforeEach(() => {
    albumFindUnique.mockReset().mockResolvedValue({ ...album });
    albumUpdate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ ...album, ...data }));
    schoolFindUnique.mockReset().mockResolvedValue({ ownerId: 10 });
  });

  it("build: escuela ajena → 400 'Escuela no encontrada o no te pertenece'", async () => {
    schoolFindUnique.mockResolvedValue({ ownerId: 99 });
    expect(await buildAlbumSchoolSettingsUpdateData({ schoolId: 4 }, 10)).toEqual({
      ok: false,
      status: 400,
      error: "Escuela no encontrada o no te pertenece",
    });
  });

  it("build: no toca campos ajenos a lo escolar", async () => {
    const r = await buildAlbumSchoolSettingsUpdateData({ title: "x", type: "SCHOOL", mode: "SCHOOL" }, 10);
    expect(r).toEqual({ ok: true, data: { mode: "SCHOOL" } });
  });

  it("álbum inexistente, ajeno o borrado → 404 sin guardar", async () => {
    for (const row of [null, { ...album, userId: 99 }, { ...album, deletedAt: new Date() }]) {
      albumFindUnique.mockResolvedValue(row);
      const r = await updateAlbumSchoolSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { mode: "SCHOOL" } });
      expect(r).toEqual({ ok: false, status: 404, error: "Álbum no encontrado" });
    }
    expect(albumUpdate).not.toHaveBeenCalled();
  });

  it("escuela ajena → 400 sin guardar", async () => {
    schoolFindUnique.mockResolvedValue({ ownerId: 99 });
    const r = await updateAlbumSchoolSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { schoolId: 4 } });
    expect(r).toEqual({ ok: false, status: 400, error: "Escuela no encontrada o no te pertenece" });
    expect(albumUpdate).not.toHaveBeenCalled();
  });

  it("parche vacío → 400 'No hay cambios para aplicar'", async () => {
    const r = await updateAlbumSchoolSettingsForOwner({ actorUserId: 10, albumId: 7, patch: {} });
    expect(r).toEqual({ ok: false, status: 400, error: "No hay cambios para aplicar" });
  });

  it("before/after sólo con las claves escritas", async () => {
    const r = await updateAlbumSchoolSettingsForOwner({
      actorUserId: 10,
      albumId: 7,
      patch: { mode: "SCHOOL", schoolId: 4, organizerCommissionAppliesTo: ["PREVENTA", "EXTRAS"] },
    });
    expect(r).toEqual({
      ok: true,
      before: { mode: "SIMPLE", schoolId: null, organizerCommissionAppliesTo: ["PREVENTA"] },
      after: { mode: "SCHOOL", schoolId: 4, organizerCommissionAppliesTo: ["PREVENTA", "EXTRAS"] },
    });
  });

  it("before pasado por JSON sirve como parche para deshacer y deja el álbum igual que antes", async () => {
    const original = {
      ...album,
      mode: "EVENT",
      schoolId: 3,
      studentIdentificationMode: "ROSTER_OPTIONAL",
      allowManualStudentFallback: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: 12.5,
      organizerCommissionAppliesTo: ["POST_EVENT"],
    };
    albumFindUnique.mockResolvedValue({ ...original });
    const r = await updateAlbumSchoolSettingsForOwner({
      actorUserId: 10,
      albumId: 7,
      patch: {
        mode: "SCHOOL",
        schoolId: 4,
        studentIdentificationMode: null,
        allowManualStudentFallback: false,
        organizerCommissionEnabled: false,
        organizerCommissionPercentage: null,
        organizerCommissionAppliesTo: [],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const guardado = JSON.parse(JSON.stringify(r.before));
    const built = await buildAlbumSchoolSettingsUpdateData(guardado, 10);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.data).toEqual({
      mode: "EVENT",
      schoolId: 3,
      studentIdentificationMode: "ROSTER_OPTIONAL",
      allowManualStudentFallback: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: 12.5,
      organizerCommissionAppliesTo: ["POST_EVENT"],
    });

    albumFindUnique.mockResolvedValue({ ...original, ...r.after });
    const undo = await updateAlbumSchoolSettingsForOwner({ actorUserId: 10, albumId: 7, patch: guardado });
    expect(undo.ok).toBe(true);
    if (undo.ok) expect(undo.after).toEqual(r.before);
  });
});
