import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { invitacionImprimible } from "./pdf";

const MM = 72 / 25.4;
const jpg = () => sharp({ create: { width: 124, height: 175, channels: 3, background: "#1c2b35" } }).jpeg().toBuffer();

describe("invitacionImprimible", () => {
  it("A6: una página de 105 × 148 mm con la imagen embebida", async () => {
    const doc = await PDFDocument.load(await invitacionImprimible(await jpg(), "A6"));
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.abs(width - 105 * MM)).toBeLessThan(0.5);
    expect(Math.abs(height - 148 * MM)).toBeLessThan(0.5);
    expect(doc.getTitle()).toBe("Invitación a la inauguración");
    const recursos = doc.getPage(0).node.Resources()!.toString();
    expect(recursos).toContain("XObject");
  });
  it("A5: 148 × 210 mm", async () => {
    const doc = await PDFDocument.load(await invitacionImprimible(await jpg(), "A5"));
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.abs(width - 148 * MM)).toBeLessThan(0.5);
    expect(Math.abs(height - 210 * MM)).toBeLessThan(0.5);
  });
});
