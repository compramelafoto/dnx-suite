import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Caracterización del POST de /api/admin/schools/[schoolId]/organizers/invite: escrita
  contra el código original y mantenida al mover la lógica a lib/schools/invite-organizer.ts.
  Corre la creación real de la invitación (lib/school-organizer-invitations.ts) con la base
  y el envío de mails simulados.
*/

const m = vi.hoisted(() => ({
  access: vi.fn(),
  userFind: vi.fn(),
  orgFind: vi.fn(),
  orgCreate: vi.fn(),
  orgUpdate: vi.fn(),
  schoolFind: vi.fn(),
  invUpdateMany: vi.fn(),
  invCreate: vi.fn(),
  invFindMany: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => m.userFind(...a) },
    schoolOrganizer: {
      findUnique: (...a: unknown[]) => m.orgFind(...a),
      create: (...a: unknown[]) => m.orgCreate(...a),
      update: (...a: unknown[]) => m.orgUpdate(...a),
    },
    school: { findUnique: (...a: unknown[]) => m.schoolFind(...a) },
    schoolOrganizerInvitation: {
      updateMany: (...a: unknown[]) => m.invUpdateMany(...a),
      create: (...a: unknown[]) => m.invCreate(...a),
      findMany: (...a: unknown[]) => m.invFindMany(...a),
    },
  },
  Role: { ADMIN: "ADMIN", PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER", SCHOOL_ORGANIZER: "SCHOOL_ORGANIZER" },
  SchoolOrganizerStatus: { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" },
  SchoolOrganizerInvitationStatus: { PENDING: "PENDING", CANCELLED: "CANCELLED", ACCEPTED: "ACCEPTED" },
}));
vi.mock("@/lib/school-organizer-management-access", () => ({
  requireSchoolOrganizerManagementAccess: (...a: unknown[]) => m.access(...a),
}));
vi.mock("@/emails/send", () => ({ sendEmail: (...a: unknown[]) => m.send(...a) }));
vi.mock("@/emails/templates/auth", () => ({
  buildSchoolOrganizerInviteEmail: (i: { schoolName: string; inviteUrl: string }) => ({ subject: `Invitación ${i.schoolName}`, html: i.inviteUrl }),
}));

import { POST } from "./route";

async function callPost(schoolId: string, body: unknown, opts: { badJson?: boolean } = {}) {
  const req = {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return body;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any, { params: Promise.resolve({ schoolId }) });
  return { status: res.status, body: await res.json() };
}

const INVITATION = { id: 9, email: "ana@escuela.com", name: "Ana", status: "PENDING", expiresAt: "x", createdAt: "y" };

describe("POST /api/admin/schools/[schoolId]/organizers/invite (caracterización)", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.access.mockResolvedValue({ ok: true, user: { id: 7, email: "f@x.com", name: "Fotógrafa", role: "PHOTOGRAPHER" }, school: { id: 3, ownerId: 7 } });
    m.userFind.mockResolvedValue(null);
    m.schoolFind.mockResolvedValue({ id: 3, name: "Escuela Norte" });
    m.invUpdateMany.mockResolvedValue({ count: 0 });
    m.invCreate.mockResolvedValue(INVITATION);
    m.send.mockResolvedValue({ success: true });
  });

  it("schoolId inválido → 400 sin consultar permisos", async () => {
    for (const id of ["abc", "0", "-1", "1.5"]) {
      const r = await callPost(id, { name: "Ana", email: "ana@escuela.com" });
      expect(r).toEqual({ status: 400, body: { error: "schoolId inválido" } });
    }
    expect(m.access).not.toHaveBeenCalled();
  });

  it("sin permiso → status y error del control de acceso", async () => {
    m.access.mockResolvedValue({ ok: false, status: 403, error: "No tenés permisos para gestionar usuarios de esta escuela." });
    const r = await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    expect(r).toEqual({ status: 403, body: { error: "No tenés permisos para gestionar usuarios de esta escuela." } });
    expect(m.access).toHaveBeenCalledWith({ schoolId: 3 });
    expect(m.invCreate).not.toHaveBeenCalled();
  });

  it("nombre vacío → 400; email inválido → 400; JSON roto cuenta como vacío", async () => {
    expect(await callPost("3", { name: "  ", email: "ana@escuela.com" })).toEqual({ status: 400, body: { error: "El nombre es obligatorio." } });
    expect(await callPost("3", { name: "Ana", email: "no-es-mail" })).toEqual({ status: 400, body: { error: "Email inválido." } });
    expect(await callPost("3", null, { badJson: true })).toEqual({ status: 400, body: { error: "El nombre es obligatorio." } });
    expect(m.userFind).not.toHaveBeenCalled();
  });

  it("email de un usuario que no es de escuela → 409 sin invitar", async () => {
    m.userFind.mockResolvedValue({ id: 50, role: "CUSTOMER" });
    const r = await callPost("3", { name: "Ana", email: "  ANA@Escuela.com " });
    expect(r).toEqual({ status: 409, body: { error: "Ya existe un usuario con ese email y no es usuario de escuela." } });
    expect(m.userFind).toHaveBeenCalledWith({ where: { email: "ana@escuela.com" }, select: { id: true, role: true } });
    expect(m.invCreate).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("usuario de escuela sin membresía → la crea ACTIVE e invita igual", async () => {
    m.userFind.mockResolvedValue({ id: 50, role: "SCHOOL_ORGANIZER" });
    m.orgFind.mockResolvedValue(null);
    const r = await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    expect(r.status).toBe(201);
    expect(m.orgCreate).toHaveBeenCalledWith({ data: { schoolId: 3, userId: 50, status: "ACTIVE" } });
    expect(m.orgUpdate).not.toHaveBeenCalled();
  });

  it("usuario de escuela con membresía inactiva → la reactiva; activa → no toca", async () => {
    m.userFind.mockResolvedValue({ id: 50, role: "SCHOOL_ORGANIZER" });
    m.orgFind.mockResolvedValue({ id: 77, status: "INACTIVE" });
    await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    expect(m.orgUpdate).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: "ACTIVE" } });
    m.orgUpdate.mockReset();
    m.orgFind.mockResolvedValue({ id: 77, status: "ACTIVE" });
    await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    expect(m.orgUpdate).not.toHaveBeenCalled();
    expect(m.orgCreate).not.toHaveBeenCalled();
  });

  it("escuela que desaparece entre medio → 404", async () => {
    m.schoolFind.mockResolvedValue(null);
    expect(await callPost("3", { name: "Ana", email: "ana@escuela.com" })).toEqual({ status: 404, body: { error: "Escuela no encontrada." } });
    expect(m.invCreate).not.toHaveBeenCalled();
  });

  it("invita: cancela las pendientes, crea la invitación, manda el mail y responde 201", async () => {
    const r = await callPost("3", { name: " Ana ", email: "Ana@Escuela.com" });
    expect(r).toEqual({ status: 201, body: { invitation: INVITATION, emailSent: true, emailError: null } });
    expect(m.invUpdateMany).toHaveBeenCalledWith({
      where: { schoolId: 3, email: "ana@escuela.com", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    expect(m.invCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 3, email: "ana@escuela.com", name: "Ana", status: "PENDING", invitedByUserId: 7 }),
      })
    );
    expect(m.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@escuela.com", subject: "Invitación Escuela Norte", templateKey: "SCHOOL_ORGANIZER_INVITE", meta: { userId: 7 } })
    );
  });

  it("mail que falla → 201 con emailSent false y el error", async () => {
    m.send.mockResolvedValue({ success: false, error: "rebotó" });
    const r = await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    expect(r).toEqual({ status: 201, body: { invitation: INVITATION, emailSent: false, emailError: "rebotó" } });
    m.send.mockResolvedValue({ success: false });
    expect((await callPost("3", { name: "Ana", email: "ana@escuela.com" })).body.emailError).toBe("Error enviando email");
  });

  it("error inesperado → 500 con el texto de siempre", async () => {
    m.invCreate.mockRejectedValue(new Error("db"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await callPost("3", { name: "Ana", email: "ana@escuela.com" });
    spy.mockRestore();
    expect(r).toEqual({ status: 500, body: { error: "Error enviando invitación para administrador de escuela." } });
  });

  it("cuerpo JSON null → 500 (como siempre: lee body.name sin chequear)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await callPost("3", null);
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(m.invCreate).not.toHaveBeenCalled();
  });
});
