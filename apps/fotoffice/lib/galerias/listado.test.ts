import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { recortarPorDinero } = await import("@/lib/listado/dinero");
const { whereGalerias, ordenarGalerias, listadoGalerias, OPCIONES_ESTADO_GALERIA } = await import("./listado");

const c = (parcial: Record<string, unknown> = {}) =>
  ({ q: "", filtros: {}, orden: { campo: "alta", desc: true }, pagina: 1, filas: 25, ver: null, periodos: {}, etiquetasRelacion: {}, ...parcial }) as never;

describe("lista de galerías", () => {
  it("siempre acota al workspace", () => {
    expect(whereGalerias("ws-1", c())).toEqual({ workspaceId: "ws-1" });
    const w = whereGalerias("ws-1", c({ q: "boda", filtros: { estado: "PUBLICADA", revision: "si" } }));
    expect(w.workspaceId).toBe("ws-1");
    expect(JSON.stringify(w)).toContain('"status":"PUBLICADA"');
  });
  it("el filtro de estado ignora valores que no son estados", () => {
    expect(whereGalerias("ws-1", c({ filtros: { estado: "'; DROP" } }))).toEqual({ workspaceId: "ws-1" });
    expect(OPCIONES_ESTADO_GALERIA.map((o) => o.valor)).toEqual(["BORRADOR", "PUBLICADA", "ARCHIVADA"]);
  });
  it("'esperando revisión' mira clientes en revisión con el enlace sin anular, y el inverso lo niega", () => {
    const si = JSON.stringify(whereGalerias("ws-1", c({ filtros: { revision: "si" } })));
    expect(si).toContain('"status":"EN_REVISION"');
    expect(si).toContain('"revokedAt":null');
    expect(si).not.toContain("NOT");
    expect(JSON.stringify(whereGalerias("ws-1", c({ filtros: { revision: "no" } })))).toContain("NOT");
  });
  it("la búsqueda cubre número, nombre, proyecto y contacto", () => {
    const j = JSON.stringify(whereGalerias("ws-1", c({ q: "ana" })));
    for (const campo of ["number", "name", "firstName", "lastName", "businessName"]) expect(j).toContain(campo);
  });
  it("ordena por alta (por omisión) o por actualización, con desempate por id", () => {
    expect(ordenarGalerias(c())).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(ordenarGalerias(c({ orden: { campo: "actualizado", desc: false } }))).toEqual([{ updatedAt: "asc" }, { id: "asc" }]);
  });
  it("la definición: clave, filtros, sin acciones en lote y sin columnas de dinero", () => {
    expect(listadoGalerias.clave).toBe("galerias");
    expect(listadoGalerias.filtros.map((f) => f.clave)).toEqual(["estado", "revision"]);
    expect(listadoGalerias.acciones).toEqual([]);
    expect(listadoGalerias.hrefFicha("a b")).toBe("/galerias/a%20b");
    expect(JSON.stringify(listadoGalerias.exportar.columnas.map((x) => x.titulo))).not.toMatch(/total|precio|\$/i);
  });
  it("el total vendido es una columna de dinero (Caja): se recorta para quien no puede verlo, también en la exportación", () => {
    expect(listadoGalerias.columnas.find((x) => x.clave === "vendido")?.dinero).toBe("cash");
    expect(listadoGalerias.exportar.columnas.find((x) => x.titulo === "Vendido")?.dinero).toBe("cash");
    const ctx = (levels: Record<string, string>, role = "STAFF") => ({ workspaceId: "ws-1", workspaceName: "W", userId: 1, userLabel: "A", role, acceso: { role, levels } as never });
    const claves = (c: ReturnType<typeof ctx>) => recortarPorDinero(listadoGalerias, c).columnas.map((x) => x.clave);
    expect(claves(ctx({ gallery: "VIEW" }))).not.toContain("vendido");
    expect(recortarPorDinero(listadoGalerias, ctx({ gallery: "MANAGE" })).exportar.columnas.map((x) => x.titulo)).not.toContain("Vendido");
    expect(claves(ctx({ gallery: "VIEW", cash: "VIEW" }))).toContain("vendido");
    expect(claves(ctx({ gallery: "VIEW" }, "WORKSPACE_OWNER"))).toContain("vendido");
  });
  it("la celda del total vendido muestra pesos o un guion", () => {
    const col = listadoGalerias.columnas.find((x) => x.clave === "vendido")!;
    const fila = (vendidoCentavos: number | null) => ({ vendidoCentavos }) as never;
    expect(JSON.stringify(col.celda(fila(450_000)))).toContain("4.500,00");
    expect(JSON.stringify(col.celda(fila(0)))).toContain("—");
    expect(JSON.stringify(col.celda(fila(null)))).toContain("—");
    const exportado = listadoGalerias.exportar.columnas.find((x) => x.titulo === "Vendido")!;
    expect(exportado.valor(fila(450_050))).toBe(4500.5);
    expect(exportado.valor(fila(null))).toBeNull();
  });
});
