import { describe, expect, it } from "vitest";
import { textosDeVenta } from "./textos";

const datos = {
  nombre: "Estudio Luz",
  precio: "$ 150.000",
  enlace: "https://subilafoto.com/v/estudio-luz",
};

describe("textosDeVenta", () => {
  const textos = textosDeVenta(datos);
  const todo = [textos.whatsapp, textos.instagram, textos.detalle, ...textos.preguntas.flatMap((p) => [p.pregunta, p.respuesta])].join("\n");

  it("el mensaje de WhatsApp lleva el precio y el enlace ya puestos", () => {
    expect(textos.whatsapp).toContain("$ 150.000");
    expect(textos.whatsapp).toContain("https://subilafoto.com/v/estudio-luz");
  });

  it("no deja nada para completar a mano", () => {
    expect(todo).not.toMatch(/\[|\]|\{\{|XXX/);
  });

  it("es marca blanca: no nombra a la plataforma", () => {
    expect(todo.replaceAll(datos.enlace, "")).not.toMatch(/subilafoto/i);
  });

  it("responde si hace falta pantalla, que es lo que frenó el primer evento", () => {
    expect(textos.preguntas.some((p) => /pantalla/i.test(p.pregunta))).toBe(true);
  });
});
