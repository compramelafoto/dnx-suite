import { describe, expect, it } from "vitest";
import { parsePrizeTemplates, parseSponsors, safeUrl, sponsorLogos, winnerEmail } from "./mensajes";

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
        imageUrl: null,
        sponsorLogoUrl: null,
        sponsorUrl: null,
      },
    ]);
    expect(parsePrizeTemplates("no es lista")).toEqual([]);
  });
});

describe("imágenes y sponsors", () => {
  it("sólo acepta https y completa la dirección sin protocolo", () => {
    expect(safeUrl("instagram.com/marca")).toBe("https://instagram.com/marca");
    expect(safeUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
    expect(safeUrl("http://x.com/a.png")).toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(42)).toBeNull();
  });

  it("guarda la foto, el logo y el enlace del premio", () => {
    const [p] = parsePrizeTemplates([
      { title: "Mochila", imageUrl: "https://r2.x/p.jpg", sponsorLogoUrl: "javascript:x", sponsorUrl: "marca.com" },
    ]);
    expect(p.imageUrl).toBe("https://r2.x/p.jpg");
    expect(p.sponsorLogoUrl).toBeNull();
    expect(p.sponsorUrl).toBe("https://marca.com/");
  });

  it("los sponsors sin logo o repetidos se descartan", () => {
    const r = parseSponsors([
      { name: " Marca ", logoUrl: "https://r2.x/a.png", url: "marca.com" },
      { name: "Sin logo", logoUrl: "" },
      { name: "Repetido", logoUrl: "https://r2.x/a.png" },
      null,
    ]);
    expect(r).toEqual([{ name: "Marca", logoUrl: "https://r2.x/a.png", url: "https://marca.com/" }]);
    expect(parseSponsors({})).toEqual([]);
  });

  it("junta los logos del sorteo y los de los premios sin repetir", () => {
    const r = sponsorLogos(
      [{ name: "A", logoUrl: "https://r2.x/a.png", url: null }],
      [
        { sponsorLogoUrl: "https://r2.x/a.png", sponsorName: "A otra vez" },
        { sponsorLogoUrl: "https://r2.x/b.png", sponsorName: "B", sponsorUrl: "https://b.com" },
        { sponsorLogoUrl: null, sponsorName: "Sin logo" },
      ],
    );
    expect(r.map((l) => l.name)).toEqual(["A", "B"]);
    expect(r[1].url).toBe("https://b.com");
  });

  it("el correo muestra la foto del premio sólo si es https", () => {
    const base = {
      raffleId: "r",
      raffleTitle: "Sorteo",
      winnerName: null,
      prizeTitle: "Mochila",
      prizeDescription: null,
      sponsorName: null,
      deliveryInstructions: null,
    };
    expect(winnerEmail({ ...base, prizeImageUrl: "https://r2.x/p.jpg" }).html).toContain('<img src="https://r2.x/p.jpg"');
    expect(winnerEmail({ ...base, prizeImageUrl: "http://r2.x/p.jpg" }).html).not.toContain("<img");
  });
});
