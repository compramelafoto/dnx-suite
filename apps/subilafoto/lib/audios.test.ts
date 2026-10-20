import { describe, expect, test } from "vitest";
import {
  DURACION_MAXIMA_S,
  TAMANO_MAXIMO_AUDIO,
  claveDeAudio,
  esClaveDeAudio,
  validarAudio,
} from "./audios";

describe("qué audios se aceptan", () => {
  test("los formatos que graba un teléfono", () => {
    /*
      `webm` lo graba Android y Chrome; `mp4` y `m4a`, el iPhone. Si falta alguno, la
      mitad de los invitados de una fiesta no puede dejar un saludo y no se entera de
      por qué.
    */
    for (const tipo of ["audio/webm", "audio/mp4", "audio/m4a", "audio/mpeg", "audio/ogg"]) {
      expect(validarAudio({ tipo, bytes: 200_000, segundos: 10 }).ok).toBe(true);
    }
  });

  test("un formato con códec entre paréntesis también", () => {
    // El navegador manda `audio/webm;codecs=opus`, no `audio/webm` a secas.
    expect(validarAudio({ tipo: "audio/webm;codecs=opus", bytes: 1000, segundos: 5 }).ok).toBe(
      true,
    );
  });

  test("un video disfrazado de audio, no", () => {
    expect(validarAudio({ tipo: "video/mp4", bytes: 1000, segundos: 5 }).ok).toBe(false);
  });

  test("vacío, no", () => {
    const v = validarAudio({ tipo: "audio/webm", bytes: 0, segundos: 5 });

    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("vacía");
  });
});

describe("los dos topes", () => {
  test("más largo que el máximo, no", () => {
    /*
      El tope es por la pantalla, no por el peso: un audio de dos minutos deja la
      proyección congelada en un solo saludo mientras la fiesta sigue.
    */
    const v = validarAudio({ tipo: "audio/webm", bytes: 1000, segundos: DURACION_MAXIMA_S + 1 });

    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("segundos");
  });

  test("justo en el máximo, sí", () => {
    expect(
      validarAudio({ tipo: "audio/webm", bytes: 1000, segundos: DURACION_MAXIMA_S }).ok,
    ).toBe(true);
  });

  test("más pesado que el tope, no", () => {
    // Red de seguridad por si el navegador miente con la duración.
    const v = validarAudio({
      tipo: "audio/webm",
      bytes: TAMANO_MAXIMO_AUDIO + 1,
      segundos: 5,
    });

    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("MB");
  });

  test("sin duración declarada se acepta y manda el peso", () => {
    /*
      Algunos navegadores devuelven `Infinity` como duración de lo que acaban de grabar.
      Rechazarlo dejaría sin grabar a quien usa ese navegador; el tope de peso alcanza
      para que no entre nada desmedido.
    */
    expect(validarAudio({ tipo: "audio/webm", bytes: 100_000, segundos: null }).ok).toBe(true);
    expect(
      validarAudio({ tipo: "audio/webm", bytes: TAMANO_MAXIMO_AUDIO + 1, segundos: null }).ok,
    ).toBe(false);
  });
});

describe("la ruta dentro del bucket", () => {
  test("cuelga del evento, para que la borre la purga", () => {
    const clave = claveDeAudio("ABC123", "audio/webm", "deadbeef");

    expect(clave.startsWith("eventos/ABC123/")).toBe(true);
    expect(clave.endsWith(".webm")).toBe(true);
  });

  test("nada del navegador llega crudo a la ruta", () => {
    const clave = claveDeAudio("../../otro", "audio/webm", "a/../b");

    expect(clave).not.toContain("..");
    expect(clave.split("/")).toHaveLength(3);
  });

  test("se distingue de una foto y de una portada", () => {
    expect(esClaveDeAudio(claveDeAudio("ABC", "audio/webm", "x"))).toBe(true);
    expect(esClaveDeAudio("eventos/ABC/portada-x.jpg")).toBe(false);
    expect(esClaveDeAudio("eventos/ABC/cmua0tpzk0001l304or8j38la.jpg")).toBe(false);
  });

  test("una dirección pegada que empieza parecido, no", () => {
    expect(esClaveDeAudio("https://ajeno.com/eventos/X/audio-y.webm")).toBe(false);
  });
});
