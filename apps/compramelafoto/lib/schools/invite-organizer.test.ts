import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ owned: vi.fn(), userFind: vi.fn(), schoolFind: vi.fn(), invite: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => m.userFind(...a) },
    school: { findUnique: (...a: unknown[]) => m.schoolFind(...a) },
    schoolOrganizer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/schools/school-setup", () => ({ findOwnedSchool: (...a: unknown[]) => m.owned(...a) }));
vi.mock("@/lib/school-organizer-invitations", () => ({
  createSchoolOrganizerInvitation: (...a: unknown[]) => m.invite(...a),
  normalizeEmail: (v: string) => v.trim().toLowerCase(),
  isValidEmail: (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
}));

import { inviteSchoolOrganizerForOwner } from "./invite-organizer";

const owner = { id: 7, name: "Fotógrafa" };
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("inviteSchoolOrganizerForOwner", () => {
  it("escuela ajena o inexistente → 404 sin consultar nada más ni mandar mail", async () => {
    m.owned.mockResolvedValue(null);
    const r = await inviteSchoolOrganizerForOwner({ owner, schoolId: 3, name: "Ana", email: "ana@e.com" });
    expect(r).toEqual({ ok: false, status: 404, error: "Escuela no encontrada." });
    expect(m.owned).toHaveBeenCalledWith(7, 3);
    expect(m.userFind).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("escuela propia → invita con el fotógrafo como quien invita", async () => {
    m.owned.mockResolvedValue({ id: 3, name: "Norte" });
    m.userFind.mockResolvedValue(null);
    m.schoolFind.mockResolvedValue({ id: 3, name: "Norte" });
    m.invite.mockResolvedValue({ invitation: { id: 1 }, emailSent: true, emailError: null });
    const r = await inviteSchoolOrganizerForOwner({ owner, schoolId: 3, name: "Ana", email: "ANA@e.com" });
    expect(r).toEqual({ ok: true, invitation: { id: 1 }, emailSent: true, emailError: null });
    expect(m.invite).toHaveBeenCalledWith({ schoolId: 3, email: "ana@e.com", name: "Ana", invitedByUserId: 7, invitedByName: "Fotógrafa", schoolName: "Norte" });
  });

  it("mail de un usuario que no es de escuela → 409", async () => {
    m.owned.mockResolvedValue({ id: 3, name: "Norte" });
    m.userFind.mockResolvedValue({ id: 50, role: "PHOTOGRAPHER" });
    const r = await inviteSchoolOrganizerForOwner({ owner, schoolId: 3, name: "Ana", email: "ana@e.com" });
    expect(r).toEqual({ ok: false, status: 409, error: "Ya existe un usuario con ese email y no es usuario de escuela." });
    expect(m.invite).not.toHaveBeenCalled();
  });
});
