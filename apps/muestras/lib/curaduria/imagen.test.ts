import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCallWork: { findUnique: vi.fn() },
  culturalCallCurator: { findFirst: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));

const { imagenAutorizada } = await import("./imagen");

const fila = (status: string, envio = "ACTIVE") => ({
  imageUrl: "https://pub/muestras/7/a.webp", callId: "c1",
  submission: { status: envio }, call: { status, activity: { proposedByUserId: 9 } },
});
const persona = (id: number, esSuperAdmin = false) => ({ id, esSuperAdmin, email: "x@y", name: null });

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
});

describe("imagen por la ruta anónima", () => {
  it("el curador activo la ve durante la curaduría", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING"));
    db.culturalCallCurator.findFirst.mockResolvedValue({ status: "ACTIVE" });
    expect(await imagenAutorizada("w1", persona(20))).toBe("https://pub/muestras/7/a.webp");
  });
  it("el autor no la pide por acá (y un desconocido tampoco)", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING"));
    expect(await imagenAutorizada("w1", persona(7))).toBeNull();
  });
  it("el organizador, desde el cierre", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("OPEN"));
    expect(await imagenAutorizada("w1", persona(9))).toBeNull();
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CLOSED"));
    expect(await imagenAutorizada("w1", persona(9))).not.toBeNull();
  });
  it("un envío retirado no se sirve", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING", "WITHDRAWN"));
    expect(await imagenAutorizada("w1", persona(1, true))).toBeNull();
  });
  it("una obra inexistente", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(null);
    expect(await imagenAutorizada("w1", persona(9))).toBeNull();
  });
  it("busca al curador en la convocatoria de esa obra, no en otra", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING"));
    await imagenAutorizada("w1", persona(20));
    expect(db.culturalCallCurator.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", userId: 20 } }));
  });
});
