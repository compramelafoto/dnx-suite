import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Caracterización del PATCH de /api/dashboard/albums/[id] para los campos escolares
  (escuela, modo, identificación de alumnos y comisión del organizador). Escrita
  contra el código original y mantenida al moverlos a lib/albums/album-school-settings.ts.
*/

const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const schoolFindUnique = vi.fn();
const labFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findUnique: (...a: unknown[]) => albumFindUnique(...a),
      update: (...a: unknown[]) => albumUpdate(...a),
    },
    school: { findUnique: (...a: unknown[]) => schoolFindUnique(...a) },
    lab: { findUnique: (...a: unknown[]) => labFindUnique(...a) },
    appConfig: { findUnique: vi.fn(async () => ({ minDigitalPhotoPrice: 5000 })) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
  EventFolderScope: { ORGANIZER: "ORGANIZER", PHOTOGRAPHER: "PHOTOGRAPHER" },
  Prisma: {},
  PrintPricingSource: {},
  AlbumMode: {},
  StudentIdentificationMode: {},
  OrganizerCommissionAppliesTo: {},
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ error: null, user: { id: 10 } })),
}));
vi.mock("@/lib/r2-client", () => ({ normalizePreviewUrl: vi.fn(), deleteFromR2: vi.fn() }));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  collaborativeEventPricingFromPricingRow: vi.fn(),
  loadCollaborativeEventPricingSnapshot: vi.fn(async () => null),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "El organizador controla el precio",
}));
vi.mock("@/lib/hidden-album/prepare-hidden-album-photos", () => ({
  ensureAlbumPhotosQueuedForHiddenMode: vi.fn(async () => 0),
}));
vi.mock("@/lib/events/event-organizer-access", () => ({ isEventOrganizerUser: vi.fn() }));
vi.mock("@/lib/albums/album-photo-stats", () => ({
  loadAlbumPhotoStats: vi.fn(),
  loadEventFolderPhotoCounts: vi.fn(),
  countActiveAlbumPhotosForAlbum: vi.fn(async () => 3),
}));
vi.mock("@/lib/album/album-list-cover", () => ({ resolveAlbumStandaloneCoverUrl: vi.fn() }));

import { PATCH } from "./route";

const existingAlbum = {
  userId: 10,
  deletedAt: null,
  eventId: null as number | null,
  eventDate: null,
  startsAt: null,
  endsAt: null,
  termsAcceptedAt: new Date("2026-01-01T00:00:00Z"),
  termsVersion: "otra",
};

async function callPatch(body: unknown) {
  const req = { json: async () => body };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await PATCH(req as any, { params: Promise.resolve({ id: "7" }) });
  return { status: res.status, body: await res.json() };
}

function savedData() {
  return albumUpdate.mock.calls[0][0].data;
}

describe("PATCH /api/dashboard/albums/[id] (campos escolares)", () => {
  beforeEach(() => {
    albumFindUnique.mockReset().mockResolvedValue(existingAlbum);
    albumUpdate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 7, ...data }));
    schoolFindUnique.mockReset().mockResolvedValue({ ownerId: 10 });
    labFindUnique.mockReset().mockResolvedValue({ id: 1 });
  });

  it("escuela propia → se guarda el id numérico", async () => {
    const { status } = await callPatch({ schoolId: "4" });
    expect(status).toBe(200);
    expect(schoolFindUnique).toHaveBeenCalledWith({ where: { id: 4 }, select: { ownerId: true } });
    expect(savedData()).toEqual({ schoolId: 4 });
  });

  it("escuela ajena o inexistente → 400 'Escuela no encontrada o no te pertenece' sin guardar", async () => {
    schoolFindUnique.mockResolvedValue({ ownerId: 99 });
    let r = await callPatch({ schoolId: 4 });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "Escuela no encontrada o no te pertenece" });
    schoolFindUnique.mockResolvedValue(null);
    r = await callPatch({ schoolId: 4 });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "Escuela no encontrada o no te pertenece" });
    expect(albumUpdate).not.toHaveBeenCalled();
  });

  it("schoolId null, vacío o no numérico → se desvincula sin consultar escuelas", async () => {
    for (const schoolId of [null, "", "abc"]) {
      albumUpdate.mockClear();
      const r = await callPatch({ schoolId });
      expect(r.status).toBe(200);
      expect(savedData()).toEqual({ schoolId: null });
    }
    expect(schoolFindUnique).not.toHaveBeenCalled();
  });

  it("escuela ajena gana sobre un modo inválido (orden de validación)", async () => {
    schoolFindUnique.mockResolvedValue({ ownerId: 99 });
    const r = await callPatch({ schoolId: 4, mode: "XX" });
    expect(r.body).toEqual({ error: "Escuela no encontrada o no te pertenece" });
  });

  it("laboratorio inválido gana sobre la escuela (validación previa)", async () => {
    const r = await callPatch({ selectedLabId: -1, schoolId: 4 });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "selectedLabId inválido" });
    expect(schoolFindUnique).not.toHaveBeenCalled();
  });

  it("modo inválido → 400 'mode inválido'", async () => {
    for (const mode of ["XX", 3, null]) {
      const r = await callPatch({ mode });
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: "mode inválido" });
    }
  });

  it("modo inválido gana sobre identificación inválida", async () => {
    const r = await callPatch({ mode: "XX", studentIdentificationMode: "YY" });
    expect(r.body).toEqual({ error: "mode inválido" });
  });

  it("identificación de alumnos: válida, vacía o inválida", async () => {
    let r = await callPatch({ studentIdentificationMode: "ROSTER_OPTIONAL" });
    expect(savedData()).toEqual({ studentIdentificationMode: "ROSTER_OPTIONAL" });
    albumUpdate.mockClear();
    r = await callPatch({ studentIdentificationMode: "" });
    expect(savedData()).toEqual({ studentIdentificationMode: null });
    r = await callPatch({ studentIdentificationMode: "ZZ" });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      error: "studentIdentificationMode inválido (NONE, MANUAL, ROSTER_OPTIONAL, ROSTER_REQUIRED o vacío)",
    });
  });

  it("comisión: porcentaje fuera de rango → 400; vacío → null; texto numérico → número", async () => {
    let r = await callPatch({ organizerCommissionPercentage: 101 });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "organizerCommissionPercentage inválido (0-100)" });
    r = await callPatch({ organizerCommissionPercentage: "-1" });
    expect(r.status).toBe(400);
    r = await callPatch({ organizerCommissionPercentage: "abc" });
    expect(r.status).toBe(400);
    r = await callPatch({ organizerCommissionPercentage: "" });
    expect(savedData()).toEqual({ organizerCommissionPercentage: null });
    albumUpdate.mockClear();
    r = await callPatch({ organizerCommissionPercentage: "12.5" });
    expect(savedData()).toEqual({ organizerCommissionPercentage: 12.5 });
  });

  it("comisión: 'aplica a' no array → 400; filtra valores desconocidos", async () => {
    let r = await callPatch({ organizerCommissionAppliesTo: "PREVENTA" });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "organizerCommissionAppliesTo debe ser un array" });
    r = await callPatch({ organizerCommissionAppliesTo: ["PREVENTA", "OTRA", "EXTRAS"] });
    expect(r.status).toBe(200);
    expect(savedData()).toEqual({ organizerCommissionAppliesTo: ["PREVENTA", "EXTRAS"] });
  });

  it("todo junto (con tipo) se guarda en un solo update con booleanos convertidos", async () => {
    const r = await callPatch({
      schoolId: 4,
      type: "SCHOOL",
      mode: "SCHOOL",
      studentIdentificationMode: "MANUAL",
      allowManualStudentFallback: 1,
      organizerCommissionEnabled: "",
      organizerCommissionPercentage: 10,
      organizerCommissionAppliesTo: [],
      isTest: 0,
    });
    expect(r.status).toBe(200);
    expect(albumUpdate).toHaveBeenCalledTimes(1);
    expect(savedData()).toEqual({
      schoolId: 4,
      type: "SCHOOL",
      mode: "SCHOOL",
      studentIdentificationMode: "MANUAL",
      allowManualStudentFallback: true,
      organizerCommissionEnabled: false,
      organizerCommissionPercentage: 10,
      organizerCommissionAppliesTo: [],
      isTest: false,
    });
    expect(r.body).toMatchObject({ id: 7, schoolId: 4, mode: "SCHOOL", photosCount: 3 });
  });

  it("tipo desconocido → null (sin error)", async () => {
    const r = await callPatch({ type: "XYZ" });
    expect(r.status).toBe(200);
    expect(savedData()).toEqual({ type: null });
  });
});
