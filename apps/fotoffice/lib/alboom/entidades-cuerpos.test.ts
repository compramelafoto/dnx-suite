import { describe, expect, it } from "vitest";
import { entidadPorClave } from "./entidades";

/** Lo que manda el panel de Alboom; con otra cosa Alboom responde 500 (probado en el panel de DNX el 25/10/2026). */
function cuerpo(clave: string): Record<string, unknown> {
  const f = entidadPorClave(clave)!.fuente;
  if (f.tipo !== "paginada") throw new Error(`${clave} no es paginada`);
  return f.body(1, 25) as Record<string, unknown>;
}

describe("cuerpos de los listados de Alboom", () => {
  it("proyectos: class_id y expired (obligatorio), sin class ni period", () => {
    const b = cuerpo("proyectos");
    expect(b).toMatchObject({ class_id: "all", expired: "false", pipeline: "all", stage: "all", user: "all" });
    expect(b).not.toHaveProperty("class");
    expect(b).not.toHaveProperty("period");
  });
  it("citas: Otro período con el rango de fechas", () => {
    expect(cuerpo("citas")).toMatchObject({ start_type: "other", status: "All", is_csv: 0 });
  });
  it("cuentas, cobros y pagos: customer_id y groupBy nulos, sin user_id", () => {
    for (const c of ["cuentas_cobrar", "cuentas_pagar", "cobros", "pagos"]) {
      const b = cuerpo(c);
      expect(b).toMatchObject({ customer_id: null, groupBy: null, sortBy: "account_trans.id" });
      expect(b).not.toHaveProperty("user_id");
    }
  });
  it("movimientos de bancos: type transactions con todas las cuentas", () => {
    expect(cuerpo("movimientos_bancos")).toMatchObject({ type: "transactions", account_id: "all" });
  });
  it("participantes de proyectos: con offset y count", () => {
    const f = entidadPorClave("proyectos_participantes")!.fuente;
    if (f.tipo !== "porPadre") throw new Error("no es porPadre");
    expect(f.pedido("2025556", 100)).toMatchObject({ method: "POST", body: { type: "projects", id: "2025556", offset: 100, count: 100 } });
    expect(f.paginaDe).toBe(100);
  });
  it("tareas: el offset es el número de página (de a 100)", () => {
    const f = entidadPorClave("tareas")!.fuente;
    if (f.tipo !== "porDesplazamiento") throw new Error("no es porDesplazamiento");
    expect(f.ruta(0)).toBe("/tasks?offset=0&filteruser=all");
    expect(f.ruta(100)).toBe("/tasks?offset=1&filteruser=all");
    expect(f.ruta(800)).toBe("/tasks?offset=8&filteruser=all");
  });
});
