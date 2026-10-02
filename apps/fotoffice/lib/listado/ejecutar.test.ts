import { describe, expect, it, vi } from "vitest";
import { ejecutarListado, resolverConsulta } from "./ejecutar";
import { leerConsulta } from "./consulta";
import type { ContextoListado, DefinicionListado } from "./tipos";

const ctx: ContextoListado = { workspaceId: "ws1", workspaceName: "WS", userId: 1, userLabel: "Dani", role: "WORKSPACE_OWNER" };

function defCon(total: number) {
  const traer = vi.fn(async (_c, _r, p: { skip: number; take: number }) =>
    Array.from({ length: Math.max(0, Math.min(p.take, total - p.skip)) }, (_, i) => ({ id: String(p.skip + i + 1) })),
  );
  const def = {
    clave: "prueba",
    filtros: [
      { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
      { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    ],
    ordenes: ["nombre"],
    ordenPorDefecto: { campo: "nombre", desc: false },
    contar: vi.fn(async () => total),
    traer,
    validarRelacion: vi.fn(async (_c, _k, id: string) => (id === "cat_ok" ? "Vitalicio" : null)),
  } as unknown as DefinicionListado<{ id: string }>;
  return { def, traer };
}

describe("resolverConsulta", () => {
  it("una relación de otro workspace se descarta y se avisa", async () => {
    const { def } = defCon(0);
    const { consulta } = leerConsulta(def, new URLSearchParams("categoria=cat_ajena"));
    const r = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    expect(r.resuelta.filtros).toEqual({});
    expect(r.descartados).toEqual(["categoria"]);
  });
  it("una relación válida trae su etiqueta y el período su rango", async () => {
    const { def } = defCon(0);
    const { consulta } = leerConsulta(def, new URLSearchParams("categoria=cat_ok&alta=este-mes"));
    const r = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    expect(r.resuelta.etiquetasRelacion).toEqual({ categoria: "Vitalicio" });
    expect(r.resuelta.periodos.alta.desde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });
});

describe("ejecutarListado", () => {
  it("pagina con skip/take y calcula desde/hasta", async () => {
    const { def, traer } = defCon(120);
    const { consulta } = leerConsulta(def, new URLSearchParams("pagina=2&filas=50"));
    const { resuelta } = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    const p = await ejecutarListado(def, ctx, resuelta);
    expect(traer).toHaveBeenCalledWith(ctx, expect.anything(), { skip: 50, take: 50 });
    expect(p).toMatchObject({ total: 120, pagina: 2, paginas: 3, desde: 51, hasta: 100 });
  });
  it("una página fuera de rango muestra la última", async () => {
    const { def } = defCon(30);
    const { consulta } = leerConsulta(def, new URLSearchParams("pagina=9"));
    const { resuelta } = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    const p = await ejecutarListado(def, ctx, resuelta);
    expect(p).toMatchObject({ pagina: 2, paginas: 2, desde: 26, hasta: 30 });
  });
  it("sin resultados: página 1 de 1, 0 a 0", async () => {
    const { def } = defCon(0);
    const { resuelta } = await resolverConsulta(def, ctx, leerConsulta(def, new URLSearchParams("")).consulta, "2026-09-30");
    expect(await ejecutarListado(def, ctx, resuelta)).toMatchObject({ total: 0, pagina: 1, paginas: 1, desde: 0, hasta: 0 });
  });
});
