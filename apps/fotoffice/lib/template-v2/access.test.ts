import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ hasLevel: vi.fn() }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.hasLevel }));

const { canDesignTemplates } = await import("./access");

beforeEach(() => {
  H.hasLevel.mockReset();
});

describe("canDesignTemplates: members MANAGE (roles etapa 2b)", () => {
  it("pregunta el nivel de ESTA persona en ESTE workspace, en Socios y con MANAGE", async () => {
    H.hasLevel.mockResolvedValue(true);
    await expect(canDesignTemplates(7, "ws-1")).resolves.toBe(true);
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "members", "MANAGE");
  });

  it("sin MANAGE en Socios (STAFF de siempre tiene VIEW), no diseña", async () => {
    H.hasLevel.mockResolvedValue(false);
    await expect(canDesignTemplates(7, "ws-1")).resolves.toBe(false);
  });
});

describe("los puntos de control del diseñador", () => {
  /*
   * Este test lee el código fuente, que es raro, y lo hace por una razón concreta: el defecto
   * original no fue una lógica equivocada sino una lista de roles escrita a mano en cuatro
   * archivos, con valores que no existen en la base. Ningún test de comportamiento lo habría
   * notado, porque cada pantalla "funcionaba": redirigía. Lo que hay que impedir es que vuelva
   * a haber una lista suelta, o un punto que decida por su cuenta.
   */
  const ARCHIVOS = [
    "app/(shell)/members/disenador/page.tsx",
    // El editor está en el grupo de ruta (editor), no en (shell): se mudó ahí en 35c52837
    // para ocupar la ventana entera, sin menú ni cabecera. La URL es la misma.
    "app/(editor)/members/disenador/[templateId]/[versionId]/page.tsx",
    "app/actions/carnet-template.ts",
    "lib/template-v2/server.ts",
  ];

  it.each(ARCHIVOS)("%s decide el permiso con canDesignTemplates", async (ruta) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(import.meta.dirname, "..", "..", ruta), "utf8");

    expect(src).toMatch(/await canDesignTemplates\(user\.id, workspace\.id\)/);
    // Ningún rol escrito a mano: el permiso sale del nivel en Socios.
    expect(src).not.toMatch(/["'](?:WORKSPACE_)?(?:OWNER|ADMIN|STAFF)["']/);
  });
});
