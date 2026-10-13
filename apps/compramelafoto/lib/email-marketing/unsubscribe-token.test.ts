import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: m } }));
import { ensureUnsubscribeToken } from "./unsubscribe-token";

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); });

// Caracterización del helper extraído de app/api/admin/email-campaigns/[id]/send/route.ts (sin cambio de comportamiento).
describe("ensureUnsubscribeToken", () => {
  it("devuelve el token existente sin escribir", async () => {
    m.findUnique.mockResolvedValue({ unsubscribeToken: "ya" });
    expect(await ensureUnsubscribeToken(3)).toBe("ya");
    expect(m.findUnique).toHaveBeenCalledWith({ where: { id: 3 }, select: { unsubscribeToken: true } });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("si no tiene, genera 24 bytes en hex y lo guarda", async () => {
    m.findUnique.mockResolvedValue({ unsubscribeToken: null });
    const t = await ensureUnsubscribeToken(3);
    expect(t).toMatch(/^[0-9a-f]{48}$/);
    expect(m.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { unsubscribeToken: t } });
  });
  it("usuario inexistente → error", async () => {
    m.findUnique.mockResolvedValue(null);
    await expect(ensureUnsubscribeToken(3)).rejects.toThrow("Usuario no encontrado");
  });
});
