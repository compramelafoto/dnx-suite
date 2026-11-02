import { describe, expect, it } from "vitest";
import { emitDesign } from "@repo/design-studio";
import { diplomaDesignDocument, nombreDeArchivo } from "./diploma";
import { EVENTO_VARIABLES } from "./diploma-variables";
import { pruneEmptyBlocks } from "@/lib/placas/prune";

describe("diploma de evento", () => {
  it("el diseño inicial se dibuja en PDF con los datos del inscripto", async () => {
    const values = {
      attendeeName: "José Pérez",
      eventName: "Rafaela en Foco 2026",
      eventDate: "1 y 2 de noviembre de 2026",
      eventPlace: "Centro Cultural Viejo Mercado, Rafaela",
      ticketType: "General",
      attendeeCode: "AB7K2M",
      institutionName: "Rafaela en Foco",
      institutionLogo: null,
    };
    // Como en la emisión real: sin logo, su bloque se saca en vez de fallar.
    const { document, removed } = pruneEmptyBlocks(diplomaDesignDocument(), values);
    expect(removed).toEqual(["logo"]);
    const r = await emitDesign({
      document,
      contract: {
        variables: [
          ...EVENTO_VARIABLES,
          { key: "institutionName", type: "text", label: "Institución", required: false, sampleValue: "x" },
          { key: "institutionLogo", type: "image", label: "Logo", required: false, sampleValue: "x" },
        ],
      },
      values,
      formats: ["PDF"],
      includeBleed: false,
      resources: { read: async () => null },
      fileBaseName: "diploma-prueba",
    });
    if (!r.ok) throw new Error(r.errors.join(" | "));
    const pdf = r.files.find((f) => f.contentType === "application/pdf");
    expect(pdf?.bytes.byteLength).toBeGreaterThan(1000);
  });

  it("nombre de archivo sin tildes ni símbolos", () => {
    expect(nombreDeArchivo("diploma", "Rafaela en Foco 2026", "José Pérez")).toBe("diploma-rafaela-en-foco-2026-jose-perez.pdf");
  });
});
