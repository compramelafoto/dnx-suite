import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getPortalUser: vi.fn(),
  isSuperAdmin: vi.fn(),
  reports: vi.fn(),
  blocks: vi.fn(),
  account: vi.fn(),
  stats: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@repo/auth-guards", () => ({ isSuperAdmin: m.isSuperAdmin }));
vi.mock("next/navigation", () => ({
  notFound: m.notFound,
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/guards", () => ({ getPortalUser: m.getPortalUser }));
vi.mock("@/lib/usuarios/bloqueo", () => ({
  listActiveBlocks: m.blocks,
  getAccountForAdmin: m.account,
  findAccountByEmail: vi.fn(),
}));
vi.mock("@/lib/usuarios/reportes", () => ({ listOpenUserReports: m.reports }));
vi.mock("@/lib/admin/estadisticas", () => ({ portalStats: m.stats }));

import AdminPage from "../page";
import UsuariosAdminPage from "./page";

const sp = (v: Record<string, string> = {}) => ({ searchParams: Promise.resolve(v) });

beforeEach(() => {
  vi.clearAllMocks();
  m.getPortalUser.mockResolvedValue({ id: 1 });
  m.isSuperAdmin.mockResolvedValue(true);
  m.reports.mockResolvedValue([
    {
      id: 30,
      reason: "Me pidió pagar por fuera.",
      context: "Venta #5",
      createdAt: new Date("2026-11-27T12:00:00Z"),
      reporter: { id: 2, name: "Ana Compradora", email: "ana@e.test" },
      reported: { id: 7, name: "Beto Vendedor", email: "beto@e.test", blocked: false },
    },
  ]);
  m.blocks.mockResolvedValue([
    { userId: 9, name: "Carla", email: "carla@e.test", reason: "Fraude reiterado", createdAt: new Date() },
  ]);
  m.account.mockResolvedValue(null);
});

describe("/admin/usuarios", () => {
  it("sin super admin -> 404", async () => {
    m.isSuperAdmin.mockResolvedValue(false);
    await expect(UsuariosAdminPage(sp())).rejects.toThrow("NOT_FOUND");
  });

  it("muestra reportes con quién reporta y a quién, el contexto y los bloqueos", async () => {
    const html = renderToStaticMarkup(await UsuariosAdminPage(sp()));
    expect(html).toContain("Ana Compradora · ana@e.test");
    expect(html).toContain("Beto Vendedor · beto@e.test");
    expect(html).toContain("Me pidió pagar por fuera.");
    expect(html).toContain("Venta #5");
    expect(html).toContain('href="/admin/usuarios?usuario=7"');
    expect(html).toContain("Marcar como resuelto");
    expect(html).toContain("Carla · carla@e.test");
    expect(html).toContain("Fraude reiterado");
    expect(html).toContain("Desbloquear");
  });

  it("con ?usuario= muestra la cuenta y el formulario para bloquear; la propia no", async () => {
    m.account.mockResolvedValue({ id: 7, name: "Beto", email: "beto@e.test", blocked: false });
    let html = renderToStaticMarkup(await UsuariosAdminPage(sp({ usuario: "7" })));
    expect(html).toContain("#7 · Beto · beto@e.test");
    expect(html).toContain("Bloquear cuenta");
    m.account.mockResolvedValue({ id: 1, name: "Admin", email: "admin@e.test", blocked: false });
    html = renderToStaticMarkup(await UsuariosAdminPage(sp({ usuario: "1" })));
    expect(html).not.toContain("Bloquear cuenta");
    expect(html).toContain("no se puede bloquear");
  });
});

describe("/admin", () => {
  it("sin super admin -> 404", async () => {
    m.isSuperAdmin.mockResolvedValue(false);
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("tablero con los conteos y los enlaces a cada sección", async () => {
    m.stats.mockResolvedValue({
      identidadesAprobadas: 40,
      telefonosVerificados: 55,
      publicadas: 1200,
      enRevision: 2,
      pausadas: 0,
      vendidas: 4,
      ventasConfirmadas: 3,
      contactos30d: 18,
      favoritos: 25,
      alertasActivas: 6,
      pedidosActivos: 5,
      cuentasBloqueadas: 1,
    });
    const html = renderToStaticMarkup(await AdminPage());
    for (const href of ["/admin/verificaciones", "/admin/publicaciones", "/admin/usuarios"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("1.200");
    expect(html).toContain("Cuentas bloqueadas");
    expect(html).toContain("Pedidos «Busco» activos");
  });
});
