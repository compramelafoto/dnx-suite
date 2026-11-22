import { describe, expect, it } from "vitest";
import { parsePrizeTemplates, winnerEmail } from "./mensajes";

describe("el correo al ganador", () => {
  it("dice qué ganó, cómo lo recibe y dónde verificarlo", () => {
    const m = winnerEmail({
      raffleId: "raf1",
      raffleTitle: "Sorteo de noviembre de 2026",
      winnerName: "Juana Pérez",
      prizeTitle: "Mochila <para> cámara",
      prizeDescription: null,
      sponsorName: "CompraMeLaFoto",
      deliveryInstructions: "Te la mandamos por correo.",
    });
    expect(m.subject).toBe("¡Ganaste en el Sorteo de noviembre de 2026!");
    expect(m.text).toContain("¡Hola, Juana!");
    expect(m.text).toContain("Te la mandamos por correo.");
    expect(m.text).toContain("https://www.compramelafoto.com/sorteos/raf1");
    expect(m.html).toContain("Mochila &lt;para&gt; cámara");
    expect(m.html).not.toContain("<para>");
  });
});

describe("los premios del sorteo mensual", () => {
  it("descarta lo que no sirve y limpia los valores", () => {
    const r = parsePrizeTemplates([
      { title: "  Kit de limpieza ", estimatedValueArs: "15000.4", sponsorName: "" },
      { title: "" },
      null,
      "x",
    ]);
    expect(r).toEqual([
      {
        title: "Kit de limpieza",
        description: null,
        conditions: null,
        sponsorName: null,
        deliveryInstructions: null,
        estimatedValueArs: 15000,
      },
    ]);
    expect(parsePrizeTemplates("no es lista")).toEqual([]);
  });
});
