import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La burbuja de FOTOFFICE usa la misma mascota que CLF (la animación de la foto) y sin tickets. */
describe("burbuja de DNX Bot en FOTOFFICE", () => {
  const raiz = join(__dirname, "../..");
  const clf = join(raiz, "../compramelafoto/public/dnx-bot");
  it("monta la mascota quieta y la tira animada, sin tickets", () => {
    const src = readFileSync(join(__dirname, "burbuja.tsx"), "utf8");
    expect(src).toContain('mascotSrc="/dnx-bot/mascota.webp"');
    expect(src).toContain('mascotSpriteSrc="/dnx-bot/mascota-foto.webp"');
    expect(src).toContain("conTickets={false}");
  });
  it("los archivos son los mismos que los de CLF", () => {
    for (const f of ["mascota.webp", "mascota-foto.webp"]) {
      expect(readFileSync(join(raiz, "public/dnx-bot", f)).equals(readFileSync(join(clf, f))), f).toBe(true);
    }
  });
});
