import { describe, expect, it } from "vitest";
import { avisoPedidoRecibido } from "./aviso-pedido";

const base = {
  estudio: "DNX Estudio",
  nombre: "Ana",
  numero: "P-0012",
  items: [{ nombre: "Copias 10x15", cantidad: 30 }, { nombre: "Ampliación 30x40", cantidad: 1 }],
  totalMinor: 4500000,
  cobradoMinor: 2000000,
  entrega: "2026-10-23",
  etiquetaFecha: "Entrega",
  direccion: "San Martín 123",
  horario: "Lun a vie de 9 a 18",
  contacto: "WhatsApp 341 555 1234",
};

describe("avisoPedidoRecibido", () => {
  it("detalla ítems, seña, saldo, entrega y dónde retirar", () => {
    const c = avisoPedidoRecibido(base);
    expect(c.subject).toBe("Recibimos tu pedido P-0012 · DNX Estudio");
    expect(c.text).toContain("30 × Copias 10x15");
    expect(c.text).toContain("Ampliación 30x40");
    expect(c.text).not.toContain("1 × Ampliación");
    expect(c.text).toContain("Pagaste: $ 20.000");
    expect(c.text).toContain("Saldo a pagar al retirar: $ 25.000");
    expect(c.text).toContain("viernes, 23 de octubre");
    expect(c.text).toContain("Dirección: San Martín 123");
  });

  it("pagado entero y sin fecha", () => {
    const c = avisoPedidoRecibido({ ...base, cobradoMinor: 4500000, entrega: null, direccion: null, horario: null });
    expect(c.text).toContain("Ya está todo pago.");
    expect(c.text).not.toContain("Entrega:");
    expect(c.text).not.toContain("Dónde retirarlo");
  });

  it("con otra etiqueta no promete que esté listo", () => {
    const c = avisoPedidoRecibido({ ...base, etiquetaFecha: "Sesión" });
    expect(c.text).toContain("Sesión:");
    expect(c.text).not.toContain("Va a estar listo");
  });

  it("escapa el html", () => {
    const c = avisoPedidoRecibido({ ...base, items: [{ nombre: "<b>x</b>", cantidad: 1 }] });
    expect(c.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
