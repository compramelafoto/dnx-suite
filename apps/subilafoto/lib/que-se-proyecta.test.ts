import { describe, expect, test } from "vitest";
import { VENCIMIENTO_DEL_AVISO_MS, fotoALaQueReacciona } from "./que-se-proyecta";

const ahora = new Date("2026-10-10T23:30:00Z");
const haceSegundos = (s: number) => new Date(ahora.getTime() - s * 1000);

describe("a qué foto se le cuenta una reacción", () => {
  test("a la que la pantalla dijo que está mostrando", () => {
    expect(
      fotoALaQueReacciona({ mediaId: "foto-7", avisadoEl: haceSegundos(3), ahora }),
    ).toBe("foto-7");
  });

  test("a ninguna si la pantalla nunca avisó", () => {
    /*
      Pasa en toda fiesta: alguien escanea el QR del cartel de la mesa y reacciona antes
      de que nadie haya enchufado el televisor. La reacción cuenta para el evento, pero
      no se le puede atribuir a una foto que nadie estaba viendo.
    */
    expect(fotoALaQueReacciona({ mediaId: null, avisadoEl: null, ahora })).toBeNull();
  });

  test("a ninguna si el aviso quedó viejo", () => {
    /*
      La pantalla avisa en cada cambio de foto. Si hace un minuto que no dice nada, se
      apagó, se cortó el wifi o alguien cerró el navegador: lo que haya quedado anotado
      ya no es lo que el salón está viendo.
    */
    const viejo = haceSegundos(VENCIMIENTO_DEL_AVISO_MS / 1000 + 1);

    expect(fotoALaQueReacciona({ mediaId: "foto-7", avisadoEl: viejo, ahora })).toBeNull();
  });

  test("justo en el límite todavía vale", () => {
    const alLimite = haceSegundos(VENCIMIENTO_DEL_AVISO_MS / 1000);

    expect(fotoALaQueReacciona({ mediaId: "foto-7", avisadoEl: alLimite, ahora })).toBe(
      "foto-7",
    );
  });

  test("a ninguna si hay foto anotada pero sin fecha", () => {
    // No debería pasar, pero una fila a medias no puede terminar atribuyendo mal.
    expect(fotoALaQueReacciona({ mediaId: "foto-7", avisadoEl: null, ahora })).toBeNull();
  });

  test("a ninguna si la pantalla está mostrando el QR", () => {
    // Durante el QR la pantalla avisa `null`: no hay foto a la que reaccionar.
    expect(fotoALaQueReacciona({ mediaId: null, avisadoEl: haceSegundos(1), ahora })).toBeNull();
  });
});
