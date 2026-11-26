import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  phoneFind: vi.fn(),
  phoneUpsert: vi.fn(),
  idUpdateMany: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    phoneVerification: { findUnique: m.phoneFind, upsert: m.phoneUpsert },
    identityVerification: { updateMany: m.idUpdateMany },
  },
}));

import { startPhoneVerification } from "./registrar";

const now = new Date("2026-11-25T12:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  m.phoneUpsert.mockResolvedValue({});
  m.idUpdateMany.mockResolvedValue({ count: 1 });
});

describe("startPhoneVerification", () => {
  it("rechaza un teléfono inválido sin escribir", async () => {
    const r = await startPhoneVerification(1, "12", now);
    expect(r.ok).toBe(false);
    expect(m.phoneUpsert).not.toHaveBeenCalled();
  });

  it("guarda número normalizado, código nuevo y vence en 15 minutos", async () => {
    m.phoneFind.mockResolvedValue(null);
    const r = await startPhoneVerification(1, "341 555-1234", now);
    expect(r.ok).toBe(true);
    const arg = m.phoneUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 1 });
    expect(arg.update.phone).toBe("543415551234");
    expect(arg.update.code).toMatch(/^EQ-\d{6}$/);
    expect(arg.update.codeExpiresAt).toEqual(new Date("2026-11-25T12:15:00Z"));
    expect(arg.update.verifiedAt).toBeNull();
    expect(m.idUpdateMany).not.toHaveBeenCalled();
  });

  it("cambiar un teléfono ya verificado exige reverificar la identidad", async () => {
    m.phoneFind.mockResolvedValue({ phone: "543415551234", verifiedAt: new Date("2026-11-01") });
    await startPhoneVerification(1, "11 2345-6789", now);
    expect(m.idUpdateMany).toHaveBeenCalledWith({ where: { userId: 1 }, data: { reverifyRequiredAt: now } });
  });

  it("reenviar el mismo teléfono verificado no exige reverificar", async () => {
    m.phoneFind.mockResolvedValue({ phone: "543415551234", verifiedAt: new Date("2026-11-01") });
    await startPhoneVerification(1, "+54 9 341 5551234", now);
    expect(m.idUpdateMany).not.toHaveBeenCalled();
  });
});
