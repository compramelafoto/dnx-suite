import { describe, expect, test } from "vitest";
import { escaparXml, partirEnLineas, svgDelMensaje } from "./mensaje-a-imagen";

describe("escapar el texto para el SVG", () => {
  test("los caracteres que romperían el dibujo", () => {
    /*
      Un SVG es XML. Sin escapar, un mensaje con `<` corta la etiqueta y la imagen sale
      vacía o rota; con `&` el documento directamente no parsea y falla el armado del
      paquete entero por un saludo.
    */
    expect(escaparXml("Mate & tortas")).toBe("Mate &amp; tortas");
    expect(escaparXml("5 < 7")).toBe("5 &lt; 7");
    expect(escaparXml('dijo "hola"')).toBe("dijo &quot;hola&quot;");
  });

  test("no se puede inyectar una etiqueta", () => {
    const sucio = '</text><script>alert(1)</script><text>';

    expect(escaparXml(sucio)).not.toContain("<script>");
    expect(escaparXml(sucio)).not.toContain("</text>");
  });

  test("el texto normal no se toca", () => {
    expect(escaparXml("Feliz cumple Sofi")).toBe("Feliz cumple Sofi");
  });
});

describe("partir el texto en líneas", () => {
  test("corta por palabras, no por el medio de una", () => {
    const lineas = partirEnLineas("feliz cumpleaños querida Sofi", 14);

    for (const l of lineas) expect(l.length).toBeLessThanOrEqual(14);
    expect(lineas.join(" ")).toBe("feliz cumpleaños querida Sofi");
  });

  test("una palabra más larga que la línea no se pierde", () => {
    /*
      Si una palabra sola no entra, antes se perdía en un bucle que nunca la colocaba.
      Mejor que sobresalga a que el mensaje salga incompleto.
    */
    const lineas = partirEnLineas("supercalifragilisticoespialidoso", 10);

    expect(lineas.join("")).toContain("supercalifragilisticoespialidoso");
  });

  test("respeta los saltos de línea que puso el invitado", () => {
    expect(partirEnLineas("hola\nchau", 20)).toEqual(["hola", "chau"]);
  });

  test("un texto vacío no devuelve una línea fantasma", () => {
    expect(partirEnLineas("", 20)).toEqual([]);
  });
});

describe("el SVG del mensaje", () => {
  const tema = { fondo: "#14091F", texto: "#FFFFFF", acento: "#FF5C97" };

  test("trae el texto adentro", () => {
    expect(svgDelMensaje({ texto: "Feliz cumple", nombre: null, tema })).toContain(
      "Feliz cumple",
    );
  });

  test("trae el nombre cuando lo hay", () => {
    expect(svgDelMensaje({ texto: "Hola", nombre: "La tía Ana", tema })).toContain(
      "La tía Ana",
    );
  });

  test("un texto peligroso no rompe el documento", () => {
    const svg = svgDelMensaje({ texto: "Mate & <b>tortas</b>", nombre: null, tema });

    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("<b>");
  });

  test("el nombre también se escapa", () => {
    // Llega del invitado igual que el texto: no hay razón para confiar en uno y no en otro.
    const svg = svgDelMensaje({ texto: "Hola", nombre: "<script>x</script>", tema });

    expect(svg).not.toContain("<script>");
  });

  test("usa los colores del evento", () => {
    const svg = svgDelMensaje({ texto: "Hola", nombre: null, tema });

    expect(svg).toContain(tema.fondo);
  });

  test("es un SVG con medidas", () => {
    const svg = svgDelMensaje({ texto: "Hola", nombre: null, tema });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("width=");
    expect(svg).toContain("height=");
  });
});
