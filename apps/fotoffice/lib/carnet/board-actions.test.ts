import { describe, expect, it } from "vitest";
import {
  canDownloadPdf,
  commonTransitions,
  groupStates,
  STATE_GROUPS,
  tiempoRelativo,
  transitionActionLabel,
} from "./board-actions";
import type { FulfillmentCapability, FulfillmentState } from "./fulfillment";

const TODO: FulfillmentCapability[] = ["PRODUCIR", "ENTREGAR", "ADMINISTRAR"];

/**
 * Lo que el tablero puede ofrecer sobre varios carnets a la vez.
 *
 * Existe porque la Secretaría no imprime de a uno: llega una tanda de cuarenta y los marca
 * juntos. Pero un lote NO puede saltearse las reglas de a una: si un carnet del montón no
 * admite ese paso, el paso no se ofrece.
 */

describe("commonTransitions", () => {
  it("ofrece el paso que sirve para todos los seleccionados", () => {
    const r = commonTransitions(["EN_COLA", "EN_COLA"], TODO);
    expect(r).toContain("IMPRESO");
  });

  it("no ofrece un paso que uno solo del lote no admite", () => {
    // Marcar «impreso» treinta y nueve carnets y fallar en el cuarenta dejaría la tanda a
    // medias sin que nadie sepa cuál quedó afuera.
    const r = commonTransitions(["EN_COLA", "IMPRESO"], TODO);
    expect(r).not.toContain("IMPRESO");
    expect(r).not.toContain("LISTO_PARA_RETIRAR");
  });

  it("respeta los permisos de quien está mirando", () => {
    const impresor: FulfillmentCapability[] = ["PRODUCIR"];
    expect(commonTransitions(["EN_COLA"], impresor)).toEqual(["IMPRESO"]);
    // Anular pide ADMINISTRAR: el impresor no puede dar de baja pedidos ni de a uno ni en lote.
    expect(commonTransitions(["EN_COLA"], impresor)).not.toContain("ANULADO");
  });

  it("sin selección no ofrece nada", () => {
    expect(commonTransitions([], TODO)).toEqual([]);
  });
});

describe("canDownloadPdf", () => {
  it("no se imprime un pedido dado de baja", () => {
    expect(canDownloadPdf("ANULADO")).toBe(false);
  });

  it("no se imprime lo que el socio no pagó", () => {
    expect(canDownloadPdf("PENDIENTE_PAGO")).toBe(false);
  });

  it("se imprime desde que entra a la cola y después, para reimprimir un dañado", () => {
    expect(canDownloadPdf("EN_COLA")).toBe(true);
    expect(canDownloadPdf("IMPRESO")).toBe(true);
    expect(canDownloadPdf("ENTREGADO")).toBe(true);
  });
});

describe("agrupación de estados", () => {
  it("cada estado cae en un grupo y en uno solo", () => {
    const estados: FulfillmentState[] = [
      "PENDIENTE_PAGO",
      "EN_COLA",
      "IMPRESO",
      "LISTO_PARA_RETIRAR",
      "ENVIADO",
      "ENTREGADO",
      "ANULADO",
    ];
    for (const estado of estados) {
      const grupos = STATE_GROUPS.filter((g) => g.states.includes(estado));
      expect(grupos).toHaveLength(1);
    }
  });

  it("los grupos hablan de trabajo pendiente, no de nombres internos", () => {
    // El impresor entra a ver «Para imprimir», no a traducir siete estados.
    expect(groupStates("para-imprimir")).toEqual(["EN_COLA"]);
    expect(groupStates("por-cobrar")).toEqual(["PENDIENTE_PAGO"]);
    expect(groupStates("para-entregar")).toEqual(["IMPRESO", "LISTO_PARA_RETIRAR", "ENVIADO"]);
    expect(groupStates("cerrados")).toEqual(["ENTREGADO", "ANULADO"]);
    expect(groupStates("cualquier-cosa")).toBeNull();
  });
});

describe("transitionActionLabel", () => {
  it("nombra el botón por lo que hace, no por el estado al que lleva", () => {
    // El botón decía «Impreso», que es un estado. Quien lo mira tiene que deducir que
    // apretarlo significa marcarlo como impreso. Un botón dice lo que hace.
    expect(transitionActionLabel("IMPRESO")).toBe("Marcar impreso");
    expect(transitionActionLabel("LISTO_PARA_RETIRAR")).toBe("Listo para retirar");
    expect(transitionActionLabel("ENVIADO")).toBe("Registrar envío");
    expect(transitionActionLabel("ENTREGADO")).toBe("Marcar entregado");
    expect(transitionActionLabel("ANULADO")).toBe("Anular pedido");
  });
});

describe("tiempoRelativo", () => {
  const ahora = new Date("2026-09-07T12:00:00Z");

  it("dice cuánto hace que espera, que es lo que ordena el trabajo", () => {
    expect(tiempoRelativo(new Date("2026-09-07T11:58:00Z"), ahora)).toBe("recién");
    expect(tiempoRelativo(new Date("2026-09-07T10:00:00Z"), ahora)).toBe("hace 2 h");
    expect(tiempoRelativo(new Date("2026-09-04T12:00:00Z"), ahora)).toBe("hace 3 días");
    expect(tiempoRelativo(new Date("2026-09-06T12:00:00Z"), ahora)).toBe("hace 1 día");
  });

  it("pasado el mes deja de contar días y da la fecha", () => {
    // «hace 214 días» no le sirve a nadie; la fecha sí.
    expect(tiempoRelativo(new Date("2026-01-15T12:00:00Z"), ahora)).toBe("15/01/2026");
  });
});
