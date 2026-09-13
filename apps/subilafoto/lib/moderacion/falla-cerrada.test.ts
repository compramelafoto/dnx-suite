import { describe, expect, test } from "vitest";
import { PERFILES, VERSION_DE_POLITICA, decidirDesdeElAnalisis } from "./reglas";

const perfiles = [...PERFILES] as const;

/**
 * Criterio de aceptación 2.6 del backlog: con las credenciales rotas, ninguna
 * foto se publica.
 */
describe("falla cerrada", () => {
  test.each([
    "UnrecognizedClientException",
    "AccessDeniedException",
    "ThrottlingException",
    "InvalidImageFormatException",
    "TimeoutError",
    "desconocido",
  ])("si el proveedor falla con «%s», la foto queda retenida", (codigo) => {
    for (const perfil of perfiles) {
      const d = decidirDesdeElAnalisis({ ok: false, codigoDeError: codigo }, perfil);
      expect(d.estado).toBe("REVIEW_REQUIRED");
    }
  });

  test("un fallo no bloquea la foto, la retiene", () => {
    // La diferencia importa: bloqueada es una acusación, retenida es "todavía
    // no la miramos". Si se cae Amazon una noche, el fotógrafo aprueba a mano;
    // no queremos que le queden trescientas fotos marcadas como prohibidas.
    const d = decidirDesdeElAnalisis({ ok: false, codigoDeError: "ThrottlingException" }, "SOCIAL");
    expect(d.estado).not.toBe("BLOCKED");
    expect(d.estado).not.toBe("APPROVED");
  });

  test("el motivo dice que fue un error y cuál, no una etiqueta inventada", () => {
    const d = decidirDesdeElAnalisis({ ok: false, codigoDeError: "AccessDeniedException" }, "FAMILIAR");
    expect(d.motivo).toBe("error:AccessDeniedException");
    expect(d.confianza).toBeNull();
    expect(d.versionDePolitica).toBe(VERSION_DE_POLITICA);
  });

  test("si el análisis salió bien, decide con las etiquetas como siempre", () => {
    expect(decidirDesdeElAnalisis({ ok: true, etiquetas: [] }, "SOCIAL").estado).toBe("APPROVED");
    expect(
      decidirDesdeElAnalisis({ ok: true, etiquetas: [{ nombre: "Violence", confianza: 90 }] }, "SOCIAL")
        .estado,
    ).toBe("BLOCKED");
  });

  test("un análisis vacío no es lo mismo que un análisis que no se hizo", () => {
    // Cero etiquetas quiere decir "la miré y está bien". Eso se aprueba.
    // No haberla mirado nunca es el caso de arriba, y ese se retiene.
    expect(decidirDesdeElAnalisis({ ok: true, etiquetas: [] }, "FAMILIAR").estado).toBe("APPROVED");
  });
});
