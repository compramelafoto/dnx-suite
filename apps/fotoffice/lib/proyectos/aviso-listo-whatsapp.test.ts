import { describe, expect, it } from "vitest";
import { botonDelPedido, plantillaListo, textoListoWhatsapp } from "./aviso-listo-whatsapp";

const base = { nombre: "Lucía", trabajo: "Fotolibro 20x30", numeroPedido: "2026-0042", saldoMinor: 0, urlPago: null, horario: null };

describe("textoListoWhatsapp", () => {
  it("sin saldo: corto, sin hablar de pagos", () => {
    const t = textoListoWhatsapp(base);
    expect(t).toContain("¡Hola Lucía!");
    expect(t).toContain("Fotolibro 20x30");
    expect(t).toContain("listo para retirar");
    expect(t).not.toMatch(/saldo/i);
  });
  it("con saldo y enlace: dice cuánto y dónde pagarlo", () => {
    const t = textoListoWhatsapp({ ...base, saldoMinor: 750_000, urlPago: "https://fotoffice.com/w/dnx/pedido/abc", horario: "de 14 a 19 h" });
    expect(t).toMatch(/saldo de \$\s7\.500/);
    expect(t).toContain("https://fotoffice.com/w/dnx/pedido/abc");
    expect(t).toContain("de 14 a 19 h");
  });
  it("con saldo y alias del estudio: ofrece transferir y mandar el comprobante, sin link", () => {
    const t = textoListoWhatsapp({ ...base, saldoMinor: 750_000, urlPago: "https://fotoffice.com/w/dnx/pedido/abc", transferencia: { alias: "estudio.mp", cbuCvu: null } });
    expect(t).toMatch(/saldo de \$\s7\.500/);
    expect(t).toContain("al alias estudio.mp");
    expect(t).toContain("comprobante");
    expect(t).not.toContain("https://");
  });
  it("entrega digital: suma el enlace de los archivos", () => {
    expect(textoListoWhatsapp({ ...base, urlArchivos: "https://fotoffice.com/c/x" })).toContain("https://fotoffice.com/c/x");
  });
  it("sin nombre no queda «¡Hola !»", () => {
    expect(textoListoWhatsapp({ ...base, nombre: "" })).toMatch(/^¡Hola!/);
  });
});

describe("plantillaListo", () => {
  it("sin saldo: pedido_listo con nombre y número", () => {
    expect(plantillaListo(base, null)).toEqual({ nombre: "pedido_listo", idioma: "es_AR", cuerpo: ["Lucía", "2026-0042"] });
  });
  it("con saldo y botón: pedido_listo_con_saldo con el importe y la ruta", () => {
    expect(plantillaListo({ ...base, saldoMinor: 750_000 }, "w/dnx/pedido/abc")).toEqual({
      nombre: "pedido_listo_con_saldo", idioma: "es_AR", cuerpo: ["Lucía", "2026-0042", expect.stringMatching(/^\$\s7\.500$/)], boton: "w/dnx/pedido/abc",
    });
  });
  it("con saldo pero sin botón: cae en pedido_listo (Meta exige el botón)", () => {
    expect(plantillaListo({ ...base, saldoMinor: 750_000 }, null).nombre).toBe("pedido_listo");
  });
  it("sin nombre ni número usa reemplazos que leen bien", () => {
    expect(plantillaListo({ ...base, nombre: "", numeroPedido: null }, null).cuerpo).toEqual(["¡hola", "Fotolibro 20x30"]);
  });
});

describe("botonDelPedido", () => {
  it("dirección de FOTOFFICE: lo que va después del dominio", () => {
    expect(botonDelPedido("https://fotoffice.com/w/dnx-estudio/pedido/abc", "dnx-estudio")).toBe("w/dnx-estudio/pedido/abc");
  });
  it("dominio propio: la arma con el slug sobre FOTOFFICE", () => {
    expect(botonDelPedido("https://dnxestudio.com/pedido/abc", "dnx-estudio")).toBe("w/dnx-estudio/pedido/abc");
  });
  it("sin slug con dominio propio, o dirección rara: null", () => {
    expect(botonDelPedido("https://dnxestudio.com/pedido/abc", null)).toBeNull();
    expect(botonDelPedido("no es url", "x")).toBeNull();
  });
});

import { resumenDelAviso } from "./aviso-listo-whatsapp";

describe("resumenDelAviso", () => {
  it("dice por dónde salió", () => {
    expect(resumenDelAviso("ana@x.com", true)).toBe("Se le avisó por correo a ana@x.com y por WhatsApp.");
    expect(resumenDelAviso("ana@x.com", false)).toBe("Se le avisó por correo a ana@x.com.");
    expect(resumenDelAviso(null, true)).toBe("Se le avisó por WhatsApp.");
  });
});
