import { describe, expect, test } from "vitest";
import { accionDeTecla, avisoDeAccion } from "./mando-teclado";

describe("las teclas del mando del DJ", () => {
  test("la barra pausa, como en todo reproductor", () => {
    expect(accionDeTecla({ tecla: " " })).toBe("PAUSA");
  });

  test("la flecha y la N adelantan", () => {
    expect(accionDeTecla({ tecla: "ArrowRight" })).toBe("SIGUIENTE");
    expect(accionDeTecla({ tecla: "n" })).toBe("SIGUIENTE");
    expect(accionDeTecla({ tecla: "N" })).toBe("SIGUIENTE");
  });

  test("la A cambia el orden", () => {
    expect(accionDeTecla({ tecla: "a" })).toBe("AZAR");
  });

  test("una tecla cualquiera no hace nada", () => {
    expect(accionDeTecla({ tecla: "q" })).toBe(null);
    expect(accionDeTecla({ tecla: "Enter" })).toBe(null);
  });

  test("con Ctrl o Cmd la combinación es del navegador", () => {
    /*
      Cmd+A es "seleccionar todo" y Ctrl+N abre una ventana. Robarle esas teclas al
      navegador en la máquina que maneja la proyección es la forma más rápida de que
      alguien no pueda hacer algo urgente a mitad de la fiesta.
    */
    expect(accionDeTecla({ tecla: "a", conModificador: true })).toBe(null);
    expect(accionDeTecla({ tecla: " ", conModificador: true })).toBe(null);
  });

  test("si alguien está escribiendo, las teclas son suyas", () => {
    expect(accionDeTecla({ tecla: " ", escribiendo: true })).toBe(null);
  });
});

describe("el cartel que confirma la tecla", () => {
  /*
    Sin botonera no hay nada en pantalla que diga en qué estado quedó. Si apretar la barra
    no avisa nada, el DJ no sabe si pausó, si la tecla no llegó o si el televisor se colgó.
  */
  test("dice dónde quedó, no lo que había antes", () => {
    expect(avisoDeAccion("PAUSA", { pausado: true, aleatorio: false })).toBe("En pausa");
    expect(avisoDeAccion("PAUSA", { pausado: false, aleatorio: false })).toBe("Reanudado");
  });

  test("el orden también se confirma", () => {
    expect(avisoDeAccion("AZAR", { pausado: false, aleatorio: true })).toBe("Pasa al azar");
    expect(avisoDeAccion("AZAR", { pausado: false, aleatorio: false })).toBe("Pasa en orden");
  });

  test("adelantar no depende de ningún estado", () => {
    expect(avisoDeAccion("SIGUIENTE", { pausado: false, aleatorio: false })).toBe("Siguiente");
  });
});
