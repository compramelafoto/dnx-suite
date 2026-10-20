import { describe, expect, it } from "vitest";
import { saludoPara } from "./saludo";

const DUENO = { configurar: true, gestionarPresupuestos: true, verConsultas: true };
const STAFF = { configurar: false, gestionarPresupuestos: true, verConsultas: true };

describe("saludoPara", () => {
  it("dueño en Precios: ayuda a completar el formulario, pero NO sugiere armarlo conversando (es caro; se ofrece si se traba)", () => {
    const s = saludoPara("precios", DUENO);
    expect(s.saludo).toMatch(/^Hola, soy DNX Bot/);
    expect(s.sugerencias[0]).toBe("¿Qué me falta para completar mi perfil?");
    for (const p of ["precios", "presupuestos", "presupuesto", "consulta", "otra"] as const) {
      expect(saludoPara(p, DUENO).sugerencias.join(" ")).not.toMatch(/conversando/);
    }
  });
  it("dueño en Presupuestos: ofrece calcular", () => {
    expect(saludoPara("presupuestos", DUENO).sugerencias).toContain("Quiero saber cuánto cobrar un trabajo.");
  });
  it("sin configurar: nunca sugiere perfil ni cálculo", () => {
    for (const p of ["precios", "presupuestos", "presupuesto", "consulta", "otra"] as const) {
      const s = saludoPara(p, STAFF);
      expect(s.sugerencias.join(" ")).not.toMatch(/perfil|cuánto cobrar|calcul/i);
      expect(s.sugerencias.length).toBeGreaterThan(0);
    }
  });
  it("como mucho tres sugerencias, sin repetidas", () => {
    for (const p of ["precios", "presupuestos", "presupuesto", "consulta", "otra"] as const) {
      const s = saludoPara(p, DUENO).sugerencias;
      expect(s.length).toBeLessThanOrEqual(3);
      expect(new Set(s).size).toBe(s.length);
    }
  });
});
