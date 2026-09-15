import { describe, expect, test } from "vitest";
import { HITOS } from "./calendario";
import { textoDelAviso, type DatosDelAviso } from "./textos";

const BASE: DatosDelAviso = {
  aviso: "dia-1",
  nombreDelEvento: "Casamiento de Ana y Luis",
  vendedor: "Estudio Norte",
  panelUrl: "https://subilafoto.com/cliente/abc123",
  yaTieneLaDescarga: false,
  seBorraEl: "9 de noviembre",
  precioDeLaDescarga: "$10.000",
};

const todos = HITOS.map((h) => `dia-${h}` as const);

describe("los textos de los avisos", () => {
  test.each(todos)("«%s» tiene asunto y cuerpo", (aviso) => {
    const c = textoDelAviso({ ...BASE, aviso });
    expect(c.asunto.length).toBeGreaterThan(10);
    expect(c.texto.length).toBeGreaterThan(40);
  });

  test.each(todos)("«%s» siempre lleva el enlace al panel", (aviso) => {
    expect(textoDelAviso({ ...BASE, aviso }).texto).toContain(BASE.panelUrl);
  });

  test.each(todos)("«%s» firma con el vendedor y no con nosotros", (aviso) => {
    // Para el cliente el servicio es de quien se lo vendió. Que aparezca nuestra
    // marca rompería la marca blanca que le prometimos al fotógrafo.
    const c = textoDelAviso({ ...BASE, aviso });
    expect(c.texto).toContain("Estudio Norte");
    expect(`${c.asunto} ${c.texto}`).not.toMatch(/subí la foto/i);
  });

  test("a quien ya tiene la descarga no se le ofrece comprarla", () => {
    /*
      Insistirle con que compre algo que ya compró es la forma más rápida de que
      marque el correo como spam, y de que deje de abrir los que sí importan.
    */
    for (const aviso of todos) {
      const c = textoDelAviso({ ...BASE, aviso, yaTieneLaDescarga: true });
      expect(`${c.asunto} ${c.texto}`, aviso).not.toContain(BASE.precioDeLaDescarga);
    }
  });

  test("a quien no la tiene se le ofrece, con el precio", () => {
    for (const aviso of todos) {
      const c = textoDelAviso({ ...BASE, aviso });
      expect(c.texto, aviso).toContain(BASE.precioDeLaDescarga);
    }
  });

  test("los cinco asuntos son distintos entre sí", () => {
    // Cinco correos con el mismo asunto se leen como uno reenviado cuatro veces.
    const asuntos = todos.map((aviso) => textoDelAviso({ ...BASE, aviso }).asunto);
    expect(new Set(asuntos).size).toBe(asuntos.length);
  });

  test("el último dice que es hoy", () => {
    const c = textoDelAviso({ ...BASE, aviso: "dia-30" });
    expect(c.asunto).toMatch(/hoy/i);
  });

  test("todos avisan cuándo se borra", () => {
    for (const aviso of todos) {
      const c = textoDelAviso({ ...BASE, aviso });
      expect(`${c.asunto} ${c.texto}`, aviso).toMatch(/hoy|9 de noviembre/i);
    }
  });
});
