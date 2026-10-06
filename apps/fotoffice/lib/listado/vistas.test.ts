import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  borrarVista,
  guardarUltima,
  leerUltima,
  listarVistas,
  normalizarNombreVista,
  puedeEditarVista,
  renombrarVista,
  sanearQuery,
} from "./vistas";
import type { ContextoListado, DefinicionListado } from "./tipos";

const V = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeListView: V } }));

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

describe("recordar filtros nunca tira la lista", () => {
  let errores: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    const falla = Object.assign(new Error('The table `public.FotofficeListView` does not exist'), { code: "P2021" });
    for (const f of Object.values(V)) f.mockReset().mockRejectedValue(falla);
    errores = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errores.mockRestore());

  it("sin tabla: no hay última consulta, no hay vistas y guardar no hace nada", async () => {
    await expect(leerUltima(ctx("STAFF"), "socios")).resolves.toBeNull();
    await expect(listarVistas(ctx("STAFF"), "socios")).resolves.toEqual([]);
    await expect(guardarUltima(ctx("STAFF"), "socios", "estado=A")).resolves.toBeUndefined();
    expect(errores).toHaveBeenCalledTimes(3);
  });

  it("el registro no lleva la consulta ni datos de la persona", async () => {
    await guardarUltima(ctx("STAFF", 42), "socios", "q=ana%40correo.com");
    const texto = JSON.stringify(errores.mock.calls);
    expect(texto).not.toContain("ana");
    expect(texto).not.toContain("42");
    expect(texto).toContain("P2021");
  });

  it("si la tabla está, lee y guarda como siempre", async () => {
    V.findFirst.mockReset().mockResolvedValue({ id: "v1", query: "estado=A" });
    V.update.mockReset().mockResolvedValue({});
    expect(await leerUltima(ctx("STAFF"), "socios")).toBe("estado=A");
    await guardarUltima(ctx("STAFF"), "socios", "estado=B");
    expect(V.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { query: "estado=B" } });
    expect(errores).not.toHaveBeenCalled();
  });
});

describe("renombrar y borrar sólo tocan vistas de la misma lista", () => {
  beforeEach(() => {
    for (const f of Object.values(V)) f.mockReset().mockResolvedValue({});
  });

  it("busca la vista filtrando por workspace, lista y tipo", async () => {
    V.findFirst.mockResolvedValue({ id: "v1", ownerUserId: 1, shared: false });
    expect(await renombrarVista(ctx("STAFF", 1), "socios", "v1", "Deudores")).toBe(true);
    expect(await borrarVista(ctx("STAFF", 1), "socios", "v1")).toBe(true);
    for (const [args] of V.findFirst.mock.calls) {
      expect(args.where).toEqual({ id: "v1", workspaceId: "w", listKey: "socios", kind: "GUARDADA" });
    }
  });

  it("una vista de otra lista no aparece y no se toca", async () => {
    V.findFirst.mockResolvedValue(null);
    expect(await renombrarVista(ctx("STAFF", 1), "clientes", "v1", "X")).toBe(false);
    expect(await borrarVista(ctx("STAFF", 1), "clientes", "v1")).toBe(false);
    expect(V.update).not.toHaveBeenCalled();
    expect(V.delete).not.toHaveBeenCalled();
  });
});
