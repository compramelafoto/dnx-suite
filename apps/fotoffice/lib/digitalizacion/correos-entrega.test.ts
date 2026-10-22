import { describe, expect, it } from "vitest";
import { correoRecordatorioVideos, correoVideosListos, type DatosVideosListos } from "./correos-entrega";

const base: DatosVideosListos = {
  estudio: "Foto Positiva",
  nombre: "Ana",
  pedidoNumero: "P-12",
  videos: [{ titulo: "Casamiento 1998", duracionSeg: 7500 }, { titulo: "Cassette 2", duracionSeg: 1800 }],
  saldoMinor: 1500000,
  urlPedido: "https://fotoffice.com/w/fp/pedido/abc",
  urlVideos: "https://fotoffice.com/w/fp/videos/xyz",
  // 21/11 23:30 de Argentina.
  videosVencenAt: new Date("2026-11-22T02:30:00Z"),
  cassettesVencenAt: new Date("2026-11-22T02:30:00Z"),
  contacto: "WhatsApp 341 555-0000",
};

describe("correoVideosListos", () => {
  it("lleva los videos con su duración, el saldo, los enlaces, el cupo y las fechas", () => {
    const c = correoVideosListos(base);
    expect(c.subject).toBe("Tus videos están listos · Foto Positiva");
    expect(c.text).toContain("tus 2 videos del pedido N° P-12");
    expect(c.text).toContain("• Casamiento 1998 (2 h 05 min)");
    expect(c.text).toContain("• Cassette 2 (30 min)");
    expect(c.text).toContain("15.000 pesos");
    expect(c.text).toContain("Pagar el saldo: https://fotoffice.com/w/fp/pedido/abc");
    expect(c.text).toContain("Ver mis videos: https://fotoffice.com/w/fp/videos/xyz");
    expect(c.text).toContain("3 descargas por video");
    expect(c.text).toContain("disponibles hasta el 21/11/2026");
    expect(c.text).toContain("Retirá tus cassettes antes del 21/11/2026");
    expect(c.text).not.toContain("$");
    expect(c.html).toContain('href="https://fotoffice.com/w/fp/videos/xyz"');
  });
  it("sin saldo no habla de pagar", () => {
    const c = correoVideosListos({ ...base, saldoMinor: 0 });
    expect(c.text).not.toContain("Pagar el saldo");
    expect(c.text).not.toContain("pesos");
  });
  it("un solo video, en singular", () => {
    const c = correoVideosListos({ ...base, videos: [base.videos[0]!] });
    expect(c.subject).toBe("Tu video está listo · Foto Positiva");
    expect(c.text).toContain("Ver mi video:");
  });
  it("escapa el HTML de lo que escribe la gente", () => {
    const c = correoVideosListos({ ...base, videos: [{ titulo: "<b>Hola</b>", duracionSeg: null }] });
    expect(c.html).toContain("&lt;b&gt;Hola&lt;/b&gt;");
    expect(c.html).not.toContain("<b>Hola</b>");
  });
});

describe("correoRecordatorioVideos", () => {
  it("dice cuándo se borran", () => {
    const c = correoRecordatorioVideos({ estudio: "FP", nombre: "", pedidoNumero: "P-1", urlVideos: "https://x/videos/t", videosVencenAt: base.videosVencenAt, dias: 5, contacto: null });
    expect(c.subject).toBe("Tus videos se borran el 21/11 · FP");
    expect(c.text).toContain("¡Hola!");
    expect(c.text).toContain("se borran en 5 días, el 21/11/2026");
    expect(c.text).toContain("Ver mis videos: https://x/videos/t");
  });
});
