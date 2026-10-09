import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { whereProyectos } = await import("./listado");

const consulta = (filtros: Record<string, string> = {}, q = "") =>
  ({ q, filtros, orden: { campo: "alta", desc: true }, pagina: 1, filas: 25, ver: null, periodos: {}, etiquetasRelacion: {} }) as never;

describe("whereProyectos", () => {
  it("siempre acota al workspace", () => {
    expect(whereProyectos("ws-1", consulta(), null, "2026-10-15")).toEqual({ workspaceId: "ws-1" });
  });

  it("estado: suspendido, cerrado (por ids) y en curso (ni suspendido ni cerrado)", () => {
    const cerrados = { excedido: false as const, ids: ["a", "b"] };
    expect(whereProyectos("ws-1", consulta({ estado: "SUSPENDIDO" }), null, "2026-10-15")).toEqual({ workspaceId: "ws-1", AND: [{ suspendedAt: { not: null } }] });
    expect(whereProyectos("ws-1", consulta({ estado: "CERRADO" }), cerrados, "2026-10-15")).toEqual({ workspaceId: "ws-1", AND: [{ id: { in: ["a", "b"] } }] });
    expect(whereProyectos("ws-1", consulta({ estado: "EN_CURSO" }), cerrados, "2026-10-15")).toEqual({
      workspaceId: "ws-1",
      AND: [{ suspendedAt: null }, { NOT: { id: { in: ["a", "b"] } } }],
    });
  });

  it("vencidos: pasó la fecha final y sigue vivo (un suspendido nunca es vencido)", () => {
    const w = whereProyectos("ws-1", consulta({ vencidos: "si" }), { excedido: false, ids: [] }, "2026-10-15") as { AND: Record<string, unknown>[] };
    expect(w.AND[0]).toMatchObject({ finalDueDate: { lt: new Date("2026-10-15T00:00:00.000Z") }, suspendedAt: null });
    const no = whereProyectos("ws-1", consulta({ vencidos: "no" }), { excedido: false, ids: [] }, "2026-10-15") as { AND: Record<string, unknown>[] };
    expect(no.AND[0]).toHaveProperty("NOT");
  });

  it("con demasiados cerrados la lista sale vacía, nunca parcial", () => {
    expect(whereProyectos("ws-1", consulta({ estado: "CERRADO" }), { excedido: true }, "2026-10-15")).toEqual({ workspaceId: "ws-1", id: { in: [] } });
  });

  it("la búsqueda mira número, nombre y contacto", () => {
    const w = whereProyectos("ws-1", consulta({}, "laura"), null, "2026-10-15") as { AND: { OR: unknown[] }[] };
    expect(w.AND[0]!.OR).toHaveLength(5);
  });
});
