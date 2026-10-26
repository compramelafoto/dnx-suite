import { describe, expect, it } from "vitest";
import { coincideConObjetivo, decidirAvance, decidirConciliacion, etapaDelObjetivo, normalizarNombreEtapa, notaAutomatica } from "./etapas-automaticas";

// El flujo «Digitalización (VHS, CD, DVD, casetes)» de DNX Estudio.
const DNX = [
  { id: "s1", name: "Recibido", order: 0 },
  { id: "s2", name: "Grabado", order: 1 },
  { id: "s3", name: "Subido a la nube y a YouTube", order: 2 },
  { id: "s4", name: "Listo para retirar", order: 3 },
  { id: "s5", name: "Material original retirado", order: 4 },
];
const abierto = (etapaActualId: string) => ({ etapaActualId, suspendido: false });

describe("búsqueda de la etapa por nombre", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizarNombreEtapa("  LISTO  para Retirár ")).toBe("listo para retirar");
  });
  it("GRABADO: «grabad» por inclusión, no «Grabando»", () => {
    expect(coincideConObjetivo("Grabado", "GRABADO")).toBe(true);
    expect(coincideConObjetivo("Cassette GRABADO", "GRABADO")).toBe(true);
    expect(coincideConObjetivo("Grabando", "GRABADO")).toBe(false);
    expect(coincideConObjetivo("Recibido", "GRABADO")).toBe(false);
  });
  it("LISTO: «listo para retirar» o «listo» + «retir»", () => {
    expect(coincideConObjetivo("Listo para retirar", "LISTO")).toBe(true);
    expect(coincideConObjetivo("Listo p/ retirar", "LISTO")).toBe(true);
    expect(coincideConObjetivo("Listo para retirár", "LISTO")).toBe(true);
    expect(coincideConObjetivo("Listo", "LISTO")).toBe(false);
    expect(coincideConObjetivo("Material original retirado", "LISTO")).toBe(false);
  });
  it("en el flujo de DNX encuentra «Grabado» y «Listo para retirar»", () => {
    expect(etapaDelObjetivo(DNX, "GRABADO")?.id).toBe("s2");
    expect(etapaDelObjetivo(DNX, "LISTO")?.id).toBe("s4");
  });
  it("ignora las archivadas y toma la primera en el orden del flujo", () => {
    const etapas = [{ id: "a", name: "Grabado", order: 5 }, { id: "b", name: "Grabado (viejo)", order: 1, archivedAt: new Date() }, { id: "c", name: "Cassette grabado", order: 2 }];
    expect(etapaDelObjetivo(etapas, "GRABADO")?.id).toBe("c");
  });
});

describe("decidirAvance: sólo hacia adelante", () => {
  it("de Recibido a Grabado, con la nota automática", () => {
    expect(decidirAvance(DNX, abierto("s1"), "GRABADO")).toEqual({ tipo: "MOVER", etapa: DNX[1], nota: "Entró en Grabado (automático: cassette grabado)" });
  });
  it("de Recibido a Listo para retirar, salteando las intermedias", () => {
    const d = decidirAvance(DNX, abierto("s1"), "LISTO");
    expect(d).toMatchObject({ tipo: "MOVER", etapa: { id: "s4" } });
    expect(decidirAvance(DNX, abierto("s3"), "LISTO")).toMatchObject({ tipo: "MOVER", etapa: { id: "s4" } });
  });
  it("ya está en la etapa o en una posterior: no se toca", () => {
    expect(decidirAvance(DNX, abierto("s2"), "GRABADO")).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
    expect(decidirAvance(DNX, abierto("s4"), "GRABADO")).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
    expect(decidirAvance(DNX, abierto("s4"), "LISTO")).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
    expect(decidirAvance(DNX, abierto("s5"), "LISTO")).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
  });
  it("suspendido, terminado o cancelado: no se toca", () => {
    expect(decidirAvance(DNX, { etapaActualId: "s1", suspendido: true }, "GRABADO")).toEqual({ tipo: "NADA", motivo: "SUSPENDIDO" });
    expect(decidirAvance(DNX, { etapaActualId: null, suspendido: false }, "LISTO")).toEqual({ tipo: "NADA", motivo: "CERRADO" });
  });
  it("el flujo no tiene la etapa: no hace nada", () => {
    const sinGrabado = DNX.filter((e) => e.id !== "s2");
    expect(decidirAvance(sinGrabado, abierto("s1"), "GRABADO")).toEqual({ tipo: "NADA", motivo: "SIN_ETAPA" });
  });
  it("etapa actual archivada o de otro flujo: no se arriesga a retroceder", () => {
    expect(decidirAvance(DNX, abierto("otra"), "GRABADO")).toEqual({ tipo: "NADA", motivo: "ETAPA_ACTUAL_DESCONOCIDA" });
  });
  it("nota", () => expect(notaAutomatica("Listo para retirar", "LISTO")).toBe("Entró en Listo para retirar (automático: videos enviados al cliente)"));
});

describe("decidirConciliacion (trabajos viejos)", () => {
  it("Liliana: entrega enviada y en «Recibido» → «Listo para retirar»", () => {
    expect(decidirConciliacion(DNX, abierto("s1"), { grabado: true, listo: true })).toMatchObject({ tipo: "MOVER", etapa: { id: "s4" } });
  });
  it("Cintia: ya en «Material original retirado» → no se toca", () => {
    expect(decidirConciliacion(DNX, abierto("s5"), { grabado: true, listo: true })).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
  });
  it("sólo grabado (sin entrega) → «Grabado»", () => {
    expect(decidirConciliacion(DNX, abierto("s1"), { grabado: true, listo: false })).toMatchObject({ tipo: "MOVER", etapa: { id: "s2" } });
  });
  it("en «Listo para retirar» con entrega: no vuelve a «Grabado»", () => {
    expect(decidirConciliacion(DNX, abierto("s4"), { grabado: true, listo: true })).toEqual({ tipo: "NADA", motivo: "YA_ESTA" });
  });
  it("con entrega pero sin etapa «Listo…» en el flujo → «Grabado»", () => {
    const sinListo = DNX.filter((e) => e.id !== "s4");
    expect(decidirConciliacion(sinListo, abierto("s1"), { grabado: true, listo: true })).toMatchObject({ tipo: "MOVER", etapa: { id: "s2" } });
  });
  it("entrega enviada pero con cassettes sin grabar: sólo «Grabado» si se cumple", () => {
    expect(decidirConciliacion(DNX, abierto("s1"), { grabado: false, listo: false })).toBeNull();
    expect(decidirConciliacion(DNX, abierto("s1"), { grabado: true, listo: false })).toMatchObject({ tipo: "MOVER", etapa: { id: "s2" } });
  });
  it("sin hechos: null; suspendido: no se toca", () => {
    expect(decidirConciliacion(DNX, abierto("s1"), { grabado: false, listo: false })).toBeNull();
    expect(decidirConciliacion(DNX, { etapaActualId: "s1", suspendido: true }, { grabado: true, listo: true })).toEqual({ tipo: "NADA", motivo: "SUSPENDIDO" });
  });
});
