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

describe("la regla que no se negocia", () => {
  test("un mensaje nunca se publica solo", () => {
    /*
      Un emoji puede pasar sin moderar porque la lista es cerrada y no puede decir nada.
      Un mensaje de texto proyectado en la pared de un salón puede decir cualquier cosa,
      y Rekognition no lee texto para decidir si ofende.

      Mientras no haya un proveedor que modere texto, el mensaje espera al fotógrafo. Si
      algún día se automatiza, esta prueba es la que hay que venir a cambiar a propósito.
    */
    const { estadoInicial } = validarMensaje("Lo que sea");

    expect(estadoInicial).toBe("REVIEW_REQUIRED");
  });
});
