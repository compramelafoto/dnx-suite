import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeRoomPass } from "@repo/muestras";

const db = vi.hoisted(() => ({ culturalActivityRoomKey: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));

const { firmarPase, leerPase, llaveDeMuestra, rotarLlave } = await import("./llave");

const LLAVE = "a".repeat(64);
const OTRA = "b".repeat(64);
const pase = { v: 1 as const, a: "a1", exp: 1_900_000_000_000, w: ["w1", "w2"] };

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivityRoomKey.findUnique.mockResolvedValue(null);
  db.culturalActivityRoomKey.create.mockImplementation(async ({ data }: { data: { secret: string } }) => ({ secret: data.secret }));
  db.culturalActivityRoomKey.upsert.mockResolvedValue({});
});

describe("firmar y leer el pase", () => {
  it("lo firmado con la llave se lee igual", () => {
    expect(leerPase(firmarPase(pase, LLAVE), LLAVE)).toEqual(pase);
  });
  it("un carácter cambiado, otra llave o basura: null, sin excepción", () => {
    const firmado = firmarPase(pase, LLAVE);
    const [payload, firma] = firmado.split(".") as [string, string];
    const cambiada = `${payload}.${firma[0] === "A" ? "B" : "A"}${firma.slice(1)}`;
    expect(leerPase(cambiada, LLAVE)).toBeNull();
    expect(leerPase(firmado, OTRA)).toBeNull();
    for (const basura of ["", ".", "x.y", "a.b.c", `${payload}.`, `.${firma}`, "%%%", "é".repeat(5000), undefined, null]) {
      expect(leerPase(basura, LLAVE)).toBeNull();
    }
  });
  it("un contenido cambiado con la firma vieja no se acepta (la firma se verifica antes de leer)", () => {
    const [, firma] = firmarPase(pase, LLAVE).split(".") as [string, string];
    const otro = encodeRoomPass({ ...pase, w: [...pase.w, "w-oculta"] });
    expect(leerPase(`${otro}.${firma}`, LLAVE)).toBeNull();
  });
  it("una firma de largo distinto no llega a compararse", () => {
    const [payload] = firmarPase(pase, LLAVE).split(".") as [string];
    expect(leerPase(`${payload}.${"A".repeat(42)}`, LLAVE)).toBeNull();
    expect(leerPase(`${payload}.${"A".repeat(44)}`, LLAVE)).toBeNull();
  });
});

describe("la llave de la muestra", () => {
  it("se crea la primera vez con 32 bytes al azar y después se reusa", async () => {
    const k = await llaveDeMuestra("a1");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: k });
    expect(await llaveDeMuestra("a1")).toBe(k);
    expect(db.culturalActivityRoomKey.create).toHaveBeenCalledTimes(1);
  });
  it("si dos escaneos la crean a la vez, queda la del índice", async () => {
    db.culturalActivityRoomKey.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ secret: OTRA });
    db.culturalActivityRoomKey.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    expect(await llaveDeMuestra("a1")).toBe(OTRA);
  });
  it("rotar cambia el secreto", async () => {
    await rotarLlave("a1");
    const arg = db.culturalActivityRoomKey.upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ activityId: "a1" });
    expect(arg.update.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(arg.update.rotatedAt).toBeInstanceOf(Date);
  });
});
