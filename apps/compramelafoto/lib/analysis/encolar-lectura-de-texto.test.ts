import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ fotos: vi.fn(), actualizar: vi.fn(), crear: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { findMany: (...a: unknown[]) => m.fotos(...a) },
    photoAnalysisJob: {
      updateMany: (...a: unknown[]) => m.actualizar(...a),
      createMany: (...a: unknown[]) => m.crear(...a),
    },
  },
}));
import { encolarLecturaDeTexto, lecturaSeEncendio } from "./encolar-lectura-de-texto";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.actualizar.mockResolvedValue({ count: 0 });
  m.crear.mockResolvedValue({ count: 0 });
});

describe("lecturaSeEncendio", () => {
  test("sólo cuando pasa de no leer a leer", () => {
    // Lorenzo: fútbol sin tipo, enciende el interruptor con las fotos ya subidas.
    expect(lecturaSeEncendio({ textSearchEnabled: null, type: null }, { textSearchEnabled: true, type: null })).toBe(true);
    expect(lecturaSeEncendio({ textSearchEnabled: false, type: "SPORTS" }, { textSearchEnabled: null, type: "SPORTS" })).toBe(true);
    // Ya leía: guardar otra cosa no vuelve a gastar.
    expect(lecturaSeEncendio({ textSearchEnabled: true, type: null }, { textSearchEnabled: true, type: null })).toBe(false);
    expect(lecturaSeEncendio({ textSearchEnabled: null, type: "SPORTS" }, { textSearchEnabled: true, type: "SPORTS" })).toBe(false);
    // Apagarlo nunca encola.
    expect(lecturaSeEncendio({ textSearchEnabled: true, type: null }, { textSearchEnabled: false, type: null })).toBe(false);
  });
});

describe("encolarLecturaDeTexto", () => {
  test("vuelve a la cola sólo las fotos ya analizadas y sin texto leído, marcadas como solo texto", async () => {
    m.fotos.mockResolvedValue([
      { id: 1, analysisJob: { id: 11 } },
      { id: 2, analysisJob: { id: 12 } },
      { id: 3, analysisJob: null },
    ]);
    m.actualizar.mockResolvedValue({ count: 2 });
    m.crear.mockResolvedValue({ count: 1 });

    expect(await encolarLecturaDeTexto(7)).toBe(3);

    expect(m.fotos.mock.calls[0]![0].where).toEqual({
      albumId: 7,
      isRemoved: false,
      analysisStatus: "DONE",
      ocrTokens: { none: {} },
    });
    expect(m.actualizar.mock.calls[0]![0]).toEqual({
      where: { photoId: { in: [1, 2] }, status: { in: ["DONE", "ERROR"] } },
      data: { status: "PENDING", soloTexto: true, attempts: 0, lockedAt: null, runAfter: null, lastError: null },
    });
    expect(m.crear.mock.calls[0]![0]).toEqual({
      data: [{ photoId: 3, status: "PENDING", soloTexto: true }],
      skipDuplicates: true,
    });
  });

  test("sin fotos que releer no toca la cola", async () => {
    m.fotos.mockResolvedValue([]);
    expect(await encolarLecturaDeTexto(7)).toBe(0);
    expect(m.actualizar).not.toHaveBeenCalled();
    expect(m.crear).not.toHaveBeenCalled();
  });
});
