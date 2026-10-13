import { describe, expect, it } from "vitest";
import { cifrasDelTexto, cifrasNoRespaldadas, cifrasPermitidas, textosDelTurno } from "./cifras";

describe("cifrasDelTexto", () => {
  it("saca importes y porcentajes, normalizados", () => {
    expect(cifrasDelTexto("Te recomiendo $1.294.000, mínimo $ 890.000 y ganás 24 % (o 24,5%).")).toEqual(["$1294000", "$890000", "24%", "24.5%"]);
  });
  it("reconoce montos con separador de miles aunque no tengan $, y los 'pesos'", () => {
    expect(cifrasDelTexto("unos 1.100.000 o 450000 pesos")).toEqual(["$1100000", "$450000"]);
  });
  it("ignora números que no son plata ni porcentaje (horas, números de consulta, años)", () => {
    expect(cifrasDelTexto("8 horas, consulta N.º 12, en 2026, 45 h por semana")).toEqual([]);
  });
  it("el $ con espacio duro de Intl también cuenta", () => {
    expect(cifrasDelTexto("Valor hora: $ 31.250")).toEqual(["$31250"]);
  });
});

describe("cifrasPermitidas y cifrasNoRespaldadas", () => {
  it("lo que dijo la persona respalda la cifra: '450 lucas', '80 mil', '350k', '600000'", () => {
    const ok = cifrasPermitidas(["Pago 450 lucas de alquiler, 80 mil de expensas, 350k de súper y gano 600000"]);
    expect(cifrasNoRespaldadas("Anoto $450.000, $80.000, $350.000 y $600.000.", ok)).toEqual([]);
  });
  it("lo que devolvió una herramienta respalda la cifra", () => {
    const ok = cifrasPermitidas(['{"resumen":{"valorHora":"$ 31.250","gananciaPct":"24 %"}}']);
    expect(cifrasNoRespaldadas("Tu valor hora da $31.250 y ganás 24%.", ok)).toEqual([]);
  });
  it("una cifra inventada aparece", () => {
    const ok = cifrasPermitidas(['{"valorHora":"$ 31.250"}', "quiero armar mi perfil"]);
    expect(cifrasNoRespaldadas("Tu valor hora da $31.250; la mayoría cobra $25.000 y un 30 % más.", ok)).toEqual(["$25000", "30%"]);
  });
});

describe("textosDelTurno", () => {
  it("junta los mensajes de la persona y los resultados de herramientas, no lo que escribió el modelo", () => {
    const t = textosDelTurno([
      { role: "user", content: "gano 600000" },
      { role: "assistant", content: [{ type: "text", text: "inventé $999.999" }, { type: "tool_use", id: "t1", name: "x", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: '{"a":"$ 31.250"}' }] },
    ]);
    expect(t).toEqual(["gano 600000", '{"a":"$ 31.250"}']);
  });
});
