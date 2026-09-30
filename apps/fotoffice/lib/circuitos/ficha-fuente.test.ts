import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de la ficha de una consulta (`/captacion/[id]`). */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (f: string) => leer("components", "circuitos", f);
const pagina = () => leer("app", "(shell)", "captacion", "[id]", "page.tsx");

describe("ficha de la consulta", () => {
  it("la guarda corre antes de leer y un id ajeno o inexistente es «no encontrado»", () => {
    const p = pagina();
    const guarda = p.indexOf("await requireServiceLeadsStaff()");
    expect(guarda).toBeGreaterThan(0);
    expect(guarda).toBeLessThan(p.indexOf("await params"));
    expect(guarda).toBeLessThan(p.indexOf("cargarFicha("));
    // El workspace sale de la sesión, nunca de la dirección.
    expect(p).toContain("cargarFicha(workspace.id, id,");
    expect(p).toContain("if (!ficha) notFound();");
    expect(p).toContain("if (!ID_VALIDO.test(id)) notFound();");
    expect(p).not.toContain("@repo/db");
  });

  it("los componentes de cliente no importan la base ni valores de módulos del servidor", () => {
    for (const f of ["recorrido.tsx", "tareas.tsx"]) {
      const c = componente(f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toMatch(/import \{[^}]*\} from "@\/lib\/circuitos\/(ficha|tablero|recorridos|tareas)"/);
    }
    for (const f of ["proyeccion.tsx", "historial.tsx"]) {
      const c = componente(f);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toMatch(/import \{[^}]*\} from "@\/lib\/circuitos\/ficha"/);
    }
  });

  it("ganar se confirma siempre y perder pide motivo, con `esperado` y «Pasar igual» sólo a quien puede", () => {
    const r = componente("recorrido.tsx");
    expect(r).toContain("<DialogoGanada");
    expect(r).toContain("<DialogoPerdida");
    expect(r).toContain("setGanando(true)");
    // El único cierre como ganada sale de la confirmación del diálogo.
    expect(r.match(/ejecutar\(\{ tipo: "ganar" \}\)/g)).toHaveLength(1);
    expect(r.indexOf('ejecutar({ tipo: "ganar" })')).toBeGreaterThan(r.indexOf("<DialogoGanada"));
    expect(r).toContain("esperado");
    expect(r).toContain("forzar: true");
    expect(r).toContain("puedePasarIgual &&");
    expect(r).toContain("router.refresh()");
    const cambio = leer("lib", "circuitos", "recorridos.ts").match(/cambio: "([^"]+)"/)?.[1];
    expect(r).toContain(`MENSAJE_CAMBIO = "${cambio}"`);
  });

  it("el vencimiento y las tareas usan las acciones del motor", () => {
    const r = componente("recorrido.tsx");
    for (const x of ["cambiarVencimientoAction(", "asignarResponsableAction(", "moverAction(", "cerrarAction("]) expect(r, x).toContain(x);
    const t = componente("tareas.tsx");
    for (const x of ["tildarTareaAction(", "crearTareaAction(", "borrarTareaAction("]) expect(t, x).toContain(x);
    // Sólo las agregadas a mano se pueden borrar.
    expect(t).toContain("t.suelta ? (");
  });

  it("proyección con el aviso de etapa vencida e historial con «avanzó con tareas pendientes»", () => {
    expect(componente("proyeccion.tsx")).toContain("proyeccion.desdeHoy ?");
    expect(componente("proyeccion.tsx")).toContain("AVISO_DESDE_HOY");
    expect(componente("historial.tsx")).toContain("AVANZO_CON_PENDIENTES");
    expect(pagina()).toContain("<Proyeccion");
    expect(pagina()).toContain("<Historial");
  });
});
