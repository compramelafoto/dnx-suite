import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de "Mis tareas" en el inicio y del informe de Captación. */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

describe("Mis tareas e informe", () => {
  it("los componentes son de cliente, sin la base ni valores de módulos del servidor", () => {
    for (const f of ["mis-tareas.tsx", "informe.tsx"]) {
      const c = leer("components", "circuitos", f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toMatch(/import \{[^}]*\} from "@\/lib\/circuitos\/(informe|inicio|tareas)"/);
    }
    expect(leer("components", "circuitos", "mis-tareas.tsx")).toContain("tildarTareaAction(");
  });

  it("el inicio muestra Mis tareas sólo si hay y a través de la carga protegida", () => {
    const p = leer("app", "(shell)", "dashboard", "page.tsx");
    expect(p).toContain("misTareasDelInicio(user, workspace.id,");
    expect(p).toContain("{tareas ? <MisTareas grupos={tareas} /> : null}");
  });

  it("el informe vive en /consultas/informe: guarda primero, circuito del workspace y período en hora AR", () => {
    const p = leer("app", "(shell)", "consultas", "informe", "page.tsx");
    const guarda = p.indexOf("await requireServiceLeadsStaff()");
    expect(guarda).toBeGreaterThan(0);
    expect(guarda).toBeLessThan(p.indexOf("await searchParams"));
    expect(guarda).toBeLessThan(p.indexOf("informeCircuito("));
    expect(p).toContain("circuitosDelInforme(workspace.id, pedido)");
    expect(p).toContain("informeCircuito(workspace.id, elegido,");
    expect(p).toContain("resolverPeriodo(periodo, hoyEnBuenosAires(");
    expect(p).toContain('activa="informe"');
    expect(leer("app", "(shell)", "consultas", "page.tsx")).toContain('if (vista === "informe") redirect("/consultas/informe");');
  });
});
