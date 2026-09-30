import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente del tablero de Captación (componentes de cliente y página). */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (f: string) => leer("components", "circuitos", f);
const COMPONENTES = ["tablero.tsx", "tarjeta.tsx", "mover-a.tsx", "dialogo-perdida.tsx"];

describe("tablero de Captación", () => {
  it("los componentes son de cliente y no importan la base", () => {
    for (const f of COMPONENTES) {
      const c = componente(f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      // Del módulo del servidor sólo se toman tipos.
      expect(c, f).not.toMatch(/import \{[^}]*\} from "@\/lib\/circuitos\/tablero"/);
    }
  });

  it("la tarjeta se arrastra y siempre tiene «Mover a…»", () => {
    const t = componente("tarjeta.tsx");
    for (const x of ["draggable=", "onDragStart", "<MoverA"]) expect(t, x).toContain(x);
    const m = componente("mover-a.tsx");
    expect(m).toContain("<select");
    expect(m).toContain("Mover a…");
  });

  it("el tablero suelta con HTML5 nativo, sin arrastre en pantallas chicas y con zonas de salida", () => {
    const t = componente("tablero.tsx");
    for (const x of ["onDragOver", "onDrop", "preventDefault()", "(min-width: 768px)", "<DialogoPerdida", "salidas.exito", "salidas.fracaso"]) {
      expect(t, x).toContain(x);
    }
    // Las etapas archivadas no reciben movimientos nuevos.
    expect(t).toMatch(/!archivada/);
  });

  it("mueve y cierra con `esperado`, refresca si cambió y ofrece «Pasar igual» sólo a quien puede", () => {
    const t = componente("tablero.tsx");
    expect(t).toContain("moverAction(");
    expect(t).toContain("cerrarAction(");
    expect(t).toContain("esperado: op.esperado");
    expect(t).toContain("router.refresh()");
    expect(t).toContain("forzar: true");
    expect(t).toContain("puedePasarIgual &&");
    expect(componente("tarjeta.tsx")).toContain("Pasar igual");
    // El texto que compara el tablero es el que devuelve el motor.
    const cambio = leer("lib", "circuitos", "recorridos.ts").match(/cambio: "([^"]+)"/)?.[1];
    expect(cambio).toBeTruthy();
    expect(t).toContain(`MENSAJE_CAMBIO = "${cambio}"`);
  });

  it("perder exige motivo", () => {
    const d = componente("dialogo-perdida.tsx");
    expect(d).toContain("required");
    expect(d).toContain("disabled={!motivo}");
  });

  it("la página de Captación muestra el tablero y la pestaña Informe va a su ruta", () => {
    const p = leer("app", "(shell)", "captacion", "page.tsx");
    expect(p).toContain("<Tablero");
    expect(p).toContain("cargarTablero(");
    expect(p).toContain("prepararCaptacion(workspace.id)");
    expect(p).toContain('puede(role, "configurar")');
    expect(p).not.toContain("todavía no está disponible");
    expect(leer("components", "captacion", "armazon.tsx")).toContain('href: "/captacion/informe"');
  });
});
