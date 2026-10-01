import { describe, expect, test } from "vitest";
import { correoParaElTitular, correoParaQuienPide } from "./aviso-arrepentimiento";

const DATOS = {
  constancia: "AR-4YP6T3",
  referencia: "ABC123",
  email: "ana@ejemplo.com",
  motivo: "Me arrepentí.",
};

describe("el correo a quien pide", () => {
  const c = correoParaQuienPide(DATOS);

  test("el asunto lleva la constancia: es lo que va a buscar después", () => {
    expect(c.asunto).toContain("AR-4YP6T3");
  });

  test("el cuerpo repite la constancia", () => {
    expect(c.texto).toContain("AR-4YP6T3");
  });

  test("dice el plazo en el que se le contesta", () => {
    expect(c.texto).toMatch(/24 horas/);
  });

  test("dice qué pidió, para que reconozca de qué se trata", () => {
    expect(c.texto).toContain("ABC123");
  });

  test("acá SÍ firmamos nosotros", () => {
    // Al revés que los avisos del evento: el arrepentimiento es contra la plataforma,
    // no contra el fotógrafo, y la persona tiene que saber con quién está hablando.
    expect(c.texto).toContain("SubiLaFoto");
  });

  test("no promete que ya está cancelado", () => {
    // Recibir la solicitud no es resolverla. Decir "cancelado" acá sería mentir.
    expect(c.texto).not.toMatch(/ya (está|fue) cancelad/i);
  });
});

describe("el correo al titular", () => {
  const c = correoParaElTitular(DATOS);

  test("el asunto se distingue de un vistazo en la bandeja", () => {
    expect(c.asunto).toMatch(/arrepentimiento/i);
    expect(c.asunto).toContain("AR-4YP6T3");
  });

  test("trae todo lo que hace falta para buscar la compra", () => {
    expect(c.texto).toContain("ana@ejemplo.com");
    expect(c.texto).toContain("ABC123");
    expect(c.texto).toContain("Me arrepentí.");
  });

  test("recuerda el plazo, que es lo que apura", () => {
    expect(c.texto).toMatch(/24 horas/);
  });

  test("sin motivo no escribe un hueco", () => {
    const sin = correoParaElTitular({ ...DATOS, motivo: null });
    expect(sin.texto).not.toMatch(/motivo:\s*$/im);
    expect(sin.texto).not.toContain("null");
  });
});
