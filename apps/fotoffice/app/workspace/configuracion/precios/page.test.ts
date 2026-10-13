import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const H = vi.hoisted(() => ({ bot: null as { rutas: string[] } | null, role: "WORKSPACE_OWNER", source: "manual" as string | null }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: async () => ({ user: { id: 7, name: "Daniel", email: "d@x.test" }, workspace: { id: "ws1" }, role: H.role }),
}));
vi.mock("@/lib/precios/perfil", () => ({ leerPerfilPrecios: async () => (H.source ? { perfil: {}, source: H.source, actualizado: new Date() } : null) }));
vi.mock("@/lib/dnx-bot/panel", () => ({ botEnPanel: async () => H.bot }));
vi.mock("./perfil-form", () => ({ PerfilForm: () => null }));

const { default: Page } = await import("./page");
const { PreguntaleAlBot } = await import("@/components/dnx-bot/preguntale-al-bot");

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
});

describe("Configuración → Precios y DNX Bot", () => {
  it("sin bot (apagado o sin puertas) no hay botón", async () => {
    expect(buscar(await Page(), PreguntaleAlBot)).toEqual([]);
  });
  it("con bot: «Armalo conversando» con el mensaje y el contexto de la pantalla, y el aviso de privacidad", async () => {
    H.bot = { rutas: ["/workspace/configuracion/precios"] };
    const arbol = await Page();
    const [boton] = buscar(arbol, PreguntaleAlBot);
    expect(boton!.props).toMatchObject({
      etiqueta: "Armalo conversando",
      mensaje: "Quiero armar mi perfil de precios conversando.",
      contexto: { pantalla: "precios" },
    });
    expect(textos(arbol)).toContain("lo procesa Anthropic");
  });
  it("perfil guardado por el bot: lo dice", async () => {
    H.source = "dnx-bot";
    expect(textos(await Page())).toContain("Armado con DNX Bot.");
  });
});
