import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  guardar: vi.fn(async (..._a: unknown[]): Promise<{ ok: true } | { ok: false; error: string }> => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/precios/perfil", () => ({ guardarPerfilPrecios: H.guardar }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: "ws-1", name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");

describe("guardarPerfilPreciosAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.role.mockReturnValue("WORKSPACE_OWNER");
  });

  it("sin `configurar` devuelve error y no guarda", async () => {
    H.role.mockReturnValue("WORKSPACE_MEMBER");
    const r = await A.guardarPerfilPreciosAction({});
    expect(r).toEqual({ ok: false, error: "Sólo el dueño o un administrador pueden configurar los precios." });
    expect(H.guardar).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("pasa el contexto de la sesión (nunca un workspaceId del argumento) y revalida", async () => {
    const perfil = { workspaceId: "otro", weeklyHours: "40" };
    const r = await A.guardarPerfilPreciosAction(perfil);
    expect(r).toEqual({ ok: true });
    const [ctx, datos] = H.guardar.mock.calls[0]! as [{ workspaceId: string; userId: number }, unknown];
    expect(ctx.workspaceId).toBe("ws-1");
    expect(ctx.userId).toBe(7);
    expect(datos).toBe(perfil);
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/precios");
  });

  it("devuelve el error de la validación sin revalidar", async () => {
    H.guardar.mockResolvedValueOnce({ ok: false, error: "Falta algo." });
    expect(await A.guardarPerfilPreciosAction({})).toEqual({ ok: false, error: "Falta algo." });
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});

describe("Configuración → Precios (fuente)", () => {
  const leer = (f: string) => readFileSync(join(__dirname, f), "utf8");

  it("la página no importa la base y exige `configurar` antes de leer el perfil", () => {
    const p = leer("page.tsx");
    expect(p).not.toContain("@repo/db");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    expect(p.indexOf("leerPerfilPrecios(")).toBeGreaterThan(guarda);
  });

  it("la acción es de servidor y el formulario de cliente sin base", () => {
    expect(leer("actions.ts").startsWith('"use server";')).toBe(true);
    const c = leer("perfil-form.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toMatch(/@repo\/db|server-only|lib\/precios\/perfil"/);
  });

  it("el índice de Configuración tiene la tarjeta Precios con `configurar`, sin depender de Presupuestos", () => {
    const idx = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const i = idx.indexOf('href="/workspace/configuracion/precios"');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(idx.indexOf('href="/workspace/configuracion/presupuestos"'));
    const apertura = idx.lastIndexOf("{membership?.role", i);
    expect(idx.slice(apertura, i)).toContain('puede(membership.role, "configurar")');
    expect(idx.slice(apertura, i)).not.toContain("presupuestosVisible");
  });
});
