import { describe, expect, it } from "vitest";
import { clasificarTodo } from "./lote";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

function motivos(f: Parameters<typeof clasificarTodo>[0]) {
  return clasificarTodo(f, MAPEO_PRUEBA).map((m) => m.motivos);
}

describe("motivos de revisión", () => {
  it("una fila común no se marca", () => {
    expect(motivos([fila("2024-01-02", "CARNET", 2500)])).toEqual([[]]);
  });

  it("confianza baja de la regla", () => {
    expect(motivos([fila("2024-01-02", "KINESIO", -7000)])[0]).toContain("CONFIANZA_BAJA");
  });

  it("signo contrario al de la clase", () => {
    expect(motivos([fila("2024-01-02", "CARNET", -2500)])[0]).toContain("SIGNO_CONTRARIO");
    expect(motivos([fila("2024-01-02", "CADETE", 1000)])[0]).toContain("SIGNO_CONTRARIO");
  });

  it("sin concepto y sin regla", () => {
    const m = motivos([
      fila("2024-01-02", "(SIN CONCEPTO)", 2500),
      fila("2024-01-02", "CARNET", 2500, { observacion: "monto_sin_texto" }),
      fila("2024-01-02", "NUEVO", 2500),
    ]);
    expect(m[0]).toEqual(expect.arrayContaining(["SIN_CONCEPTO", "SIN_REGLA"]));
    expect(m[1]).toContain("SIN_CONCEPTO");
    expect(m[2]).toEqual(["SIN_REGLA"]);
  });

  it("monto fuera de lo común para su concepto", () => {
    const filas = Array.from({ length: 12 }, (_, i) => fila(`2026-01-${String(i + 1).padStart(2, "0")}`, "CARNET", 5000));
    filas.push(fila("2026-01-12", "CARNET", 287_000));
    const m = motivos(filas);
    expect(m.at(-1)).toContain("MONTO_INUSUAL");
    expect(m[0]).not.toContain("MONTO_INUSUAL");
  });

  it("posible duplicado: mismo concepto e importe grande en 45 días o menos", () => {
    const m = motivos([
      fila("2024-12-03", "OTROS", 394_500),
      fila("2025-01-08", "OTROS", 394_500),
      fila("2025-06-08", "OTROS", 394_500),
      fila("2024-12-03", "CARNET", 2500),
      fila("2024-12-03", "CARNET", 2500),
    ]);
    expect(m[0]).toContain("POSIBLE_DUPLICADO");
    expect(m[1]).toContain("POSIBLE_DUPLICADO");
    expect(m[2]).not.toContain("POSIBLE_DUPLICADO");
    expect(m[3]).not.toContain("POSIBLE_DUPLICADO");
  });

  it("los movimientos internos no son ingreso ni gasto: el signo no se revisa", () => {
    expect(motivos([fila("2026-02-28", "RETIROS", -1_967_400)])).toEqual([[]]);
  });
});
