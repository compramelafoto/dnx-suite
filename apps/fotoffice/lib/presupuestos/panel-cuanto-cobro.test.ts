import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile, createBaseCompleteQuote } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { entradaDelMotor, recalcularItemCalculo } from "./calculo-cuanto-cobro";
import {
  armarItemsDelAsistente,
  calcularItemDelPanel,
  entradaDelPanel,
  PERFIL_VACIO,
  perfilAlMotor,
  perfilDesdeMotor,
  trabajoDesdeMotor,
  trabajoVacio,
  type PerfilPanel,
  type TrabajoPanel,
} from "./panel-cuanto-cobro";

const CUANDO = new Date("2026-10-07T15:00:00.000Z");
const PERFIL: PerfilPanel = { ...PERFIL_VACIO, gastosPersonales: "900000", alquiler: "100000", software: "30000", horasSemanales: "40", horasCobertura: "14" };
const BODA: TrabajoPanel = { ...trabajoVacio("Cobertura de boda"), horasCobertura: "8", horasEdicion: "10", horasEntrega: "1", horasViaje: "2", costoDirecto: "20000", horasCliente: "3" };

describe("panel de ¿Cuánto Cobro? (motor real)", () => {
  it("el perfil corto da un perfil completo del motor (distribución que suma el total semanal)", () => {
    const r = calculateCuantoCobro(perfilAlMotor(PERFIL), entradaDelPanel(PERFIL, BODA, "Boda").presupuesto);
    expect(r.status).toBe("complete");
  });

  it("sin gastos personales o sin horas, el motor dice qué falta", () => {
    const r = calcularItemDelPanel({ ...PERFIL, gastosPersonales: "" }, BODA, "Boda", { id: "i1", nombre: "Boda" }, CUANDO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.faltan.length).toBeGreaterThan(0);
  });

  it("arma un ítem CALCULO con la entrada del motor guardada; el servidor llega al mismo precio (R2)", () => {
    const r = calcularItemDelPanel(PERFIL, BODA, "Boda", { id: "i1", nombre: "Boda", seccion: "Cobertura" }, CUANDO);
    if (!r.ok) throw new Error(r.error + r.faltan.join(","));
    expect(r.item).toMatchObject({ id: "i1", modoPrecio: "CALCULO", cantidad: 1, seccion: "Cobertura" });
    expect(r.item.precioUnitario).toBeGreaterThan(0);
    const entrada = entradaDelMotor(r.item.calculo!.entrada);
    expect(entrada).not.toBeNull();
    // Lo que manda el navegador con precio 0 (= el sugerido) se recalcula igual en el servidor.
    const servidor = recalcularItemCalculo({ ...r.item, precioUnitario: 0, calculo: null }, entrada!, CUANDO);
    expect(servidor.ok && servidor.item.precioUnitario).toBe(r.item.precioUnitario);
  });

  it("el precio manual del motor y el ajuste del editor mandan", () => {
    const manual = calcularItemDelPanel(PERFIL, { ...BODA, precioManual: "777000" }, "Boda", { id: "i1", nombre: "Boda" }, CUANDO);
    expect(manual.ok && manual.item.precioUnitario).toBe(777000);
    const ajustado = calcularItemDelPanel(PERFIL, BODA, "Boda", { id: "i1", nombre: "Boda", precioAjustado: 500000 }, CUANDO);
    expect(ajustado.ok && ajustado.item.precioUnitario).toBe(500000);
  });

  it("se reabre: del motor al formulario corto y de vuelta da el mismo precio", () => {
    const entrada = entradaDelPanel(PERFIL, BODA, "Boda");
    const perfil = perfilDesdeMotor(entrada.perfil)!;
    const t = trabajoDesdeMotor(entrada.presupuesto)!;
    expect(perfil).toMatchObject({ gastosPersonales: "900000", horasSemanales: "40", horasCobertura: "14" });
    expect(t.tipoDeTrabajo).toBe("Boda");
    const a = calcularItemDelPanel(PERFIL, BODA, "Boda", { id: "x", nombre: "x" }, CUANDO);
    const b = calcularItemDelPanel(perfil, t.trabajo, t.tipoDeTrabajo, { id: "x", nombre: "x" }, CUANDO);
    expect(a.ok && b.ok && a.item.precioUnitario === b.item.precioUnitario).toBe(true);
  });

  it("un perfil completo del motor (el de CLF) se lee en corto", () => {
    const p = perfilDesdeMotor(createBaseCompleteProfile())!;
    expect(p.gastosPersonales).toBe("200000");
    expect(trabajoDesdeMotor(createBaseCompleteQuote())?.trabajo.horasCobertura).toBe("6");
    expect(perfilDesdeMotor(null)).toBeNull();
    expect(trabajoDesdeMotor({ concepts: [] })).toBeNull();
  });

  it("'Armar con ¿Cuánto Cobro?': un ítem por concepto; las horas con el cliente, sólo en el primero", () => {
    let n = 0;
    const album: TrabajoPanel = { ...trabajoVacio("Álbum 30x30"), tipo: "physical-product", costoProveedor: "150000", horasDiseno: "6", margenDeseado: "30", horasCliente: "5" };
    const r = armarItemsDelAsistente(PERFIL, [BODA, album], "Boda", { seccion: "Boda", nuevaClave: () => `k${++n}`, ahora: CUANDO });
    if (!r.ok) throw new Error(r.error);
    expect(r.items.map((i) => [i.id, i.nombre, i.seccion, i.modoPrecio])).toEqual([
      ["k1", "Cobertura de boda", "Boda", "CALCULO"],
      ["k2", "Álbum 30x30", "Boda", "CALCULO"],
    ]);
    const segunda = trabajoDesdeMotor((r.items[1]!.calculo!.entrada as { presupuesto: unknown }).presupuesto)!;
    expect(segunda.trabajo.horasCliente).toBe("");
    expect(armarItemsDelAsistente(PERFIL, [], "", { nuevaClave: () => "z" }).ok).toBe(false);
  });
});
