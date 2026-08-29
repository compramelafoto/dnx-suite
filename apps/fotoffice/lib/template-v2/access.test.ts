import { describe, expect, it } from "vitest";
import { canDesignTemplates } from "./access";
import { canManageMembers } from "@/lib/members/role-policy";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

describe("canDesignTemplates", () => {
  it("el dueño de la institución puede diseñar", () => {
    // La regresión concreta: esto devolvía false y el diseñador rebotaba al inicio.
    expect(canDesignTemplates("WORKSPACE_OWNER")).toBe(true);
  });

  it("el administrador también", () => {
    expect(canDesignTemplates("WORKSPACE_ADMIN")).toBe(true);
  });

  it("STAFF no: administra el día a día, no la identidad visual", () => {
    expect(canDesignTemplates("STAFF")).toBe(false);
  });

  it("sin rol, no", () => {
    expect(canDesignTemplates(null)).toBe(false);
    expect(canDesignTemplates(undefined)).toBe(false);
    expect(canDesignTemplates("")).toBe(false);
  });

  it("no acepta los valores que no existen en la base", () => {
    // Son los que estaban escritos en el control roto. Si alguien los vuelve a poner,
    // este test explica por qué no sirven.
    expect(canDesignTemplates("OWNER")).toBe(false);
  });

  it("dice lo mismo que los otros dos permisos de gobierno", () => {
    for (const rol of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN", "STAFF", "", null]) {
      expect(canDesignTemplates(rol), `discrepa en "${rol}"`).toBe(canManageWorkspaceSettings(rol));
      expect(canDesignTemplates(rol), `discrepa en "${rol}"`).toBe(canManageMembers(rol));
    }
  });
});

describe("los puntos de control del diseñador", () => {
  /*
   * Este test lee el código fuente, que es raro, y lo hace por una razón concreta: el defecto
   * no fue una lógica equivocada sino una lista de roles escrita a mano en cuatro archivos,
   * con valores que no existen en la base. Ningún test de comportamiento lo habría notado,
   * porque cada pantalla "funcionaba": redirigía. Lo que hay que impedir es que vuelva a
   * haber una lista suelta.
   */
  const ARCHIVOS = [
    "app/(shell)/members/disenador/page.tsx",
    "app/(shell)/members/disenador/[templateId]/[versionId]/page.tsx",
    "app/actions/carnet-template.ts",
    "lib/template-v2/server.ts",
  ];

  it.each(ARCHIVOS)("%s decide el permiso con canDesignTemplates", async (ruta) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(import.meta.dirname, "..", "..", ruta), "utf8");

    expect(src).toContain("canDesignTemplates");
    // Ningún rol escrito a mano: si hace falta uno nuevo, va en access.ts.
    expect(src).not.toMatch(/["'](?:WORKSPACE_)?(?:OWNER|ADMIN|STAFF)["']/);
  });
});
