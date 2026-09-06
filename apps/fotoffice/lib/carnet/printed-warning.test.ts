import { describe, expect, it } from "vitest";
import { printedCardWarning } from "./printed-warning";

const AHORA = new Date("2026-09-06T12:00:00Z");

describe("printedCardWarning", () => {
  it("al socio sin ninguna tarjeta registrada le recomienda revisar la vigencia de la que tenga en mano", () => {
    const aviso = printedCardWarning({ state: null, validUntil: null, now: AHORA });
    expect(aviso.kind).toBe("SIN_REGISTRO");
    expect(aviso.tone).toBe("warn");
    // El texto tiene que admitir que puede tener una credencial vieja: negarla sería falso.
    expect(aviso.body).toMatch(/vigencia/i);
  });

  it("avisa con la fecha cuando la tarjeta impresa venció", () => {
    const aviso = printedCardWarning({
      state: "ENTREGADO",
      validUntil: new Date("2025-03-31T00:00:00Z"),
      now: AHORA,
    });
    expect(aviso.kind).toBe("VENCIDA");
    expect(aviso.tone).toBe("warn");
    expect(aviso.body).toContain("31/03/2025");
    expect(aviso.actionLabel).toBe("Pedir renovación");
  });

  it("una tarjeta entregada y vigente no advierte nada, pero deja pedir otra", () => {
    // Se cambia de categoría, se muda o la pierde: el ofrecimiento no puede desaparecer.
    const aviso = printedCardWarning({
      state: "ENTREGADO",
      validUntil: new Date("2027-12-31T00:00:00Z"),
      now: AHORA,
    });
    expect(aviso.kind).toBe("VIGENTE");
    expect(aviso.tone).toBe("info");
    expect(aviso.actionLabel).toBe("Pedir otra tarjeta");
  });

  it("mientras la tarjeta está en camino no se le recomienda nada: ya la pidió", () => {
    for (const estado of ["PENDIENTE_PAGO", "EN_COLA", "IMPRESO", "LISTO_PARA_RETIRAR", "ENVIADO"] as const) {
      const aviso = printedCardWarning({
        state: estado,
        validUntil: new Date("2027-12-31T00:00:00Z"),
        now: AHORA,
      });
      expect(aviso.kind).toBe("EN_CURSO");
    }
  });

  it("una tarjeta anulada y no vencida se trata como si no hubiera: puede pedir otra", () => {
    const aviso = printedCardWarning({
      state: "ANULADO",
      validUntil: new Date("2027-12-31T00:00:00Z"),
      now: AHORA,
    });
    expect(aviso.kind).toBe("SIN_REGISTRO");
  });

  it("una tarjeta vencida se informa como vencida aunque el trámite haya quedado a medias", () => {
    // Un pedido de 2023 que nunca se pagó no puede bloquear a nadie para siempre.
    const aviso = printedCardWarning({
      state: "PENDIENTE_PAGO",
      validUntil: new Date("2023-06-30T00:00:00Z"),
      now: AHORA,
    });
    expect(aviso.kind).toBe("VENCIDA");
  });

  it("sin fecha de vigencia una tarjeta entregada no se declara vencida", () => {
    // No se puede probar que venció, así que no se lo afirma.
    const aviso = printedCardWarning({ state: "ENTREGADO", validUntil: null, now: AHORA });
    expect(aviso.kind).toBe("VIGENTE");
  });

  it("siempre dice algo: nunca deja la pantalla del carnet sin explicar el estado de la tarjeta", () => {
    const casos = [null, "ENTREGADO", "ANULADO", "EN_COLA"] as const;
    for (const estado of casos) {
      const aviso = printedCardWarning({ state: estado, validUntil: null, now: AHORA });
      expect(aviso.title.length).toBeGreaterThan(0);
      expect(aviso.body.length).toBeGreaterThan(0);
    }
  });
});
