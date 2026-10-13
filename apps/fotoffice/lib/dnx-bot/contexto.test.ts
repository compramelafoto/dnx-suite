import { describe, expect, it } from "vitest";
import { leerContexto } from "./contexto";

describe("leerContexto", () => {
  it("acepta la pantalla y los ids del cuerpo, saneados", () => {
    expect(leerContexto({ pantalla: "presupuesto", presupuestoId: "cm123_ab-c", consultaLeadId: "x" }, null)).toEqual({
      pantalla: "presupuesto",
      presupuestoId: "cm123_ab-c",
      consultaLeadId: "x",
    });
  });
  it("descarta ids con caracteres raros o demasiado largos", () => {
    const c = leerContexto({ pantalla: "consulta", presupuestoId: "a b", consultaLeadId: "z".repeat(41) }, null);
    expect(c.presupuestoId).toBeNull();
    expect(c.consultaLeadId).toBeNull();
  });
  it("pantalla desconocida o ausente: la deduce del pagePath", () => {
    expect(leerContexto({ pantalla: "admin" }, "/workspace/configuracion/precios").pantalla).toBe("precios");
    expect(leerContexto(null, "/presupuestos").pantalla).toBe("presupuestos");
    expect(leerContexto(undefined, "/presupuestos/cm1").pantalla).toBe("presupuesto");
    expect(leerContexto(undefined, "/presupuestos/nuevo").pantalla).toBe("presupuestos");
    expect(leerContexto(undefined, "/consultas/cm1").pantalla).toBe("consulta");
    expect(leerContexto(undefined, "/socios").pantalla).toBe("otra");
    expect(leerContexto("texto", null)).toEqual({ pantalla: "otra", presupuestoId: null, consultaLeadId: null });
  });
  it("nunca toma ids del pagePath (los manda el botón, con su contexto)", () => {
    expect(leerContexto(undefined, "/presupuestos/cm1").presupuestoId).toBeNull();
  });
});
