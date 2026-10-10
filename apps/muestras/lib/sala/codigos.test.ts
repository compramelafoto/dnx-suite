import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRoomCode } from "@repo/muestras";

const db = vi.hoisted(() => ({ culturalActivityRoomCode: { findMany: vi.fn(), createMany: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));

const { asegurarCodigosDeSala, nuevoCodigoDeSala } = await import("./codigos");

let tabla: Array<{ code: string; activityId: string; workId: string }>;

beforeEach(() => {
  vi.clearAllMocks();
  tabla = [{ code: "abcdefghjkmn", activityId: "a1", workId: "w1" }];
  db.culturalActivityRoomCode.findMany.mockImplementation(async ({ where }: { where: { activityId: string; workId: { in: string[] } } }) =>
    tabla.filter((r) => r.activityId === where.activityId && where.workId.in.includes(r.workId)).map(({ code, workId }) => ({ code, workId })));
  db.culturalActivityRoomCode.createMany.mockImplementation(async ({ data }: { data: typeof tabla }) => {
    for (const r of data) if (!tabla.some((t) => t.code === r.code || (t.activityId === r.activityId && t.workId === r.workId))) tabla.push(r);
    return { count: data.length };
  });
});

describe("nuevoCodigoDeSala", () => {
  it("da un código válido y descarta los bytes con sesgo", () => {
    expect(isRoomCode(nuevoCodigoDeSala())).toBe(true);
    let vuelta = 0;
    const azar = (n: number) => (vuelta++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(3));
    expect(nuevoCodigoDeSala(azar)).toBe("5".repeat(12));
  });
});

describe("asegurarCodigosDeSala", () => {
  it("crea sólo los que faltan y conserva los que ya estaban", async () => {
    const m = await asegurarCodigosDeSala("a1", ["w1", "w2"]);
    expect(m.get("w1")).toBe("abcdefghjkmn");
    expect(isRoomCode(m.get("w2"))).toBe(true);
    expect(db.culturalActivityRoomCode.createMany).toHaveBeenCalledTimes(1);
    expect(db.culturalActivityRoomCode.createMany.mock.calls[0]![0]).toMatchObject({ skipDuplicates: true, data: [{ activityId: "a1", workId: "w2" }] });
  });

  it("la segunda llamada da la misma respuesta y no crea nada", async () => {
    const primera = await asegurarCodigosDeSala("a1", ["w1", "w2", "w3"]);
    db.culturalActivityRoomCode.createMany.mockClear();
    const segunda = await asegurarCodigosDeSala("a1", ["w1", "w2", "w3"]);
    expect([...segunda]).toEqual([...primera]);
    expect(db.culturalActivityRoomCode.createMany).not.toHaveBeenCalled();
  });

  it("si un código nuevo choca (se saltea o da P2002), vuelve a intentar", async () => {
    db.culturalActivityRoomCode.createMany
      .mockImplementationOnce(async () => ({ count: 0 }))
      .mockImplementationOnce(async () => { throw Object.assign(new Error("único"), { code: "P2002" }); });
    const m = await asegurarCodigosDeSala("a1", ["w2"]);
    expect(isRoomCode(m.get("w2"))).toBe(true);
    expect(db.culturalActivityRoomCode.createMany).toHaveBeenCalledTimes(3);
  });

  it("si nunca entra, avisa en vez de imprimir fichas sin código", async () => {
    db.culturalActivityRoomCode.createMany.mockResolvedValue({ count: 0 });
    await expect(asegurarCodigosDeSala("a1", ["w9"])).rejects.toThrow("No pudimos generar los códigos de sala.");
  });
});
