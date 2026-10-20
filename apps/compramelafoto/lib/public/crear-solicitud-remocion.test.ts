import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ photo: vi.fn(), existing: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { findUnique: (...a: unknown[]) => m.photo(...a) },
    removalRequest: {
      findFirst: (...a: unknown[]) => m.existing(...a),
      create: (...a: unknown[]) => m.create(...a),
    },
  },
}));
import { crearSolicitudDeRemocion } from "./crear-solicitud-remocion";

const DATA = {
  albumId: 10,
  photoId: 99,
  requesterName: "Juana",
  requesterEmail: "juana@mail.com",
  requesterPhone: "3415551234",
  reason: "Aparezco yo en la foto",
  declarationOk: true as const,
};
const FOTO = { id: 99, albumId: 10, isRemoved: false, album: { userId: 7 } };

beforeEach(() => {
  m.photo.mockReset();
  m.existing.mockReset();
  m.create.mockReset();
});

describe("crearSolicitudDeRemocion", () => {
  it("foto inexistente → ok:false 404", async () => {
    m.photo.mockResolvedValue(null);
    expect(await crearSolicitudDeRemocion(DATA)).toEqual({ ok: false, status: 404, error: "La foto no existe" });
  });
  it("foto de otro álbum → ok:false 400", async () => {
    m.photo.mockResolvedValue({ ...FOTO, albumId: 3 });
    expect(await crearSolicitudDeRemocion(DATA)).toEqual({
      ok: false,
      status: 400,
      error: "La foto no pertenece a este álbum",
    });
  });
  it("foto removida → ok:false 400", async () => {
    m.photo.mockResolvedValue({ ...FOTO, isRemoved: true });
    expect(await crearSolicitudDeRemocion(DATA)).toEqual({
      ok: false,
      status: 400,
      error: "La foto ya no está disponible",
    });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("duplicada → ok 200 duplicate", async () => {
    m.photo.mockResolvedValue(FOTO);
    m.existing.mockResolvedValue({ id: 3 });
    expect(await crearSolicitudDeRemocion(DATA)).toEqual({
      ok: true,
      status: 200,
      requestId: 3,
      duplicate: true,
      message: "Ya tenemos una solicitud pendiente para esta foto.",
    });
  });
  it("nueva → ok 201 con el dueño del álbum", async () => {
    m.photo.mockResolvedValue(FOTO);
    m.existing.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: 4 });
    expect(await crearSolicitudDeRemocion(DATA)).toEqual({
      ok: true,
      status: 201,
      requestId: 4,
      duplicate: false,
      message: "Recibimos tu solicitud. El fotógrafo la revisará.",
    });
    expect(m.create.mock.calls[0][0].data.photographerId).toBe(7);
  });
});
