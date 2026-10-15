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
  it("estado del perfil: completo, incompleto con lo que falta, o sin armar; nunca montos", () => {
    const base = { rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null };
    expect(armarSituacion({ ...base, perfil: { existe: true, completo: true, faltan: [], origen: "clf-import" } })).toContain(
      "Perfil de precios: completo (importado de CompraMeLaFoto).",
    );
    expect(armarSituacion({ ...base, perfil: { existe: true, completo: false, faltan: ["Software y herramientas"], origen: "manual" } })).toContain(
      "Perfil de precios: incompleto (cargado a mano). Falta: Software y herramientas. Se completa en el formulario de /workspace/configuracion/precios; armarlo conversando, sólo si la persona lo pide o dice que no puede.",
    );
    expect(armarSituacion({ ...base, perfil: { existe: false, completo: false, faltan: ["x"], origen: null } })).toContain(
      "Perfil de precios: todavía no está armado. Se completa en el formulario de /workspace/configuracion/precios; armarlo conversando, sólo si la persona lo pide o dice que no puede.",
    );
    expect(armarSituacion({ ...base, perfil: null })).not.toContain("Perfil de precios");
  });
  it("lo que está mirando, ya revalidado: presupuesto y consulta con sus ids para usar en herramientas", () => {
    const s = armarSituacion({
      rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null,
      enPantalla: {
        presupuesto: { id: "p1", numero: "0007", estado: "BORRADOR", esBorrador: true },
        consulta: { leadId: "l1", numero: "12", nombreDePila: "Lucía", categoria: "Bodas", fechaEvento: "15/11/2026", tieneFicha: true },
      },
    });
    expect(s).toContain("Está mirando el presupuesto N.º 0007 (presupuestoId p1), en borrador.");
    expect(s).toContain("Está mirando la consulta N.º 12 (consultaLeadId l1): Bodas · 15/11/2026 · de Lucía.");
  });
  it("borrador del perfil: retoma donde quedó (lo anotado y lo que falta), sin montos", () => {
    const s = armarSituacion({
      rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null,
      perfil: {
        existe: false, completo: false, faltan: ["x"], origen: null,
        borrador: { anotado: ["si vive sólo de la fotografía", "gastos de Vivienda (Alquiler / hipoteca)"], faltan: ["Horas por semana"], rubrosSinDatos: ["Salud"] },
      },
    });
    expect(s).toContain("Borrador del perfil");
    expect(s).toContain("gastos de Vivienda (Alquiler / hipoteca)");
    expect(s).toContain("Horas por semana");
    expect(s).toContain("Salud");
    expect(s).toMatch(/Seguimos donde quedamos/);
    expect(s).toMatch(/no vuelvas a preguntar/i);
    // A mitad de la entrevista no la manda al formulario; sin borrador, sí (PR 592).
    expect(s).toContain("seguí la entrevista; no la mandes al formulario");
    expect(s).not.toContain("Se completa en el formulario");
  });
  it("el resumen de lo que quedó fuera de la ventana va al final", () => {
    const s = armarSituacion({ rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null, antes: "# Antes en esta conversación\n- «hola»" });
    expect(s.endsWith("# Antes en esta conversación\n- «hola»")).toBe(true);
    expect(armarSituacion({ rol: "WORKSPACE_OWNER", capacidades: DUENO, contexto: ctx, workspaceNombre: null, antes: null })).not.toContain("Antes en esta");
  });
});
