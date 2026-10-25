/** Mi estudio en el panel de ¿Cuánto Cobro? (E3): quién hace qué, cámara por concepto y línea del estudio. */
import { describe, expect, it } from "vitest";
import { createStudioPerson, getQuoteLaborRates } from "@repo/cuanto-cobro-core";
import { perfilConEstudio, SPEC } from "@repo/cuanto-cobro-core/__fixtures__/studio-fixtures";
import { calcularItemDelPanel, conAsignaciones, tercerizadoDePersona, trabajoAlMotor, trabajoDesdeMotor, trabajoVacio, type TrabajoPanel } from "./panel-cuanto-cobro";

const PERFIL = {
  ...perfilConEstudio(SPEC),
  cameras: [{ id: "cam-2", name: "Carnets", presetId: "custom", shutterRating: "150000", currentShutterCount: "", replacementValue: "500000" }],
};
const T = getQuoteLaborRates(PERFIL)!.byPerson!;
const datos = { id: "i1", nombre: "Evento" };

function evento(): TrabajoPanel {
  const t = { ...trabajoVacio("Evento"), horasEdicion: "10" };
  return conAsignaciones(t, [
    { persona: "owner", actividad: "coverage", horas: "6" },
    { persona: "sp-sabi", actividad: "coverage", horas: "6" },
    { persona: "owner", actividad: "travel", horas: "1" },
    { persona: "sp-sabi", actividad: "travel", horas: "1" },
    { persona: "sp-cami", actividad: "editing", horas: "10" },
  ]);
}

describe("panel con Mi estudio", () => {
  it("las horas de cada actividad asignada son la suma de lo asignado (horas-persona)", () => {
    const t = evento();
    expect([t.horasCobertura, t.horasViaje, t.horasEdicion]).toEqual(["12", "2", "10"]);
  });

  it("al motor van las asignaciones, la cámara, los disparos por trabajo y la línea", () => {
    const t: TrabajoPanel = { ...evento(), camara: "cam-2", disparosPor: "job", linea: "events" };
    const q = trabajoAlMotor(t, "Boda");
    const c = q.concepts[0]!;
    expect(c.assignments).toHaveLength(5);
    expect(c.cameraId).toBe("cam-2");
    expect(c.shotsPer).toBe("job");
    expect(q.businessLineId).toBe("events");
    const vuelta = trabajoDesdeMotor(q)!.trabajo;
    expect(vuelta.asignaciones).toEqual(t.asignaciones);
    expect([vuelta.camara, vuelta.disparosPor, vuelta.linea]).toEqual(["cam-2", "job", "events"]);
  });

  it("un trabajo sin nada de esto queda como antes (sin claves nuevas)", () => {
    const c = trabajoAlMotor(trabajoVacio("Sesión"), "Sesión").concepts[0]!;
    expect("assignments" in c || "cameraId" in c || "shotsPer" in c).toBe(false);
  });

  it("el ítem calculado cobra cada hora a la tarifa de quien la hace y guarda quién lo hizo", () => {
    const r = calcularItemDelPanel(PERFIL, evento(), "Boda", datos);
    if (!r.ok) throw new Error(r.error);
    const c = r.item.calculo!;
    expect(c.costoHumano).toBeCloseTo(7 * T.owner! + 7 * T["sp-sabi"]! + 10 * T["sp-cami"]!, 0);
    expect(c.porPersona?.map((p) => [p.nombre, p.horas])).toEqual([
      ["Daniel", 7],
      ["Sabi", 7],
      ["Cami", 10],
    ]);
  });

  it("carnet: producto con 3 disparos por unidad en la cámara de carnets = $10 por unidad", () => {
    const carnet: TrabajoPanel = { ...trabajoVacio("Carnet"), tipo: "physical-product", cantidad: "4", costoProveedor: "300", disparosEstimados: "3", camara: "cam-2" };
    const r = calcularItemDelPanel(PERFIL, carnet, "Carnet", { id: "c1", nombre: "Carnet" });
    if (!r.ok) throw new Error(r.error);
    expect(r.item.calculo!.costosVariables).toBe(4 * 300 + 40);
  });

  it("persona «por trabajo»: el tercerizado toma su tarifa", () => {
    const leo = createStudioPerson({ id: "sp-leo", name: "Leo", employmentType: "per-job", perJobRate: "20000", perJobUnit: "hour" });
    const t = tercerizadoDePersona(trabajoVacio(""), leo, "5");
    expect([t.tipo, t.nombre, t.costoTercerizado, t.tercerizadoPor]).toEqual(["outsourced", "Leo", "100000", "sp-leo"]);
    const porTrabajo = tercerizadoDePersona(trabajoVacio("Video"), { ...leo, perJobUnit: "job", perJobRate: "150000" });
    expect([porTrabajo.nombre, porTrabajo.costoTercerizado]).toEqual(["Video", "150000"]);
  });
});
