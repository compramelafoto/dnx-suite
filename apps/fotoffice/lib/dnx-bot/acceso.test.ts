import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  env: { enabled: true, key: "k" as string | null },
  user: { id: 7, name: "Daniel", email: "d@x.test" } as { id: number; name: string | null; email: string } | null,
  workspace: { id: "ws1", name: "DNX Estudio" } as { id: string; name: string } | null,
  acceso: { role: "WORKSPACE_OWNER" as string | null, levels: { quotes: "MANAGE", "service-leads": "MANAGE" } as Record<string, string> },
  modulos: new Set(["dnx-bot", "quotes", "service-leads"]),
  branding: { organizationType: "PHOTO_STUDIO", activityType: null } as { organizationType: string | null; activityType: string | null } | null,
  getAuthUser: vi.fn(),
  avisarSinClave: vi.fn(),
}));

vi.mock("./config", async (orig) => ({
  ...(await orig<object>()),
  leerConfigBot: () => ({ enabled: H.env.enabled, anthropicApiKey: H.env.key }),
}));
vi.mock("./incidentes", () => ({ avisarSinClave: (...a: unknown[]) => H.avisarSinClave(...a) }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => H.getAuthUser() }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: async () => H.workspace }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: async () => H.acceso }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async (_ws: string, k: string) => H.modulos.has(k) }));
vi.mock("@repo/db", () => ({ prisma: { fotofficeWorkspaceBranding: { findUnique: async () => H.branding } } }));

import type { AccesoEfectivo } from "@/lib/access/policy";
import { capacidadesDe, esEmpresaDeFotografia, resolverBot } from "./acceso";

const acc = (role: string | null, levels: Record<string, string>) => ({ role, levels }) as unknown as AccesoEfectivo;

beforeEach(() => {
  H.env = { enabled: true, key: "k" };
  H.user = { id: 7, name: "Daniel", email: "d@x.test" };
  H.workspace = { id: "ws1", name: "DNX Estudio" };
  H.acceso = { role: "WORKSPACE_OWNER", levels: { quotes: "MANAGE", "service-leads": "MANAGE" } };
  H.modulos = new Set(["dnx-bot", "quotes", "service-leads"]);
  H.branding = { organizationType: "PHOTO_STUDIO", activityType: null };
  H.getAuthUser.mockReset().mockImplementation(async () => H.user);
  H.avisarSinClave.mockReset().mockResolvedValue(undefined);
});

describe("resolverBot: las puertas en orden", () => {
  it("1 · interruptor apagado: no toca la sesión", async () => {
    H.env.enabled = false;
    expect(await resolverBot()).toEqual({ ok: false, motivo: "interruptor" });
    expect(H.getAuthUser).not.toHaveBeenCalled();
  });
  it("2 · sin clave: apagado, avisa y no toca la sesión", async () => {
    H.env.key = null;
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_clave" });
    expect(H.avisarSinClave).toHaveBeenCalledTimes(1);
    expect(H.getAuthUser).not.toHaveBeenCalled();
  });
  it("3 · sin sesión, sin workspace o sin rol de equipo (socio del portal)", async () => {
    H.user = null;
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_sesion" });
    H.user = { id: 7, name: null, email: "d@x.test" };
    H.workspace = null;
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_workspace" });
    H.workspace = { id: "ws1", name: "X" };
    H.acceso = { role: null, levels: {} };
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_workspace" });
  });
  it("4 · sin la fila de piloto dnx-bot", async () => {
    H.modulos.delete("dnx-bot");
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_piloto" });
  });
  it("5 · tipo de organización: vacío o institución no pasan; el activityType viejo sí", async () => {
    H.branding = { organizationType: null, activityType: null };
    expect(await resolverBot()).toEqual({ ok: false, motivo: "tipo_de_organizacion" });
    H.branding = { organizationType: "PHOTOGRAPHERS_ASSOCIATION", activityType: null };
    expect(await resolverBot()).toEqual({ ok: false, motivo: "tipo_de_organizacion" });
    H.branding = null;
    expect(await resolverBot()).toEqual({ ok: false, motivo: "tipo_de_organizacion" });
    H.branding = { organizationType: null, activityType: "studio" };
    expect((await resolverBot()).ok).toBe(true);
  });
  it("6 · Consultas y Presupuestos encendidos", async () => {
    H.modulos.delete("quotes");
    expect(await resolverBot()).toEqual({ ok: false, motivo: "modulos" });
    H.modulos.add("quotes");
    H.modulos.delete("service-leads");
    expect(await resolverBot()).toEqual({ ok: false, motivo: "modulos" });
  });
  it("7 · sin «Ver» en Presupuestos no pasa", async () => {
    H.acceso = { role: "STAFF", levels: { quotes: "NONE", "service-leads": "VIEW" } };
    expect(await resolverBot()).toEqual({ ok: false, motivo: "sin_permiso" });
  });
  it("dueño: todo, con la plataforma del workspace activo", async () => {
    const r = await resolverBot();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ctx).toMatchObject({
      workspaceId: "ws1",
      workspaceNombre: "DNX Estudio",
      userId: 7,
      userLabel: "Daniel",
      role: "WORKSPACE_OWNER",
      plataforma: "FOTOFFICE:ws1",
      capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true },
    });
  });
  it("STAFF con «Gestionar» en Presupuestos: entra, pero sin configurar (no calcula ni ve costos)", async () => {
    H.acceso = { role: "STAFF", levels: { quotes: "MANAGE", "service-leads": "NONE" } };
    const r = await resolverBot();
    expect(r.ok && r.ctx.capacidades).toEqual({ configurar: false, gestionarPresupuestos: true, verConsultas: false });
  });
});

describe("piezas puras", () => {
  it("esEmpresaDeFotografia", () => {
    for (const t of ["PHOTO_STUDIO", "PHOTOGRAPHY_COMPANY", "FREELANCE_PHOTOGRAPHER", "AGENCY_PRODUCTION"]) expect(esEmpresaDeFotografia(t, null)).toBe(true);
    for (const t of ["NONPROFIT", "OTHER", "EDUCATIONAL_INSTITUTION", "", null]) expect(esEmpresaDeFotografia(t, null)).toBe(false);
    expect(esEmpresaDeFotografia(null, "independent")).toBe(true);
    expect(esEmpresaDeFotografia(null, "agency")).toBe(true);
    // El tipo nuevo manda sobre el viejo.
    expect(esEmpresaDeFotografia("NONPROFIT", "studio")).toBe(false);
  });
  it("capacidadesDe: admin configura; COLLABORATOR no", () => {
    expect(capacidadesDe(acc("WORKSPACE_ADMIN", { quotes: "MANAGE", "service-leads": "MANAGE" }))).toEqual({ configurar: true, gestionarPresupuestos: true, verConsultas: true });
    expect(capacidadesDe(acc("COLLABORATOR", { quotes: "VIEW" }))).toEqual({ configurar: false, gestionarPresupuestos: false, verConsultas: false });
  });
});
