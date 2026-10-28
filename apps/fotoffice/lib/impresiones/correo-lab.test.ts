import { describe, expect, it } from "vitest";
import { correoPedidoLab } from "./correo-lab";

const base = { estudio: "DNX Estudio", laboratorio: "Fotolag", numero: 12, cliente: "Juan Pérez", enlace: "https://x/archivos/t", vence: "2026-11-19", resumen: [{ tamano: "13x18", papel: "Brillo", cantidad: 4 }], prueba: false };

describe("correoPedidoLab", () => {
  it("asunto con PARA MAÑANA", () => {
    expect(correoPedidoLab(base).subject).toBe("Pedido 12 – PARA MAÑANA – Juan Pérez");
  });
  it("incluye enlace, total y tabla", () => {
    const c = correoPedidoLab(base);
    expect(c.text).toContain("https://x/archivos/t");
    expect(c.text).toContain("Total: 4 copias");
    expect(c.html).toContain("13x18");
  });
  it("en modo prueba lo avisa en el asunto", () => {
    expect(correoPedidoLab({ ...base, prueba: true }).subject.startsWith("[PRUEBA] ")).toBe(true);
  });
  it("junta espacios y saltos de línea del nombre en el asunto", () => {
    expect(correoPedidoLab({ ...base, cliente: "  Juan\n  Pérez\t " }).subject).toBe("Pedido 12 – PARA MAÑANA – Juan Pérez");
  });
  it("escapa HTML del nombre del cliente", () => {
    expect(correoPedidoLab({ ...base, cliente: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
});

describe("correoPedidoLab: pedidos del bot", () => {
  it("el asunto y el cuerpo dicen el plazo", () => {
    const c = correoPedidoLab({ ...base, plazo: "SEMANA" });
    expect(c.subject).toBe("Pedido 12 – PARA LA PRÓXIMA SEMANA – Juan Pérez");
    expect(c.text).toContain("para la PRÓXIMA SEMANA");
    expect(correoPedidoLab({ ...base, plazo: "MANANA" }).subject).toBe("Pedido 12 – PARA MAÑANA – Juan Pérez");
  });

  it("avisa las fotos de resolución baja y que el encuadre lo decide el laboratorio", () => {
    const c = correoPedidoLab({ ...base, calidadBaja: ["foto-2.jpg"], sinRecorte: true });
    expect(c.text).toContain("resolución baja: foto-2.jpg");
    expect(c.text).toContain("originales, sin recortar");
    expect(c.html).toContain("foto-2.jpg");
  });
});
