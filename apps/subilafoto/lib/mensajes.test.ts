import { describe, expect, test } from "vitest";
import { LARGO_MAXIMO_MENSAJE, limpiarMensaje, validarMensaje } from "./mensajes";

describe("qué mensajes se aceptan", () => {
  test("uno normal, sí", () => {
    expect(validarMensaje("Feliz cumple Sofi!! Te queremos").ok).toBe(true);
  });

  test("vacío o sólo espacios, no", () => {
    expect(validarMensaje("").ok).toBe(false);
    expect(validarMensaje("   \n  ").ok).toBe(false);
  });

  test("más largo que el tope, no", () => {
    const v = validarMensaje("a".repeat(LARGO_MAXIMO_MENSAJE + 1));

    expect(v.ok).toBe(false);
    // El motivo se le muestra al invitado: tiene que decirle cuánto es el tope.
    if (v.ok) throw new Error("se esperaba un rechazo");
    expect(v.motivo).toContain(String(LARGO_MAXIMO_MENSAJE));
  });

  test("justo en el tope, sí", () => {
    expect(validarMensaje("a".repeat(LARGO_MAXIMO_MENSAJE)).ok).toBe(true);
  });
});

describe("la limpieza del texto", () => {
  test("recorta los espacios de los bordes", () => {
    expect(limpiarMensaje("  hola  ")).toBe("hola");
  });

  test("muchos saltos de línea seguidos se vuelven uno", () => {
    /*
      Sin esto, alguien manda veinte saltos y su mensaje ocupa la pantalla entera del
      salón empujando todo lo demás afuera.
    */
    expect(limpiarMensaje("hola\n\n\n\n\nchau")).toBe("hola\nchau");
  });

  test("saca los caracteres de control", () => {
    // Invisibles que rompen el dibujo del texto o lo dan vuelta de derecha a izquierda.
    expect(limpiarMensaje("ho\u0000la‮chau")).toBe("holachau");
  });

  test("deja los acentos, la eñe y los emojis", () => {
    expect(limpiarMensaje("Feliz cumple, Begoña ñandú 🎉")).toBe("Feliz cumple, Begoña ñandú 🎉");
  });

  test("muchos espacios seguidos se vuelven uno", () => {
    expect(limpiarMensaje("hola          mundo")).toBe("hola mundo");
  });
});

describe("con qué estado nace un mensaje", () => {
  test("se publica solo", () => {
    /*
      Cambiado el 2026-10-09 por decisión del titular. Antes esta prueba se llamaba "la
      regla que no se negocia" y fijaba lo contrario: el mensaje esperaba al fotógrafo
      porque Amazon mira imágenes y no juzga texto.

      Él pidió que no haya cola de revisión manual, sabiendo lo que implica: **un texto
      escrito por un invitado aparece en la pared del salón sin que nadie lo haya
      leído**. Lo único que lo acota son los 140 caracteres, que quede guardado con la
      sesión de quien lo mandó, y que el fotógrafo lo pueda sacar desde Control en vivo
      —después de que se vio—.

      Si algún día se quiere volver atrás, o sumar un proveedor que modere texto, acá es
      donde hay que venir.
    */
    const { estadoInicial } = validarMensaje("Lo que sea");

    expect(estadoInicial).toBe("APPROVED");
  });
});
