import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Plantillas. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "plantillas", f);

const CLIENTE = ["plantillas-lista.tsx", "editor-texto.tsx", "automatico-form.tsx"];
/** Lo que el navegador nunca debe cargar: la base y los módulos de servidor de plantillas y campos. */
const PROHIBIDOS = [
  "@repo/db",
  "server-only",
  "@/lib/plantillas/definiciones",
  "@/lib/plantillas/semillas",
  "@/lib/plantillas/acceso",
  "@/lib/plantillas/contexto",
  "@/lib/plantillas/envio",
  "@/lib/campos/definiciones",
  "@/lib/campos/modulos",
];

describe("Configuración → Plantillas", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of [
      "prisma.", "asegurarPlantillasIniciales(", "listarPlantillas(", "contarUsosPorPlantilla(", "leerAutomatico(",
      "listarCampos(", "loadPersonVocabulary(", "tiposConModuloEncendido(", "await searchParams",
    ]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
    // Las plantillas iniciales se aseguran antes de listar.
    expect(p.indexOf("asegurarPlantillasIniciales(")).toBeLessThan(p.indexOf("listarPlantillas("));
  });

  it("ofrece cada tipo sólo con su módulo y Automáticos sólo con Captación", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("tiposConModuloEncendido(workspace.id)");
    expect(p).toContain('{ valor: "GENERAL", etiqueta: etiquetas.GENERAL }');
    expect(p).toContain("...encendidos.map((t) => ({ valor: t, etiqueta: etiquetas[t] }))");
    expect(p).toContain("SOCIO: vocabulario.Plural");
    expect(p).toContain('p.slug !== "automaticos" || conCaptacion');
  });

  it("las acciones son de servidor y cada una pasa por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    // Un archivo "use server" sólo puede exportar funciones asíncronas (y tipos).
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(8);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()"), cuerpo.slice(0, 40)).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("ordena con subir/bajar accesibles, borra sólo sin usos y las archivadas van plegadas", () => {
    const c = aqui("plantillas-lista.tsx");
    expect(c).toContain('aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${nombre}`}');
    expect(c).toContain("p.usos === 0 ?");
    expect(c).toContain("<details");
    expect(c).toContain("Archivadas (");
  });

  it("los componentes de cliente no importan la base ni módulos de servidor", () => {
    for (const f of [...CLIENTE, "vista-previa.ts"]) {
      const c = aqui(f);
      if (f.endsWith(".tsx")) expect(c.startsWith('"use client";'), f).toBe(true);
      for (const prohibido of PROHIBIDOS) expect(c, `${f} → ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("los módulos de plantillas que carga el navegador son puros", () => {
    for (const m of ["constantes", "variables", "motor", "render"]) {
      const c = leer("lib", "plantillas", `${m}.ts`);
      for (const prohibido of PROHIBIDOS) expect(c, `${m} → ${prohibido}`).not.toContain(prohibido);
      // Sólo importan entre sí.
      for (const imp of c.matchAll(/from "([^"]+)"/g)) expect(imp[1], m).toMatch(/^\.\/(constantes|variables|motor|render)$/);
    }
  });

  it("la vista previa del correo va en un iframe aislado", () => {
    const e = aqui("editor-texto.tsx");
    expect(e).toContain('sandbox=""');
    expect(e).toContain("srcDoc={");
    expect(e).not.toContain("dangerouslySetInnerHTML");
  });

  it("aparece en los tres menús de Configuración", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/plantillas"');
    expect(leer("app", "workspace", "layout.tsx")).toContain('"/workspace/configuracion/plantillas"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/plantillas"');
  });
});
