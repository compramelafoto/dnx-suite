import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const H = vi.hoisted(() => ({
  bot: null as { rutas: string[] } | null,
  role: "WORKSPACE_OWNER",
  source: "manual" as string | null,
  copiable: false,
  perfil: {} as Record<string, unknown>,
  estudio: vi.fn(async (_ws: string, _estructura?: unknown) => ({ ofrece: true, miembros: [{ userId: 7, etiqueta: "Daniel" }], categoriasIngreso: [], ventasLocal: null })),
}));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: async () => ({ user: { id: 7, name: "Daniel", email: "d@x.test" }, workspace: { id: "ws1" }, role: H.role }),
}));
vi.mock("@/lib/precios/perfil", () => ({ leerPerfilPrecios: async () => (H.source ? { perfil: H.perfil, source: H.source, actualizado: new Date("2026-10-12T14:00:00.456Z") } : null) }));
vi.mock("@/lib/dnx-bot/panel", () => ({ botEnPanel: async () => H.bot }));
vi.mock("@/lib/precios/estudio-servidor", () => ({ datosDeMiEstudio: H.estudio }));
vi.mock("./perfil-form", () => ({ PerfilForm: () => null }));
vi.mock("@/lib/cuanto-cobro-socio/perfil", () => ({ hayPerfilDelPortalParaCopiar: async () => H.copiable }));
vi.mock("./copiar-perfil-del-portal", () => ({ CopiarPerfilDelPortal: () => null }));
const ACTUALIZADO = new Date("2026-10-12T14:00:00.456Z");

const { default: Page } = await import("./page");
const { PreguntaleAlBot } = await import("@/components/dnx-bot/preguntale-al-bot");
const { PerfilForm } = await import("./perfil-form");
const { CopiarPerfilDelPortal } = await import("./copiar-perfil-del-portal");

function buscar(nodo: ReactNode, tipo: unknown): ReactElement[] {
  if (Array.isArray(nodo)) return nodo.flatMap((n) => buscar(n, tipo));
  if (!isValidElement(nodo)) return [];
  const el = nodo as ReactElement<{ children?: ReactNode }>;
  return [...(el.type === tipo ? [el] : []), ...buscar(el.props.children, tipo)];
}
function textos(nodo: ReactNode): string {
  if (typeof nodo === "string") return nodo;
  if (Array.isArray(nodo)) return nodo.map(textos).join(" ");
  if (!isValidElement(nodo)) return "";
  return textos((nodo as ReactElement<{ children?: ReactNode }>).props.children);
}

beforeEach(() => {
  H.bot = null;
  H.role = "WORKSPACE_OWNER";
  H.source = "manual";
  H.copiable = false;
  H.perfil = {};
  H.estudio.mockClear();
});

describe("Configuración → Precios y DNX Bot", () => {
  it("ya no hay un «Armalo conversando» siempre visible (el camino principal es el formulario)", async () => {
    H.bot = { rutas: ["/workspace/configuracion/precios"] };
    const arbol = await Page();
    expect(buscar(arbol, PreguntaleAlBot)).toEqual([]);
    expect(textos(arbol)).not.toContain("Armalo conversando");
    expect(textos(arbol)).not.toContain("Tus números son tuyos");
  });
  it("con bot, el formulario recibe el workspace para ofrecerlo sólo si la persona se traba; sin bot, nada", async () => {
    H.bot = { rutas: ["/workspace/configuracion/precios"] };
    expect(buscar(await Page(), PerfilForm)[0]!.props).toMatchObject({ bot: { workspaceId: "ws1" } });
    H.bot = null;
    expect(buscar(await Page(), PerfilForm)[0]!.props).toMatchObject({ bot: null });
  });
  it("Mi estudio: el formulario recibe si se ofrece y los miembros para vincular", async () => {
    expect(buscar(await Page(), PerfilForm)[0]!.props).toMatchObject({ estudio: { ofrece: true, miembros: [{ userId: 7, etiqueta: "Daniel" }] } });
  });
  it("Local y coberturas: con el local separado, las ventas se buscan con las categorías guardadas; sin el modo, no", async () => {
    await Page();
    expect(H.estudio).toHaveBeenLastCalledWith("ws1", null);
    H.perfil = { studioStructure: { enabled: true, separateLocal: true, businessLines: [{ id: "products", name: "Productos", sellsHours: false, cashCategoryIds: ["c1"] }] } };
    await Page();
    expect(H.estudio.mock.lastCall![1]).toMatchObject({ separateLocal: true, businessLines: [{ cashCategoryIds: ["c1"] }] });
  });
  it("perfil guardado por el bot: lo dice", async () => {
    H.source = "dnx-bot";
    expect(textos(await Page())).toContain("Armado con DNX Bot.");
  });
  it("el formulario recibe la versión del perfil que muestra (o null si no hay)", async () => {
    expect(buscar(await Page(), PerfilForm)[0]!.props).toMatchObject({ version: ACTUALIZADO.toISOString() });
    H.source = null;
    expect(buscar(await Page(), PerfilForm)[0]!.props).toMatchObject({ version: null });
  });
  it("perfil copiado del portal de socio: lo dice", async () => {
    H.source = "portal";
    expect(textos(await Page())).toContain("Copiado de tu ¿Cuánto Cobro? del portal de socio.");
  });
  it("ofrece copiar el perfil del portal sólo cuando hay uno para copiar", async () => {
    expect(buscar(await Page(), CopiarPerfilDelPortal)).toHaveLength(0);
    H.copiable = true;
    H.source = null;
    expect(buscar(await Page(), CopiarPerfilDelPortal)).toHaveLength(1);
  });
});
