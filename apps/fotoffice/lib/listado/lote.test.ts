import { describe, expect, it, vi } from "vitest";
import { registrarActividad } from "./actividad";
import { aplicarLote, prepararLote, resolverObjetivo } from "./lote";
import type { AccionLote, ContextoListado, DefinicionListado } from "./tipos";

const ctx: ContextoListado = { workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "Dani", role: "WORKSPACE_OWNER" };
vi.mock("./actividad", () => ({ registrarActividad: vi.fn(async () => {}) }));
vi.mock("@repo/db", () => ({ prisma: {} }));

function armar(universo: string[]) {
  const aplicar = vi.fn(async (_c, ids: string[]) => ({ aplicados: ids.length, fallidos: [], detalle: [] }));
  const accion: AccionLote = {
    clave: "categoria", etiqueta: "Cambiar categoría", capacidad: "operar", maximo: 3,
    confirmacion: "Vas a cambiar la categoría de {n} socios a {parametro}.",
    parametro: { etiqueta: "Categoría", opciones: async () => [{ valor: "c1", etiqueta: "Vitalicio" }] },
    elegibles: async (_c, ids) => ({ elegibles: ids.filter((i) => i !== "x"), excluidos: ids.includes("x") ? [{ id: "x", motivo: "no" }] : [] }),
    aplicar,
  };
  const def = {
    clave: "socios", filtros: [], ordenes: ["n"], ordenPorDefecto: { campo: "n", desc: false },
    traerIds: vi.fn(async (_c, _r, tope: number) => universo.slice(0, tope)),
    traerPorIds: vi.fn(async (_c, ids: string[]) => ids.filter((i) => universo.includes(i)).map((id) => ({ id }))),
    idDe: (f: { id: string }) => f.id,
    acciones: [accion],
  } as unknown as DefinicionListado<{ id: string }>;
  return { def, accion, aplicar };
}

describe("resolverObjetivo", () => {
  it("con ids descarta los de otro workspace y los repetidos", async () => {
    const { def } = armar(["a", "b"]);
    expect(await resolverObjetivo(def, ctx, { tipo: "ids", ids: ["a", "a", "ajeno"] }, 3, "2026-09-30")).toEqual({ ok: true, ids: ["a"] });
  });
  it("con todos, más que el tope es error", async () => {
    const { def } = armar(["a", "b", "c", "d"]);
    const r = await resolverObjetivo(def, ctx, { tipo: "todos", query: "" }, 3, "2026-09-30");
    expect(r).toEqual({ ok: false, error: "Son más de 3. Filtrá un poco más." });
  });
  it("con ids, más que el tope es error", async () => {
    const { def } = armar(["a", "b", "c", "d"]);
    const r = await resolverObjetivo(def, ctx, { tipo: "ids", ids: ["a", "b", "c", "d"] }, 3, "2026-09-30");
    expect(r).toEqual({ ok: false, error: "Son más de 3. Filtrá un poco más." });
  });
});

describe("prepararLote y aplicarLote", () => {
  it("prepara con cantidad, excluidos y mensaje", async () => {
    const { def, accion } = armar(["a", "b", "x"]);
    const p = await prepararLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", "2026-09-30");
    expect(p).toEqual({ ok: true, cantidad: 2, excluidos: [{ id: "x", motivo: "no" }], mensaje: "Vas a cambiar la categoría de 2 socios a Vitalicio." });
  });
  it("si la cantidad cambió, no aplica y pide reconfirmar", async () => {
    const { def, accion, aplicar } = armar(["a", "b", "c"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", 2, "2026-09-30");
    expect(r.estado).toBe("reconfirmar");
    expect(aplicar).not.toHaveBeenCalled();
  });
  it("si coincide, aplica sólo a los elegibles", async () => {
    const { def, accion, aplicar } = armar(["a", "b", "x"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", 2, "2026-09-30");
    expect(r).toEqual({ estado: "hecho", resultado: { aplicados: 2, fallidos: [], detalle: [] } });
    expect(aplicar).toHaveBeenCalledWith(ctx, ["a", "b"], "c1");
  });
  it("un parámetro que no está entre las opciones es error", async () => {
    const { def, accion } = armar(["a"]);
    const p = await prepararLote(def, accion, ctx, { tipo: "ids", ids: ["a"] }, "c_trucho", "2026-09-30");
    expect(p).toEqual({ ok: false, error: "Elegí una opción válida." });
  });
  it("una acción sin parámetro rechaza uno que llegue de afuera", async () => {
    const { def, accion } = armar(["a"]);
    const sin: AccionLote = { ...accion, parametro: undefined, confirmacion: "Vas a tocar {n}." };
    expect(await prepararLote(def, sin, ctx, { tipo: "ids", ids: ["a"] }, "algo", "2026-09-30")).toEqual({ ok: false, error: "Elegí una opción válida." });
    expect(await prepararLote(def, sin, ctx, { tipo: "ids", ids: ["a"] }, null, "2026-09-30")).toMatchObject({ ok: true, mensaje: "Vas a tocar 1." });
  });
  it("si no queda ninguna fila elegible, no aplica", async () => {
    const { def, accion, aplicar } = armar(["x"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "ids", ids: ["x"] }, "c1", 0, "2026-09-30");
    expect(r).toEqual({ estado: "error", error: "No hay filas para modificar." });
    expect(aplicar).not.toHaveBeenCalled();
  });
});

describe("registro de actividad del lote", () => {
  it("guarda la consulta saneada, no el texto crudo del navegador", async () => {
    vi.mocked(registrarActividad).mockClear();
    const { def, accion } = armar(["a", "b"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "todos", query: "q=ana&hack=%3D1&pagina=4&ver=zz" }, "c1", 2, "2026-09-30");
    expect(r.estado).toBe("hecho");
    expect(vi.mocked(registrarActividad).mock.calls[0][1]).toMatchObject({ kind: "BULK_ACTION", action: "categoria", query: "q=ana" });
  });
  it("con selección por ids la consulta queda vacía", async () => {
    vi.mocked(registrarActividad).mockClear();
    const { def, accion } = armar(["a"]);
    await aplicarLote(def, accion, ctx, { tipo: "ids", ids: ["a"] }, "c1", 1, "2026-09-30");
    expect(vi.mocked(registrarActividad).mock.calls[0][1]).toMatchObject({ query: "" });
  });
});
