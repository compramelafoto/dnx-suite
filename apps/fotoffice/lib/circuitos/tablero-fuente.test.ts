import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente del tablero de Captación (componentes de cliente y página). */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (f: string) => leer("components", "circuitos", f);
const COMPONENTES = ["tablero.tsx", "tarjeta.tsx", "mover-a.tsx", "dialogo-perdida.tsx", "dialogo-ganada.tsx"];

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

  it("la columna muestra su total de valor y la tarjeta categoría, fecha del evento y valor (pesos, sin decimales)", () => {
    const tablero = componente("tablero.tsx");
    expect(tablero).toMatch(/formatoPesos\(col\.valorTotal\)/);
    const t = componente("tarjeta.tsx");
    for (const x of ["tarjeta.categoria", "tarjeta.fechaEvento", "formatoPesos(tarjeta.valor)"]) expect(t, x).toContain(x);
    // El formato sale del módulo puro de valor (los componentes de cliente no tocan el servidor).
    for (const c of [tablero, t]) expect(c).toContain('from "@/lib/consultas/valor"');
  });

  it("la tarjeta se arrastra y siempre tiene «Mover a…»", () => {
    const t = componente("tarjeta.tsx");
    for (const x of ["draggable=", "onDragStart", "<MoverA"]) expect(t, x).toContain(x);
    const m = componente("mover-a.tsx");
    expect(m).toContain("<select");
    expect(m).toContain("Mover a…");
  });

  it("«Mover a…» es de dos pasos: el select sólo elige, el botón aplica", () => {
    const m = componente("mover-a.tsx");
    expect(m).toContain("onChange={(ev) => setElegido(ev.target.value)}");
    expect(m).toContain('type="submit"');
    expect(m).toContain("disabled={deshabilitado || !destino}");
    expect(m.match(/onElegir\(/g)).toHaveLength(1);
    expect(m.indexOf("onElegir(destino)")).toBeGreaterThan(m.indexOf("onSubmit="));
  });

  it("ganar se confirma siempre y las operaciones en curso son por tarjeta", () => {
    const t = componente("tablero.tsx");
    expect(t).toContain("setGanando(op)");
    expect(t).toContain("<DialogoGanada");
    // Soltar pasa por `pedir` (que confirma); el único `ejecutar` de ganada sale del diálogo.
    expect(t).toContain("if (a) pedir(a.tarjeta, destino)");
    expect(t).toContain("ejecutar({ ...ganando,");
    expect(t.indexOf("setGanando(op)")).toBeLessThan(t.indexOf("ejecutar({ ...op, destino })"));
    expect(t).toContain("ocupadas.has(t.journeyId)");
    expect(componente("dialogo-ganada.tsx")).toContain("¿Marcar como ganada? No se puede deshacer.");
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
    const p = leer("app", "(shell)", "consultas", "page.tsx");
    expect(p).toContain("<Tablero");
    expect(p).toContain("cargarTablero(");
    expect(p).toContain("prepararCaptacion(workspace.id)");
    expect(p).toContain('puede(role, "configurar")');
    expect(p).not.toContain("todavía no está disponible");
    expect(leer("components", "captacion", "armazon.tsx")).toContain('href: "/consultas/informe"');
  });
});
