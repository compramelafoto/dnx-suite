import { describe, expect, it } from "vitest";
import { avisoListoParaRetirar } from "./aviso-listo";

const base = {
  estudio: "DNX Estudio",
  nombre: "Mica",
  trabajo: "12 copias 10x15",
  saldoMinor: 1_800_000,
  transferencia: { alias: "dnx.estudio", cbuCvu: "0000003100012345678901", titular: "DNX Estudio", banco: "Mercado Pago" },
  direccion: "San Martín 1234, Funes",
  horario: "Lunes a viernes de 9 a 13 y de 16 a 20",
  contacto: "WhatsApp 341 341 9869",
  archivos: null,
};

describe("avisoListoParaRetirar", () => {
  it("dice qué está listo, el saldo y los datos para transferir", () => {
    const { subject, text } = avisoListoParaRetirar(base);
    expect(subject).toBe("Tu pedido está listo para retirar · DNX Estudio");
    expect(text).toContain("¡Hola Mica! Tu pedido (12 copias 10x15) ya está listo para retirar.");
    expect(text).toContain("Te queda por abonar $ 18.000.");
    expect(text).toContain("Alias: dnx.estudio");
    expect(text).toContain("Dirección: San Martín 1234, Funes");
  });

  it("si está pago, lo dice y no pide transferencia", () => {
    const { text } = avisoListoParaRetirar({ ...base, saldoMinor: 0 });
    expect(text).toContain("Ya está todo pago.");
    expect(text).not.toContain("Alias:");
  });

  it("con archivos, ofrece el enlace y hasta cuándo", () => {
    const { text, html } = avisoListoParaRetirar({ ...base, archivos: { url: "https://fotoffice.com/w/dnx/archivos/x", vence: "2026-11-17T12:00:00Z" } });
    expect(text).toContain("Descargalos antes del 17 de noviembre");
    expect(html).toContain('href="https://fotoffice.com/w/dnx/archivos/x"');
  });

  it("escapa lo que viene de la base", () => {
    expect(avisoListoParaRetirar({ ...base, trabajo: "<b>x</b>" }).html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
