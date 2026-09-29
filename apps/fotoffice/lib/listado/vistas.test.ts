import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { normalizarNombreVista, puedeEditarVista, sanearQuery } from "./vistas";
import type { ContextoListado, DefinicionListado } from "./tipos";

vi.mock("@repo/db", () => ({ prisma: {} }));

const ctx = (role: string, userId = 1): ContextoListado => ({ workspaceId: "w", workspaceName: "W", userId, userLabel: "x", role });
const def = {
  filtros: [{ tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "A", etiqueta: "A" }] }],
  ordenes: ["n"],
  ordenPorDefecto: { campo: "n", desc: false },
} as unknown as DefinicionListado<unknown>;

describe("puedeEditarVista", () => {
  it("una vista personal sólo la edita su dueño, aunque sea Equipo", () => {
    expect(puedeEditarVista(ctx("STAFF", 1), { ownerUserId: 1, shared: false })).toBe(true);
    expect(puedeEditarVista(ctx("WORKSPACE_OWNER", 2), { ownerUserId: 1, shared: false })).toBe(false);
  });
  it("una vista del equipo sólo la editan Dueño y Administrador", () => {
    expect(puedeEditarVista(ctx("STAFF", 1), { ownerUserId: 1, shared: true })).toBe(false);
    expect(puedeEditarVista(ctx("WORKSPACE_ADMIN", 2), { ownerUserId: 1, shared: true })).toBe(true);
  });
});

it("normalizarNombreVista", () => {
  expect(normalizarNombreVista("  Deudores  ")).toBe("Deudores");
  expect(normalizarNombreVista("   ")).toBeNull();
  expect(normalizarNombreVista("x".repeat(61))).toBeNull();
});

it("sanearQuery descarta lo inválido, la página y el panel abierto", () => {
  expect(sanearQuery(def, "estado=A&pagina=3&ver=abc&hack=1")).toBe("estado=A");
});

describe("acciones de vistas (fuente)", () => {
  const src = readFileSync(join(__dirname, "..", "..", "app/actions/listado.ts"), "utf8");
  const partes = src.split(/^export async function /m).slice(1);

  it('es un módulo "use server"', () => expect(src.trimStart().startsWith('"use server"')).toBe(true));
  it("exporta las acciones de vistas", () => {
    for (const n of ["guardarVistaAction", "renombrarVistaAction", "borrarVistaAction"]) {
      expect(partes.some((p) => p.startsWith(n))).toBe(true);
    }
  });
  it("cada acción llama a contextoDeListado antes de tocar datos", () => {
    for (const p of partes) {
      const guarda = p.indexOf("contextoDeListado");
      expect(guarda).toBeGreaterThan(-1);
      for (const dato of ["prisma", "crearVista(", "renombrarVista(", "borrarVista(", "definicionDe("]) {
        const i = p.indexOf(dato);
        if (i !== -1) expect(guarda).toBeLessThan(i);
      }
    }
  });
  it("ninguna lee workspaceId del formulario", () => expect(src).not.toMatch(/get\(["']workspaceId["']\)/));
});
