import { describe, expect, it } from "vitest";
import { correoParaProveedor } from "./correo-proveedor";

const base = {
  estudio: "DNX Estudio",
  proveedor: "Fotolag",
  numeroTrabajo: "PR-0042",
  producto: "Copias 10x15 próxima semana",
  cantidad: 12,
  cliente: "Mica",
  entregaDeseada: "2026-10-25",
  notas: "Mate. Cortar polaroid.",
  enlaceArchivos: null,
};

describe("correoParaProveedor", () => {
  it("el asunto dice el pedido, el estudio y qué es", () => {
    expect(correoParaProveedor(base).subject).toBe("Pedido PR-0042 de DNX Estudio: 12 × Copias 10x15 próxima semana");
  });

  it("el texto lleva la fecha argentina y las indicaciones", () => {
    const { text } = correoParaProveedor(base);
    expect(text).toContain("Lo necesitamos para: 25/10/2026");
    expect(text).toContain("Indicaciones: Mate. Cortar polaroid.");
  });

  it("escapa lo que escribe el usuario en el HTML", () => {
    const { html } = correoParaProveedor({ ...base, notas: "<b>ojo</b>" });
    expect(html).toContain("&lt;b&gt;ojo&lt;/b&gt;");
  });

  it("con enlace de archivos, lo ofrece para descargar", () => {
    expect(correoParaProveedor({ ...base, enlaceArchivos: "https://fotoffice.com/x" }).html).toContain('href="https://fotoffice.com/x"');
  });
});
