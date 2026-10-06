import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de las pantallas de Consultas de la etapa 1 (Tarea 5). */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

const CLIENTE = [
  "components/consultas/selector-contacto.tsx",
  "components/consultas/campos-evento.tsx",
  "components/consultas/formulario-consulta.tsx",
  "components/consultas/alta-rapida.tsx",
  "components/consultas/datos-consulta.tsx",
  "components/consultas/participantes.tsx",
  "components/circuitos/tablero.tsx",
];
/** Módulos de `lib/consultas` que un componente de cliente puede importar con valores: los puros. */
const PUROS = new Set(["constantes", "formulario"]);

describe("acciones de Consultas («use server»)", () => {
  const fuente = leer("app", "actions", "consultas.ts");

  it("sólo exporta funciones async", () => {
    expect(fuente.startsWith('"use server";')).toBe(true);
    const exportados = [...fuente.matchAll(/^export\s+(?!async function)(\S+)/gm)].map((m) => m[0]);
    expect(exportados).toEqual([]);
    expect(fuente.match(/^export async function \w+/gm)!.length).toBeGreaterThanOrEqual(6);
  });

  it("cada acción arma el contexto con «operar» antes de leer o escribir", () => {
    const acciones = fuente.split(/^export async function /m).slice(1);
    for (const a of acciones) {
      const nombre = a.slice(0, a.indexOf("("));
      const guarda = a.indexOf('await contextoDeConsultas("operar")');
      expect(guarda, nombre).toBeGreaterThan(0);
      expect(a.indexOf("if (!ctx) return SIN_ACCESO;"), nombre).toBeGreaterThan(guarda);
      for (const lib of ["crearConsultaManual(", "crearConsultaRapida(", "editarConsulta(", "agregarParticipante(", "quitarParticipante(", "buscarContactos("]) {
        const i = a.indexOf(lib);
        if (i !== -1) expect(i, `${nombre} → ${lib}`).toBeGreaterThan(guarda);
      }
    }
    expect(fuente).not.toContain("@repo/db");
    // Altas del equipo: nunca la respuesta automática del formulario web.
    expect(fuente).not.toMatch(/["']WEB["']/);
  });
});

describe("componentes de cliente", () => {
  it("son de cliente y no importan la base, server-only ni módulos del servidor", () => {
    for (const f of CLIENTE) {
      const c = leer(f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toContain("server-only");
      for (const m of c.matchAll(/^import (?!type )[^;]*from "@\/lib\/consultas\/([\w-]+)"/gm)) {
        expect(PUROS.has(m[1]!), `${f} importa valores de lib/consultas/${m[1]}`).toBe(true);
      }
    }
    // Los módulos puros que importan no tocan la base.
    for (const m of PUROS) {
      const c = leer("lib", "consultas", `${m}.ts`);
      expect(c, m).not.toContain("@repo/db");
      expect(c, m).not.toContain("server-only");
    }
  });

  it("la categoría muestra u oculta los datos del grupo con CAMPOS_POR_GRUPO", () => {
    expect(leer("components/consultas/campos-evento.tsx")).toContain("CAMPOS_POR_GRUPO[grupo]");
  });

  it("el alta rápida recarga el tablero y vive en la primera columna", () => {
    expect(leer("components/consultas/alta-rapida.tsx")).toContain("router.refresh()");
    const t = leer("components/circuitos/tablero.tsx");
    expect(t).toContain("indice === 0 && altaRapida");
  });

  it("el buscador de contactos no ofrece crear sin pasar por el aviso de duplicado", () => {
    const f = leer("components/consultas/formulario-consulta.tsx");
    expect(f).toContain("Posible duplicado");
    expect(f).toContain("Usar este contacto");
    expect(f).toContain("/clientes/${c.id}");
  });
});

describe("páginas", () => {
  it("«Nueva consulta»: guarda y «Gestionar» antes de leer las opciones", () => {
    const p = leer("app", "(shell)", "consultas", "nueva", "page.tsx");
    const guarda = p.indexOf("await requireServiceLeadsStaff()");
    const gestionar = p.indexOf('puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)');
    expect(guarda).toBeGreaterThan(0);
    expect(gestionar).toBeGreaterThan(guarda);
    for (const lectura of ["opcionesDeConsulta(", "responsablesDeConsultas(", "contactoDelWorkspace(", "await searchParams"]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(gestionar);
    }
    expect(p).toContain("contactoDelWorkspace(workspace.id,");
    expect(p).not.toContain("@repo/db");
  });

  it("ficha: los datos nuevos se leen después de verificar la consulta en el workspace", () => {
    const p = leer("app", "(shell)", "consultas", "[id]", "page.tsx");
    expect(p.indexOf("if (!ficha) notFound();")).toBeLessThan(p.indexOf("cargarDatosConsulta(workspace.id, id)"));
    expect(p).toContain('puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)');
    // Notas, etiquetas y adjuntos del contacto: datos de Clientes, con «Ver» ahí.
    expect(p).toContain('puede(acceso, "ver", CLIENTS_MODULE_KEY)');
    expect(p).toContain("<AvisosConsulta");
  });

  it("tablero y lista: «Nueva consulta» y alta rápida sólo con «Gestionar»", () => {
    const t = leer("app", "(shell)", "consultas", "page.tsx");
    expect(t).toContain('const puedeCrear = puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY);');
    expect(t).toContain("altaRapida={puedeCrear ?");
    expect(leer("app", "(shell)", "consultas", "lista", "page.tsx")).toContain('puedeCrear={puedeEnContexto(ctx, "operar", SERVICE_LEADS_MODULE_KEY)}');
    expect(leer("components", "captacion", "armazon.tsx")).toContain('href="/consultas/nueva"');
  });
});
