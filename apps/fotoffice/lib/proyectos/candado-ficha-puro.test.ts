import { describe, expect, it } from "vitest";
import { candadoDeLaFicha } from "./candado-ficha-puro";

const etapas = [
  { id: "e1", name: "Recibido", color: "gris", order: 0, archivada: false },
  { id: "e2", name: "En preparación", color: "azul", order: 1, archivada: false },
  { id: "e3", name: "Listo para retirar", color: "amarillo", order: 2, archivada: false },
  { id: "e4", name: "Entregado", color: "verde", order: 3, archivada: false },
];

describe("candadoDeLaFicha", () => {
  it("sin pedido o sin deuda no hay candado", () => {
    expect(candadoDeLaFicha({ pedido: null, etapas, etapaActualId: "e3" })).toBeNull();
    expect(candadoDeLaFicha({ pedido: { numero: "P-1", saldoMinor: 0 }, etapas, etapaActualId: "e3" })).toBeNull();
  });

  it("listo para retirar con deuda: retenido y la entrega bloqueada con el mensaje del candado", () => {
    expect(candadoDeLaFicha({ pedido: { numero: "P-1", saldoMinor: 500000 }, etapas, etapaActualId: "e3" })).toEqual({
      mensaje: "El pedido P-1 debe $ 5.000. Cobrá el saldo antes de entregar.",
      etiqueta: "Retenido · debe $ 5.000",
      etapasBloqueadas: ["e4"],
    });
  });

  it("antes de estar listo dice sólo cuánto debe, y la entrega igual queda bloqueada", () => {
    const c = candadoDeLaFicha({ pedido: { numero: "P-1", saldoMinor: 500050 }, etapas, etapaActualId: "e1" });
    expect(c?.etiqueta).toBe("Debe $ 5.000,50");
    expect(c?.etapasBloqueadas).toEqual(["e4"]);
  });

  it("en un flujo armado a mano, la última etapa (sin fase LISTO) es la de entrega; las archivadas no cuentan", () => {
    const aMano = [
      { id: "a", name: "Toma", color: "gris", order: 0, archivada: false },
      { id: "b", name: "Edición", color: "gris", order: 1, archivada: false },
      { id: "c", name: "Vieja", color: "gris", order: 2, archivada: true },
    ];
    expect(candadoDeLaFicha({ pedido: { numero: "P-2", saldoMinor: 100 }, etapas: aMano, etapaActualId: "a" })?.etapasBloqueadas).toEqual(["b"]);
  });
});
