import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { emitDesign } from "@repo/design-studio";
import { pruneEmptyBlocks } from "@/lib/placas/prune";
import { EVENTO_VARIABLES } from "./diploma-variables";
import { placaEventoDesignDocument, PLACA_EVENTO_DPI } from "./placa-diseno";

const CONTRATO = {
  variables: [
    ...EVENTO_VARIABLES,
    { key: "institutionName", type: "text" as const, label: "Institución", required: false, sampleValue: "x" },
    { key: "institutionLogo", type: "image" as const, label: "Logo", required: false, sampleValue: "x" },
  ],
};

const base = {
  attendeeName: "María Gómez",
  eventName: "Rafaela en Foco 2027",
  eventDate: "6 y 7 de noviembre de 2027",
  eventPlace: null,
  ticketType: "Preventa",
  attendeeCode: "AB7K2M",
  attendeeInstagram: "@maria.gomez",
  institutionName: "Rafaela en Foco",
  institutionLogo: null,
};

async function dibujar(values: Record<string, string | null>, foto: Uint8Array | null) {
  const { document, removed } = pruneEmptyBlocks(placaEventoDesignDocument(), values);
  const r = await emitDesign({
    document,
    contract: CONTRATO,
    values,
    formats: ["PNG_PER_SIDE"],
    pngDpi: PLACA_EVENTO_DPI,
    includeBleed: false,
    resources: { read: async (ref) => (ref === "foto.jpg" ? foto : null) },
    fileBaseName: "placa-prueba",
  });
  if (!r.ok) throw new Error(r.errors.join(" | "));
  const png = r.files.find((f) => f.contentType === "image/png");
  return { png: png!.bytes, removed };
}

describe("placa de bienvenida de evento", () => {
  it("sale cuadrada de 1080 px con la foto del inscripto", async () => {
    const foto = new Uint8Array(await sharp({ create: { width: 800, height: 800, channels: 3, background: "#3366aa" } }).jpeg().toBuffer());
    const { png, removed } = await dibujar({ ...base, attendeePhoto: "foto.jpg" }, foto);
    expect(removed).toEqual(["logo"]);
    const meta = await sharp(Buffer.from(png)).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1080]);
  });

  it("sin foto ni Instagram la placa igual sale: la foto se poda y el texto queda vacío", async () => {
    const { png, removed } = await dibujar({ ...base, attendeePhoto: null, attendeeInstagram: null }, null);
    expect(removed.sort()).toEqual(["foto", "logo"]);
    expect(png.byteLength).toBeGreaterThan(1000);
  });
});
