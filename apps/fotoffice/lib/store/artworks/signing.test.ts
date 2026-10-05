import { describe, expect, it } from "vitest";
import { signEntryImageUrl, verifyEntryImageSignature } from "./signing";

const SECRET = "secreto-fijo-de-prueba";
const VECTOR_SIG = "uzZ1806XQaqDuSzA1rnOhx8tfbUjNCd35GQxLFe7p6Q";
const EXP = 1800000000;

describe("firma de imágenes de obras", () => {
  it("vector fijo (idéntico en FotoRank)", () => {
    const url = signEntryImageUrl({
      baseUrl: "https://fotorank.com/",
      entryId: "entry-123",
      variant: "preview",
      expiresAt: new Date(EXP * 1000),
      secret: SECRET,
      wm: "Daniel Cuart",
    });
    expect(url).toBe(
      `https://fotorank.com/api/fotorank/external/entry-image?entryId=entry-123&variant=preview&exp=${EXP}&wm=Daniel%20Cuart&sig=${VECTOR_SIG}`,
    );
  });
  const base = { entryId: "entry-123", variant: "preview", exp: EXP, wm: "Daniel Cuart", sig: VECTOR_SIG };
  const antes = new Date((EXP - 10) * 1000);
  it("acepta la firma buena", () => {
    expect(verifyEntryImageSignature(base, SECRET, antes)).toEqual({ ok: true });
  });
  it("rechaza si cambia cualquier dato firmado", () => {
    for (const cambio of [{ entryId: "otra" }, { variant: "original" }, { exp: EXP + 1 }, { wm: "otro" }, { wm: "" }]) {
      expect(verifyEntryImageSignature({ ...base, ...cambio }, SECRET, antes)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
    }
    expect(verifyEntryImageSignature(base, "otro-secreto", antes)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });
  it("vencida", () => {
    expect(verifyEntryImageSignature(base, SECRET, new Date((EXP + 1) * 1000))).toEqual({ ok: false, reason: "EXPIRED" });
  });
  it("parámetros malos", () => {
    expect(verifyEntryImageSignature(base, "", antes)).toEqual({ ok: false, reason: "BAD_PARAMS" });
    expect(verifyEntryImageSignature({ ...base, variant: "x" }, SECRET, antes)).toEqual({ ok: false, reason: "BAD_PARAMS" });
    expect(verifyEntryImageSignature({ ...base, exp: Number.NaN }, SECRET, antes)).toEqual({ ok: false, reason: "BAD_PARAMS" });
    expect(verifyEntryImageSignature({ ...base, sig: "" }, SECRET, antes)).toEqual({ ok: false, reason: "BAD_PARAMS" });
    expect(verifyEntryImageSignature({ ...base, sig: "corta" }, SECRET, antes)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });
});
