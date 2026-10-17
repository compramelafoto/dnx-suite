import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  role: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  memberships: vi.fn(),
  assignments: vi.fn(),
  invitations: vi.fn(),
  enabled: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect, useRouter: () => ({ refresh: () => {} }) }));
vi.mock("./actions", () => ({
  inviteTeamAction: async () => ({ error: null }),
  removeMemberAction: async () => ({ error: null }),
  resendInvitationAction: async () => ({ error: null }),
  revokeInvitationAction: async () => ({ error: null }),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findMany: m.memberships },
    workspaceRoleAssignment: { findMany: m.assignments },
    workspaceInvitation: { findMany: m.invitations },
  },
}));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: async () => ({
    user: { id: 1, email: "daniel@x.test", name: "Daniel" },
    workspace: { id: "ws1", name: "DNX Estudio" },
    role: m.role(),
  }),
}));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: m.enabled }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));

const { default: EquipoPage } = await import("./page");

const d = (s: string) => new Date(s);

beforeEach(() => {
  Object.values(m).forEach((f) => "mockReset" in f && f !== m.redirect && f.mockReset());
  m.memberships.mockResolvedValue([
    { role: "STAFF", createdAt: d("2026-10-17T15:00:00Z"), user: { id: 7, name: "Sabina", email: "sabi@x.test" } },
    { role: "WORKSPACE_OWNER", createdAt: d("2026-01-02T15:00:00Z"), user: { id: 1, name: "Daniel", email: "daniel@x.test" } },
    { role: "STAFF", createdAt: d("2026-10-01T15:00:00Z"), user: { id: 8, name: null, email: "socio@x.test" } },
  ]);
  m.assignments.mockResolvedValue([{ userId: null, member: { userId: 8 } }]);
  m.invitations.mockResolvedValue([
    {
      id: "i1",
      email: "cami@x.test",
      role: "STAFF",
      createdAt: d("2026-10-17T02:00:00Z"),
      expiresAt: d("2026-10-24T02:00:00Z"),
      sentAt: null,
      sendFailedAt: d("2026-10-17T02:00:01Z"),
    },
  ]);
  m.enabled.mockResolvedValue(new Set(["cash", "clients", "agenda", "quotes", "orders", "members", "membership-dues"]));
});

async function render() {
  return renderToStaticMarkup(await EquipoPage());
}

describe("pantalla Equipo", () => {
  it.each(["STAFF", "COLLABORATOR", null])("%s no entra: vuelve a Configuración", async (rol) => {
    m.role.mockReturnValue(rol);
    await expect(EquipoPage()).rejects.toThrow("REDIRECT /workspace/configuracion");
    expect(m.memberships).not.toHaveBeenCalled();
  });

  it("lista el equipo con rol y fecha (hora argentina), dueño primero", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    const h = await render();
    expect(h.indexOf("Daniel")).toBeLessThan(h.indexOf("Sabina"));
    expect(h).toContain("daniel@x.test · Dueño · desde el 02/01/2026");
    expect(h).toContain("sabi@x.test · Equipo · desde el 17/10/2026");
    expect(h).toContain("(vos)");
  });

  it("sólo ofrece dar de baja a Equipo sin roles de la comisión", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    const h = await render();
    expect(h.match(/Dar de baja/g)).toHaveLength(1);
    expect(h).toContain("se administra desde Comisión directiva");
  });

  it("invitaciones pendientes: enviada, vencimiento y estado del correo (hora argentina)", async () => {
    m.role.mockReturnValue("WORKSPACE_ADMIN");
    const h = await render();
    expect(h).toContain("cami@x.test");
    // 02:00 UTC del 17 son las 23:00 del 16 en Buenos Aires.
    expect(h).toContain("enviada el 16/10/2026");
    expect(h).toContain("vence el 23/10/2026");
    expect(h).toContain("El correo no salió");
    expect(h).toContain("Reenviar");
    expect(h).toContain("Cancelar");
  });

  it("roles: Administrador y Equipo con lo que puede cada uno; nunca Colaborador ni Dueño", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    const h = await render();
    expect(h).toContain('value="WORKSPACE_ADMIN"');
    expect(h).toContain('value="STAFF"');
    expect(h).not.toContain('value="COLLABORATOR"');
    expect(h).not.toContain('value="WORKSPACE_OWNER"');
    expect(h).toContain("Trabaja en Presupuestos, Pedidos, Caja, Agenda y Clientes.");
    expect(h).toContain("Sólo mira Socios.");
    expect(h).toContain("No entra a la configuración ni gestiona el equipo.");
    expect(h).toMatch(/name="role" checked="" value="STAFF"/);
  });

  it("sin invitaciones pendientes", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invitations.mockResolvedValue([]);
    expect(await render()).toContain("No hay invitaciones esperando respuesta.");
  });
});

describe("enlace de invitación", () => {
  it("se muestra con el botón de copiar y el aviso de que es una sola vez", async () => {
    const { EnlaceDeInvitacion } = await import("./equipo-client");
    const h = renderToStaticMarkup(createElement(EnlaceDeInvitacion, { url: "https://f.test/invitacion/equipo/abc" }));
    expect(h).toContain('value="https://f.test/invitacion/equipo/abc"');
    expect(h).toContain("Copiar enlace de invitación");
    expect(h).toContain("una sola vez");
  });
});
