import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canTransition,
  capabilityFor,
  checkTransition,
  FULFILLMENT_STATES,
  isTerminal,
  shouldNotifyMember,
  stateLabel,
  type FulfillmentCapability,
  type FulfillmentState,
} from "./fulfillment";

const TODO: FulfillmentCapability[] = ["PRODUCIR", "ENTREGAR", "ADMINISTRAR"];

describe("recorrido normal", () => {
  it("del pedido a las manos del socio, paso por paso", () => {
    const camino: FulfillmentState[] = [
      "PENDIENTE_PAGO",
      "EN_COLA",
      "IMPRESO",
      "LISTO_PARA_RETIRAR",
      "ENTREGADO",
    ];
    for (let i = 0; i < camino.length - 1; i++) {
      expect(canTransition(camino[i]!, camino[i + 1]!)).toBe(true);
    }
  });

  it("el que se manda por correo también llega", () => {
    expect(canTransition("IMPRESO", "ENVIADO")).toBe(true);
    expect(canTransition("ENVIADO", "ENTREGADO")).toBe(true);
  });

  it("al socio que no vino a retirarlo se le puede mandar", () => {
    expect(canTransition("LISTO_PARA_RETIRAR", "ENVIADO")).toBe(true);
  });
});

describe("lo que no se puede saltear", () => {
  it("no se entrega algo que no se imprimió", () => {
    expect(canTransition("EN_COLA", "ENTREGADO")).toBe(false);
    expect(canTransition("PENDIENTE_PAGO", "IMPRESO")).toBe(false);
  });

  it("no se imprime algo que no se pagó", () => {
    expect(canTransition("PENDIENTE_PAGO", "EN_COLA")).toBe(true);
    expect(canTransition("PENDIENTE_PAGO", "ENVIADO")).toBe(false);
  });

  it("un carnet entregado no vuelve para atrás", () => {
    // Si hay que rehacerlo se anula y se emite otro: retroceder dejaría de contar lo que
    // realmente pasó.
    expect(canTransition("ENTREGADO", "IMPRESO")).toBe(false);
    expect(canTransition("ENTREGADO", "LISTO_PARA_RETIRAR")).toBe(false);
    expect(allowedTransitions("ENTREGADO")).toEqual(["ANULADO"]);
  });

  it("de un anulado no se sale", () => {
    expect(isTerminal("ANULADO")).toBe(true);
    expect(allowedTransitions("ANULADO")).toEqual([]);
  });

  it("ningún estado permite volver a sí mismo", () => {
    for (const estado of FULFILLMENT_STATES) {
      expect(canTransition(estado, estado)).toBe(false);
    }
  });
});

describe("permisos", () => {
  it("el impresor puede imprimir pero no entregar", () => {
    const impresor: FulfillmentCapability[] = ["PRODUCIR"];
    expect(checkTransition({ from: "EN_COLA", to: "IMPRESO", capabilities: impresor }).ok).toBe(true);
    const entregar = checkTransition({
      from: "IMPRESO",
      to: "LISTO_PARA_RETIRAR",
      capabilities: impresor,
    });
    expect(entregar.ok).toBe(false);
    if (entregar.ok) return;
    expect(entregar.code).toBe("NO_PERMISSION");
  });

  it("el impresor no puede anular un pedido pago", () => {
    const r = checkTransition({
      from: "EN_COLA",
      to: "ANULADO",
      capabilities: ["PRODUCIR"],
      note: "salió mal",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("NO_PERMISSION");
  });

  it("quien administra puede todo", () => {
    expect(capabilityFor("ANULADO")).toBe("ADMINISTRAR");
    expect(
      checkTransition({ from: "IMPRESO", to: "ANULADO", capabilities: TODO, note: "se dañó" }).ok,
    ).toBe(true);
  });
});

describe("lo que exige explicación", () => {
  it("anular sin motivo no se puede", () => {
    const r = checkTransition({ from: "EN_COLA", to: "ANULADO", capabilities: TODO });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("NOTE_REQUIRED");
  });

  it("despachar sin decir cómo tampoco", () => {
    const r = checkTransition({ from: "IMPRESO", to: "ENVIADO", capabilities: TODO, note: "  " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("NOTE_REQUIRED");
  });

  it("marcar como impreso no necesita explicación", () => {
    expect(checkTransition({ from: "EN_COLA", to: "IMPRESO", capabilities: TODO }).ok).toBe(true);
  });
});

describe("avisos al socio", () => {
  it("se le avisa cuando puede retirarlo, cuando se despachó y cuando lo recibió", () => {
    expect(shouldNotifyMember("LISTO_PARA_RETIRAR")).toBe(true);
    expect(shouldNotifyMember("ENVIADO")).toBe(true);
    expect(shouldNotifyMember("ENTREGADO")).toBe(true);
  });

  it("no se le avisa de los pasos internos", () => {
    // Que entre en la cola de impresión no le cambia nada al socio.
    expect(shouldNotifyMember("EN_COLA")).toBe(false);
    expect(shouldNotifyMember("IMPRESO")).toBe(false);
  });
});

describe("etiquetas", () => {
  it("todos los estados tienen un nombre para una persona", () => {
    for (const estado of FULFILLMENT_STATES) {
      const etiqueta = stateLabel(estado);
      expect(etiqueta.length).toBeGreaterThan(3);
      expect(etiqueta).not.toMatch(/_/);
    }
  });
});
