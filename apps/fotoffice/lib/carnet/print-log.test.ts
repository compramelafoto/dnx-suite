import { describe, expect, it } from "vitest";
import { buildPdfDownloadEvent, isPdfDownloadEvent, PDF_DOWNLOAD_NOTE } from "./print-log";

/**
 * Quién bajó el PDF que se mandó a la imprenta.
 *
 * Era el agujero del registro: el estado guardaba quién marcó «impreso», pero bajar el
 * archivo —que es el acto que efectivamente manda a imprimir— no dejaba rastro. Alguien
 * descargaba la credencial de un socio con su foto y sus datos y no quedaba nada.
 */

describe("buildPdfDownloadEvent", () => {
  it("registra la descarga sin mover el carnet de estado", () => {
    // Bajar el PDF no es un paso del recorrido: el carnet sigue donde estaba. Se anota como
    // un hecho con el mismo origen y destino, que es lo que lo distingue de una transición.
    const e = buildPdfDownloadEvent({
      cardId: "card-1",
      state: "EN_COLA",
      actorUserId: 7,
      actorLabel: "Ana Pérez",
    });

    expect(e.cardId).toBe("card-1");
    expect(e.fromState).toBe("EN_COLA");
    expect(e.toState).toBe("EN_COLA");
    expect(e.actorUserId).toBe(7);
    expect(e.actorLabel).toBe("Ana Pérez");
    expect(e.note).toBe(PDF_DOWNLOAD_NOTE);
  });
});

describe("isPdfDownloadEvent", () => {
  it("reconoce la descarga en el historial", () => {
    expect(
      isPdfDownloadEvent({ fromState: "EN_COLA", toState: "EN_COLA", note: PDF_DOWNLOAD_NOTE }),
    ).toBe(true);
  });

  it("no confunde un paso del recorrido con una descarga", () => {
    expect(
      isPdfDownloadEvent({ fromState: "EN_COLA", toState: "IMPRESO", note: null }),
    ).toBe(false);
    expect(
      isPdfDownloadEvent({ fromState: null, toState: "PENDIENTE_PAGO", note: null }),
    ).toBe(false);
  });
})
