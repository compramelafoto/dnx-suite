import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeGearSerial } from "@repo/gear/serial";

const m = vi.hoisted(() => ({
  reportFindFirst: vi.fn(),
  lookupCount: vi.fn(),
  lookupCreate: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    stolenGearReport: { findFirst: m.reportFindFirst },
    gearSerialLookup: { count: m.lookupCount, create: m.lookupCreate },
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import { lookupSerial } from "./consultar";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ADMIN_EMAIL = "admin@dnx.test";
  process.env.CLF_URL = "https://clf.test/";
  m.reportFindFirst.mockResolvedValue(null);
  m.lookupCount.mockResolvedValue(0);
  m.lookupCreate.mockResolvedValue({ id: 1 });
  m.email.mockResolvedValue({ success: true });
});

describe("lookupSerial", () => {
  it.each(["0123-45", "12345", " 012345 "])("«%s» encuentra la denuncia de 12345", async (raw) => {
    m.reportFindFirst.mockResolvedValue({ id: 9 });
    const res = await lookupSerial(1, raw);
    expect(res).toEqual({ result: "CON_DENUNCIA", serial: normalizeGearSerial(raw) });
    expect(m.reportFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serialNormalized: normalizeGearSerial(raw),
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("sin denuncia: registra la consulta sin denuncia y no avisa", async () => {
    const res = await lookupSerial(1, "ABC-1234");
    expect(res).toMatchObject({ result: "SIN_DENUNCIA" });
    expect(m.lookupCreate).toHaveBeenCalledWith({
      data: { userId: 1, serialNormalized: normalizeGearSerial("ABC-1234"), matchedReportId: null },
    });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("con denuncia: registra el número de denuncia y avisa al admin", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 9 });
    await lookupSerial(7, "ABC-1234");
    expect(m.lookupCreate).toHaveBeenCalledWith({
      data: { userId: 7, serialNormalized: normalizeGearSerial("ABC-1234"), matchedReportId: 9 },
    });
    expect(m.email).toHaveBeenCalledWith(
      "admin@dnx.test",
      "consulta_serie_coincide_admin",
      expect.objectContaining({
        usuario: "7",
        serie: normalizeGearSerial("ABC-1234"),
        denuncia: "9",
        url: "https://e.test/admin/publicaciones",
      }),
    );
  });

  it("el resultado no trae datos de la denuncia", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 9, reporterId: 3, place: "Rosario" });
    const res = await lookupSerial(1, "12345");
    expect(Object.keys(res).sort()).toEqual(["result", "serial"]);
  });

  it("30 consultas en 24 h → LIMITE sin registrar", async () => {
    m.lookupCount.mockResolvedValue(30);
    expect(await lookupSerial(1, "12345")).toEqual({ error: "LIMITE" });
    expect(m.lookupCreate).not.toHaveBeenCalled();
    expect(m.reportFindFirst).not.toHaveBeenCalled();
  });

  it("cuenta las consultas del usuario de las últimas 24 h", async () => {
    await lookupSerial(4, "12345");
    const arg = m.lookupCount.mock.calls[0][0];
    expect(arg.where.userId).toBe(4);
    expect(Date.now() - arg.where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(
      24 * 3600 * 1000 - 1000,
    );
  });

  it("serie inválida no se registra", async () => {
    expect(await lookupSerial(1, "ab")).toEqual({ error: "SERIE_INVALIDA" });
    expect(m.lookupCount).not.toHaveBeenCalled();
    expect(m.lookupCreate).not.toHaveBeenCalled();
  });

  it("si falla el aviso al admin, igual devuelve el resultado", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 9 });
    m.email.mockRejectedValue(new Error("x"));
    expect(await lookupSerial(1, "12345")).toMatchObject({ result: "CON_DENUNCIA" });
  });
});
