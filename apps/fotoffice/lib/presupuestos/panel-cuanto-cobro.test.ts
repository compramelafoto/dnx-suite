import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile, createBaseCompleteQuote } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { entradaDelMotor, recalcularItemCalculo } from "./calculo-cuanto-cobro";
import {
  armarItemsDelAsistente,
  calcularItemDelPanel,
  entradaDelPanel,
  perfilParaPanel,
  trabajoDesdeMotor,
  trabajoVacio,
  type TrabajoPanel,
} from "./panel-cuanto-cobro";

const CUANDO = new Date("2026-10-07T15:00:00.000Z");
const PERFIL = createBaseCompleteProfile();
const BODA: TrabajoPanel = { ...trabajoVacio("Cobertura de boda"), horasCobertura: "8", horasEdicion: "10", horasEntrega: "1", horasViaje: "2", costoDirecto: "20000", horasCliente: "3" };

describe("panel de ¿Cuánto Cobro? (motor real)", () => {
  it("el perfil completo del workspace corre en el motor", () => {
    const r = calculateCuantoCobro(PERFIL, entradaDelPanel(PERFIL, BODA, "Boda").presupuesto);
    expect(r.status).toBe("complete");
  });

  it("sin gastos personales o sin horas, el motor dice qué falta", () => {
    const r = calcularItemDelPanel({ ...PERFIL, personalExpenseGroups: [], weeklyHours: "" }, BODA, "Boda", { id: "i1", nombre: "Boda" }, CUANDO);
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

  it("se reabre: la entrada guardada devuelve el trabajo y da el mismo precio", () => {
    const entrada = entradaDelPanel(PERFIL, BODA, "Boda");
    const t = trabajoDesdeMotor(entrada.presupuesto)!;
    expect(t.tipoDeTrabajo).toBe("Boda");
    expect(trabajoDesdeMotor(createBaseCompleteQuote())?.trabajo.horasCobertura).toBe("6");
    expect(trabajoDesdeMotor({ concepts: [] })).toBeNull();
    const a = calcularItemDelPanel(PERFIL, BODA, "Boda", { id: "x", nombre: "x" }, CUANDO);
    const b = calcularItemDelPanel(PERFIL, t.trabajo, t.tipoDeTrabajo, { id: "x", nombre: "x" }, CUANDO);
    expect(a.ok && b.ok && a.item.precioUnitario === b.item.precioUnitario).toBe(true);
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

  it("al reabrir un ítem calculado, el panel usa SU perfil guardado y avisa si el del workspace cambió", () => {
    const r = calcularItemDelPanel(PERFIL, BODA, "Boda", { id: "i1", nombre: "Boda" }, CUANDO);
    if (!r.ok) throw new Error(r.error);
    const otro = { ...PERFIL, weeklyHours: "10" };
    const conOtro = perfilParaPanel(r.item, otro);
    expect(conOtro.origen).toBe("item");
    expect(conOtro.desactualizado).toBe(true);
    expect(conOtro.perfil).toMatchObject({ weeklyHours: PERFIL.weeklyHours });
    expect(perfilParaPanel(r.item, PERFIL)).toMatchObject({ origen: "item", desactualizado: false });
    expect(perfilParaPanel(r.item, null)).toMatchObject({ origen: "item", desactualizado: false });
  });

  it("sin perfil en el ítem: el del workspace, o ninguno", () => {
    expect(perfilParaPanel({ calculo: null }, PERFIL)).toEqual({ perfil: PERFIL, origen: "workspace", desactualizado: false });
    expect(perfilParaPanel({ calculo: null }, null)).toEqual({ perfil: null, origen: "ninguno", desactualizado: false });
    expect(perfilParaPanel(null, null).origen).toBe("ninguno");
    expect(perfilParaPanel({ calculo: { entrada: { perfil: "roto" } } }, PERFIL).origen).toBe("workspace");
  });
});

describe("disparos del trabajo y embalaje (desgaste de cámara por trabajo)", () => {
  it("los disparos estimados y el embalaje llegan al motor y vuelven al reabrir el panel", async () => {
    const { trabajoAlMotor, trabajoDesdeMotor, trabajoVacio: vacio } = await import("./panel-cuanto-cobro");
    const t = { ...vacio("Cobertura"), horasCobertura: "8", disparosEstimados: "2500" };
    const q = trabajoAlMotor(t, "Casamiento");
    expect(q.concepts[0]!.estimatedShots).toBe("2500");
    const p = { ...vacio("Álbum"), tipo: "physical-product" as const, costoProveedor: "180000", costoEmbalaje: "5000" };
    expect(trabajoAlMotor(p, "Casamiento").concepts[0]!.packagingCost).toBe("5000");
    expect(trabajoDesdeMotor(q)!.trabajo.disparosEstimados).toBe("2500");
    expect(trabajoDesdeMotor(trabajoAlMotor(p, "x"))!.trabajo.costoEmbalaje).toBe("5000");
    expect(vacio("x")).toMatchObject({ disparosEstimados: "", costoEmbalaje: "" });
  });
  it("con la cámara en el perfil, el motor calcula el desgaste de esos disparos (hoy, informativo: la cámara ya está en la renovación)", async () => {
    const { calcularItemDelPanel, correrMotor, trabajoVacio: vacio } = await import("./panel-cuanto-cobro");
    const { entradaDelMotor } = await import("./calculo-cuanto-cobro");
    const { createBaseCompleteProfile: perfil } = await import("@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures");
    const conCamara = perfil({ equipmentRenewalMonthly: "", equipmentInventory: undefined, primaryCameraPresetId: "custom", primaryCameraReplacementValue: "3000000", primaryCameraShutterRating: "200000" });
    const sin = calcularItemDelPanel(conCamara, { ...vacio("Cobertura"), horasCobertura: "8" }, "Boda", { id: "a", nombre: "Cobertura" });
    const con = calcularItemDelPanel(conCamara, { ...vacio("Cobertura"), horasCobertura: "8", disparosEstimados: "2000" }, "Boda", { id: "a", nombre: "Cobertura" });
    if (!sin.ok || !con.ok) throw new Error("no calculó");
    const r = correrMotor(entradaDelMotor(con.item.calculo!.entrada)!);
    if (!r || r.status !== "complete") throw new Error("no calculó");
    // 2000 disparos × (3.000.000 / 200.000) = 30.000.
    expect(r.cameraWearSummary.totalJobShots).toBe(2000);
    expect(r.cameraWearSummary.totalCameraWearInformative).toBe(30_000);
    // El motor toma la cámara como renovación mensual (modo estructural) y no lo suma de nuevo: el precio no cambia.
    expect(r.cameraWearSummary.totalCameraWearCharged).toBe(0);
    expect(con.item.calculo!.precioSugerido).toBe(sin.item.calculo!.precioSugerido);
  });
});
