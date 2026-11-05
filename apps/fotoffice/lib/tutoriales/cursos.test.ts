import { describe, expect, it } from "vitest";
import { clasesDelCurso, idDeYoutube, leerVideos, validarVideos } from "./curso";
import { CURSOS_TUTORIALES } from "./cursos";

describe("cursos de /tutoriales", () => {
  it("cada clase tiene una clave única que sirve de ancla", () => {
    for (const curso of CURSOS_TUTORIALES) {
      const claves = clasesDelCurso(curso).map((c) => c.clave);
      expect(new Set(claves).size).toBe(claves.length);
      for (const clave of claves) expect(clave).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("todo detalle generado corresponde a una clase del curso", () => {
    for (const curso of CURSOS_TUTORIALES) {
      const claves = clasesDelCurso(curso).map((c) => c.clave);
      for (const clave of Object.keys(curso.detalles)) expect(claves).toContain(clave);
    }
  });

  it("los textos no dicen «plata»", () => {
    const texto = JSON.stringify(CURSOS_TUTORIALES);
    expect(texto).not.toMatch(/\bplata\b/i);
  });
});

describe("links de YouTube", () => {
  it("reconoce los formatos habituales", () => {
    expect(idDeYoutube("https://youtu.be/eIqKPYZnZsc")).toBe("eIqKPYZnZsc");
    expect(idDeYoutube("https://www.youtube.com/watch?v=eIqKPYZnZsc")).toBe("eIqKPYZnZsc");
    expect(idDeYoutube("https://www.youtube.com/shorts/eIqKPYZnZsc")).toBe("eIqKPYZnZsc");
    expect(idDeYoutube("https://vimeo.com/123")).toBeNull();
  });

  it("al leer el ajuste descarta clases que no existen y links ajenos", () => {
    const guardado = JSON.stringify({
      videos: { "1": "https://youtu.be/aaaaaaaaaaa", "99": "https://youtu.be/b", "2": "https://vimeo.com/1" },
    });
    expect(leerVideos(guardado, ["1", "2"])).toEqual({ "1": "https://youtu.be/aaaaaaaaaaa" });
    expect(leerVideos("no es json", ["1"])).toEqual({});
  });

  it("un link inválido frena el guardado y uno vacío saca el video", () => {
    const clases = clasesDelCurso(CURSOS_TUTORIALES[0]);
    expect(validarVideos({ "1": "hola mundo" }, clases)).toEqual({
      error: "La clase 1 necesita un link de YouTube válido.",
    });
    expect(validarVideos({ "1": " https://youtu.be/aaaaaaaaaaa ", "2": "" }, clases)).toEqual({
      videos: { "1": "https://youtu.be/aaaaaaaaaaa" },
    });
  });
});
