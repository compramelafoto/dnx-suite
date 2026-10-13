import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

/** Botones «¿Cuánto cobro esto?» (lista) y «Calcular con el bot» (editor de un borrador), etapa 2. */

const H = vi.hoisted(() => ({ bot: null as null | { rutas: string[]; capacidades: { configurar: boolean; gestionarPresupuestos: boolean; verConsultas: boolean } } }));
vi.mock("@/lib/dnx-bot/panel", () => ({ botEnPanel: async () => H.bot }));
vi.mock("@/lib/presupuestos/pagina", () => ({
  requirePresupuestos: async () => ({ user: { id: 1 }, workspace: { id: "ws1" }, ctx: { workspaceId: "ws1", userId: 1, role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { quotes: "MANAGE" } } } }),
}));
vi.mock("@/lib/listado/acceso", () => ({ contextoListadoDePagina: async () => ({}) }));
vi.mock("@/lib/presupuestos/listado", () => ({ listadoPresupuestos: {} }));
vi.mock("@/components/listado/listado", () => ({ Listado: () => null }));
const S = vi.hoisted(() => ({ cantidad: 0 }));
vi.mock("@/lib/dnx-bot/seguimientos", () => ({
  presupuestosSinRespuesta: async () => ({ dias: 3, seguimientoActivo: false, presupuestos: Array.from({ length: S.cantidad }, (_, i) => ({ id: `p${i}` })) }),
}));

const { default: Lista } = await import("./page");
const { PreguntaleAlBot } = await import("@/components/dnx-bot/preguntale-al-bot");

function buscar(nodo: ReactNode, tipo: unknown): ReactElement[] {
  if (Array.isArray(nodo)) return nodo.flatMap((n) => buscar(n, tipo));
  if (!isValidElement(nodo)) return [];
  const el = nodo as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  const hijos = Object.values(el.props).filter((v) => isValidElement(v) || Array.isArray(v)) as ReactNode[];
  return [...(el.type === tipo ? [el] : []), ...buscar(el.props.children, tipo), ...hijos.flatMap((h) => buscar(h, tipo))];
}
const lista = () => Lista({ searchParams: Promise.resolve({}) });

beforeEach(() => {
  H.bot = null;
  S.cantidad = 0;
});

describe("lista de Presupuestos", () => {
  it("sin bot no hay botón", async () => {
    expect(buscar(await lista(), PreguntaleAlBot)).toEqual([]);
  });
  it("con bot y configurar: «¿Cuánto cobro esto?» con el mensaje y la pantalla", async () => {
    H.bot = { rutas: [], capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true } };
    const [b] = buscar(await lista(), PreguntaleAlBot);
    expect(b!.props).toMatchObject({ etiqueta: "¿Cuánto cobro esto?", mensaje: "Quiero saber cuánto cobrar un trabajo.", contexto: { pantalla: "presupuestos" } });
  });
  it("con bot pero sin configurar: no (el cálculo es del dueño y los administradores)", async () => {
    H.bot = { rutas: [], capacidades: { configurar: false, gestionarPresupuestos: true, verConsultas: true } };
    expect(buscar(await lista(), PreguntaleAlBot)).toEqual([]);
  });
});

describe("«Seguimientos» en la lista", () => {
  it("sólo con el bot encendido y presupuestos sin respuesta", async () => {
    H.bot = { rutas: [], capacidades: { configurar: false, gestionarPresupuestos: true, verConsultas: true } };
    expect(buscar(await lista(), PreguntaleAlBot)).toEqual([]);
    S.cantidad = 2;
    const [b] = buscar(await lista(), PreguntaleAlBot);
    expect(b!.props).toMatchObject({ etiqueta: "Seguimientos (2)", mensaje: "¿Qué presupuestos tengo sin respuesta?" });
    H.bot = null;
    expect(buscar(await lista(), PreguntaleAlBot)).toEqual([]);
  });
});

describe("ficha de la consulta (fuente)", () => {
  it("«Preguntale al bot» con la consulta como contexto, sólo con el bot y «Ver» en Consultas", () => {
    const p = readFileSync(join(__dirname, "../consultas/[id]/page.tsx"), "utf8");
    expect(p).toContain("botEnPanel()");
    expect(p).toContain("bot?.capacidades.verConsultas ?");
    expect(p).toContain('mensaje="Ayudame a responder esta consulta."');
    expect(p).toContain('contexto={{ pantalla: "consulta", consultaLeadId: id }}');
  });
});

describe("editor de un borrador (fuente)", () => {
  const leer = (f: string) => readFileSync(join(__dirname, f), "utf8");
  it("la ficha pasa el presupuesto al editor sólo si el bot está y la persona configura", () => {
    const p = leer("[id]/page.tsx");
    expect(p).toContain("botEnPanel()");
    expect(p).toMatch(/botPresupuestoId=\{bot\?\.capacidades\.configurar \? detalle\.id : null\}/);
  });
  it("el editor muestra «Calcular con el bot» al lado de «Armar con ¿Cuánto Cobro?», con el contexto del presupuesto", () => {
    const e = readFileSync(join(__dirname, "../../../components/presupuestos/editor-presupuesto.tsx"), "utf8");
    const armar = e.indexOf("Armar con ¿Cuánto Cobro?");
    const bot = e.indexOf('etiqueta="Calcular con el bot"');
    expect(bot).toBeGreaterThan(armar);
    expect(e.slice(bot, bot + 400)).toContain('mensaje="Quiero sumar ítems calculados a este presupuesto."');
    expect(e.slice(bot, bot + 400)).toContain('contexto={{ pantalla: "presupuesto", presupuestoId: botPresupuestoId }}');
  });
});
