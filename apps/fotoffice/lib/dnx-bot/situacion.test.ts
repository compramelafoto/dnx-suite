import { describe, expect, it } from "vitest";
import { armarSituacion } from "./situacion";

const DUENO = { configurar: true, gestionarPresupuestos: true, verConsultas: true };
const STAFF = { configurar: false, gestionarPresupuestos: true, verConsultas: false };
const ctx = { pantalla: "presupuestos" as const, presupuestoId: "cm999", consultaLeadId: null };

describe("armarSituacion", () => {
  it("dueño: workspace, rol, pantalla y que puede calcular", () => {
    const s = armarSituacion({ rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: "DNX Estudio" });
    expect(s).toMatch(/^# Situación/);
    expect(s).toContain("DNX Estudio");
    expect(s).toContain("Rol: dueño");
    expect(s).toContain("Pantalla: lista de presupuestos");
    expect(s).toContain("Puede usar ¿Cuánto Cobro?");
  });
  it("STAFF sin configurar: dice que el cálculo lo usan el dueño y los administradores", () => {
    const s = armarSituacion({ rol: "STAFF", capacidades: STAFF, contexto: ctx, workspaceNombre: "DNX Estudio" });
    expect(s).toContain("Rol: equipo");
    expect(s).toContain("el dueño y los administradores");
    expect(s).toContain("No puede abrir");
    expect(s).toContain("/workspace/configuracion/precios");
  });
  it("no copia los ids crudos del pedido (se revalidan en las etapas 2 y 3)", () => {
    const s = armarSituacion({ rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null });
    expect(s).not.toContain("cm999");
  });
});
