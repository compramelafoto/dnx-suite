import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de la ficha: quién es de servidor, qué nunca llega al navegador. */
const RAIZ = join(__dirname, "..", "..");
const DIR = join(RAIZ, "components", "ficha");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (nombre: string) => readFileSync(join(DIR, nombre), "utf8");

const CLIENTE = [
  "caja-de-nota.tsx",
  "nota.tsx",
  "linea-de-tiempo.tsx",
  "etiquetas.tsx",
  "adjuntos.tsx",
  "personas-relacionadas.tsx",
  "nueva-relacion.tsx",
];

describe("componentes de la ficha", () => {
  it("están todos los del plan", () => {
    const hay = readdirSync(DIR);
    for (const f of [
      "ficha.tsx", "encabezado-ficha.tsx", "datos-ficha.tsx", "linea-de-tiempo.tsx", "caja-de-nota.tsx",
      "nota.tsx", "etiquetas.tsx", "adjuntos.tsx", "personas-relacionadas.tsx",
    ]) {
      expect(hay).toContain(f);
    }
  });

  it("ficha.tsx es de servidor", () => {
    const f = componente("ficha.tsx");
    expect(f).not.toMatch(/^["']use client["']/m);
    expect(f).toContain('import "server-only"');
    // El contexto (sesión, workspace, módulo, operar, persona) antes de leer nada.
    const guarda = f.indexOf("await contextoDeFicha(");
    expect(guarda).toBeGreaterThan(0);
    for (const lectura of ["listarNotas(", "armarLinea(", "etiquetasDePersona(", "relacionesDePersona(", "listarAdjuntos("]) {
      expect(f.indexOf(lectura)).toBeGreaterThan(guarda);
    }
  });

  it("los interactivos son de cliente", () => {
    for (const c of CLIENTE) expect(componente(c).startsWith('"use client";'), c).toBe(true);
  });

  it("ninguno importa @repo/db", () => {
    for (const f of readdirSync(DIR)) expect(componente(f), f).not.toContain("@repo/db");
  });

  it("la clave del adjunto nunca aparece en los componentes", () => {
    for (const f of readdirSync(DIR)) expect(componente(f), f).not.toMatch(/storageKey/);
  });

  it("los adjuntos suben con PUT directo, progreso y el content-type declarado; bajan con enlace que vence", () => {
    const s = componente("subir-adjunto.ts");
    expect(s).toContain("pedirSubidaAction(");
    expect(s).toContain('xhr.open("PUT", url)');
    expect(s).toContain('setRequestHeader("content-type", tipo)');
    expect(s).toContain("xhr.upload.onprogress");
    expect(s).toContain("confirmarSubidaAction(");
    const a = componente("adjuntos.tsx");
    expect(a).toContain("enlaceDeDescargaAction(");
    expect(a).toContain("window.location.assign(");
    expect(a).toContain("restaurarAdjuntoAction(");
    expect(a).toMatch(/esConfigurador && borrados/);
  });

  it("una subida que falla por excepción queda marcada y libera el botón; accept incluye extensiones", () => {
    const a = componente("adjuntos.tsx");
    expect(a).toMatch(/try \{\s*const r = await subirAdjunto\(/);
    expect(a).toContain("} catch {");
    expect(a).toContain('"No se pudo subir. Probá de nuevo."');
    expect(a).toContain("actualizar({ error: ERROR_SUBIDA_FALLIDA })");
    for (const ext of [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".doc", ".docx", ".xls", ".xlsx"]) {
      expect(a).toContain(`"${ext}"`);
    }
    expect(a).toContain("[...TIPOS_PERMITIDOS, ...EXTENSIONES_PERMITIDAS]");
  });

  it("el vínculo libre se ofrece con ejemplos simétricos y avisa que se lee igual de los dos lados", () => {
    const r = componente("nueva-relacion.tsx");
    expect(r).toContain("Se lee igual desde las dos fichas.");
    const placeholder = r.match(/placeholder="([^"]*)"\s*\/>\s*<p id=\{`\$\{id\}-libre-ayuda`\}/)?.[1];
    expect(placeholder).toBe("Vecinos, compañeros de trabajo, socios de la agencia");
    for (const direccional of ["Padrino", "Madrina", "vecina", "Tutor", "Jefe"]) expect(r).not.toContain(direccional);
  });

  it("la línea de tiempo pide más con verMasAction y avisa si una fuente falló", () => {
    const l = componente("linea-de-tiempo.tsx");
    expect(l).toContain("verMasAction(");
    expect(l).toContain("aria-pressed");
    expect(l).toContain("fallaron.length > 0");
  });

  it("las fechas se muestran en hora de Buenos Aires", () => {
    expect(leer("lib", "ficha", "formato.ts")).toContain('"America/Argentina/Buenos_Aires"');
    for (const c of ["nota.tsx", "evento.tsx", "adjuntos.tsx"]) expect(componente(c), c).toMatch(/fecha(Hora)?BA\(/);
  });
});

describe("Configuración → Ficha", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = leer("app", "workspace", "configuracion", "ficha", "page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(0);
    for (const lectura of ["prisma.", "asegurarCategorias(", "listarCatalogoDeCategorias(", "listarCatalogoDeEtiquetas("]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
  });

  it("cada acción pasa por el contexto con `configurar` primero", () => {
    const a = leer("app", "workspace", "configuracion", "ficha", "actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(9);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()"), cuerpo.slice(0, 40)).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("aparece en el menú junto a Equipo y Módulos", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/ficha"');
    expect(leer("app", "workspace", "layout.tsx")).toContain('"/workspace/configuracion/ficha"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/ficha"');
  });
});
