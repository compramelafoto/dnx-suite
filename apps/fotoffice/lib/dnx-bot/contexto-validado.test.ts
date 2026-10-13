import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ leer: vi.fn(), consulta: vi.fn() }));
vi.mock("@/lib/presupuestos/presupuestos", () => ({ leerPresupuesto: (...a: unknown[]) => H.leer(...a) }));
vi.mock("./consultas", () => ({ consultaParaBorrador: (...a: unknown[]) => H.consulta(...a) }));
import type { CtxBot } from "./acceso";
import { revalidarContexto } from "./contexto-validado";

const ctx = (verConsultas = true): CtxBot => ({
  workspaceId: "ws1", workspaceNombre: "E", userId: 1, userLabel: "X", role: "WORKSPACE_OWNER", email: "x", nombre: null,
  capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas }, plataforma: "FOTOFFICE:ws1",
});

beforeEach(() => {
  H.leer.mockReset().mockResolvedValue(null);
  H.consulta.mockReset().mockResolvedValue(null);
});

describe("revalidarContexto", () => {
  it("sin ids no consulta nada", async () => {
    expect(await revalidarContexto(ctx(), { pantalla: "otra", presupuestoId: null, consultaLeadId: null })).toEqual({});
    expect(H.leer).not.toHaveBeenCalled();
  });
  it("un presupuesto del workspace queda; uno ajeno o inexistente se ignora igual", async () => {
    H.leer.mockResolvedValueOnce({ id: "p1", numero: "0007", estado: "BORRADOR", borrador: {} });
    expect(await revalidarContexto(ctx(), { pantalla: "presupuesto", presupuestoId: "p1", consultaLeadId: null })).toEqual({
      presupuesto: { id: "p1", numero: "0007", estado: "BORRADOR", esBorrador: true },
    });
    expect(H.leer.mock.calls[0]![1]).toBe("p1");
    expect(await revalidarContexto(ctx(), { pantalla: "presupuesto", presupuestoId: "ajeno", consultaLeadId: null })).toEqual({});
  });
  it("la consulta sólo con «Ver» en Consultas, y sin datos de contacto", async () => {
    H.consulta.mockResolvedValue({ leadId: "l1", numero: "12", nombreDePila: "Lucía", categoria: "Bodas", fechaEvento: "15/11/2026", tieneFicha: true, presupuestos: [], categoriaId: "c" });
    expect(await revalidarContexto(ctx(), { pantalla: "consulta", presupuestoId: null, consultaLeadId: "l1" })).toEqual({
      consulta: { leadId: "l1", numero: "12", nombreDePila: "Lucía", categoria: "Bodas", fechaEvento: "15/11/2026", tieneFicha: true },
    });
    expect(await revalidarContexto(ctx(false), { pantalla: "consulta", presupuestoId: null, consultaLeadId: "l1" })).toEqual({});
  });
  it("si la lectura falla, sigue sin contexto", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    H.leer.mockRejectedValue(new Error("db"));
    expect(await revalidarContexto(ctx(), { pantalla: "presupuesto", presupuestoId: "p1", consultaLeadId: null })).toEqual({});
    log.mockRestore();
  });
});
