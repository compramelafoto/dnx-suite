import { describe, expect, it } from "vitest";
import { puedePostularse, type CandidatoAConvocatoria } from "./elegibilidad";

const AHORA = new Date("2026-09-20T12:00:00Z");

/**
 * La base: una persona que puede postularse sin problema. Cada test parte de acá y rompe una
 * sola regla, para que quede claro cuál mensaje corresponde a cuál causa.
 */
function candidatoElegible(): CandidatoAConvocatoria {
  return {
    tienePerfilActivo: true,
    yaSePostulo: false,
    yaEstaAsignado: false,
    convocatoriaStatus: "PUBLICADA",
    cierreDePostulaciones: null,
  };
}

describe("puedePostularse", () => {
  it("una persona elegible puede postularse", () => {
    expect(puedePostularse(candidatoElegible(), AHORA)).toEqual({ puede: true });
  });

  it("sin perfil de colaborador activo, no puede — mensaje amable, no técnico", () => {
    const r = puedePostularse({ ...candidatoElegible(), tienePerfilActivo: false }, AHORA);
    expect(r).toEqual({
      puede: false,
      motivo: "Todavía no estás habilitado para anotarte.",
    });
  });

  it("si la convocatoria no está publicada, no puede", () => {
    const r = puedePostularse(
      { ...candidatoElegible(), convocatoriaStatus: "BORRADOR" },
      AHORA,
    );
    expect(r).toEqual({ puede: false, motivo: "Esta convocatoria no está abierta." });
  });

  it("si ya cerró el plazo de postulaciones, no puede", () => {
    const r = puedePostularse(
      { ...candidatoElegible(), cierreDePostulaciones: new Date("2026-09-19T12:00:00Z") },
      AHORA,
    );
    expect(r).toEqual({ puede: false, motivo: "El plazo para anotarse ya cerró." });
  });

  it("justo en el instante del cierre, todavía puede — cierra después de esa hora, no en ella", () => {
    const r = puedePostularse({ ...candidatoElegible(), cierreDePostulaciones: AHORA }, AHORA);
    expect(r).toEqual({ puede: true });
  });

  it("si ya está asignada a esta cobertura, no puede", () => {
    const r = puedePostularse({ ...candidatoElegible(), yaEstaAsignado: true }, AHORA);
    expect(r).toEqual({ puede: false, motivo: "Ya estás en el equipo de esta cobertura." });
  });

  it("si ya se postuló, no puede de nuevo — mensaje amable, no 'postulación duplicada'", () => {
    const r = puedePostularse({ ...candidatoElegible(), yaSePostulo: true }, AHORA);
    expect(r).toEqual({ puede: false, motivo: "Ya te anotaste." });
  });

  it("un rol completo NO bloquea la postulación: el coordinador puede querer suplentes", () => {
    // A propósito, `CandidatoAConvocatoria` ni siquiera lleva cuántas vacantes quedan: cupos y
    // elegibilidad son preguntas distintas. Que el rol esté lleno se resuelve en la pantalla
    // (mostrando "buscando suplentes" en vez de ocultar el botón), nunca acá.
    expect(puedePostularse(candidatoElegible(), AHORA)).toEqual({ puede: true });
  });

  describe("el orden de las reglas", () => {
    // Con todas las reglas rotas a la vez, gana la primera de la lista. Se van arreglando de a
    // una para confirmar que el mensaje avanza a la siguiente regla en el orden exacto del plan.
    function candidatoConTodoRoto(): CandidatoAConvocatoria {
      return {
        tienePerfilActivo: false,
        yaSePostulo: true,
        yaEstaAsignado: true,
        convocatoriaStatus: "BORRADOR",
        cierreDePostulaciones: new Date("2026-01-01T00:00:00Z"),
      };
    }

    it("1) sin perfil activo gana sobre todo lo demás", () => {
      const r = puedePostularse(candidatoConTodoRoto(), AHORA);
      expect(r).toEqual({ puede: false, motivo: "Todavía no estás habilitado para anotarte." });
    });

    it("2) resuelto el perfil, gana que la convocatoria no esté publicada", () => {
      const r = puedePostularse(
        { ...candidatoConTodoRoto(), tienePerfilActivo: true },
        AHORA,
      );
      expect(r).toEqual({ puede: false, motivo: "Esta convocatoria no está abierta." });
    });

    it("3) resuelto lo anterior, gana que el plazo ya cerró", () => {
      const r = puedePostularse(
        {
          ...candidatoConTodoRoto(),
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
        },
        AHORA,
      );
      expect(r).toEqual({ puede: false, motivo: "El plazo para anotarse ya cerró." });
    });

    it("4) resuelto lo anterior, gana que ya está asignada, antes que ya se postuló", () => {
      const r = puedePostularse(
        {
          ...candidatoConTodoRoto(),
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
          cierreDePostulaciones: null,
        },
        AHORA,
      );
      expect(r).toEqual({ puede: false, motivo: "Ya estás en el equipo de esta cobertura." });
    });

    it("5) resuelto lo anterior, por fin aparece que ya se postuló", () => {
      const r = puedePostularse(
        {
          ...candidatoConTodoRoto(),
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
          cierreDePostulaciones: null,
          yaEstaAsignado: false,
        },
        AHORA,
      );
      expect(r).toEqual({ puede: false, motivo: "Ya te anotaste." });
    });

    it("6) resueltas las cinco, puede postularse", () => {
      const r = puedePostularse(
        {
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
          cierreDePostulaciones: null,
          yaEstaAsignado: false,
          yaSePostulo: false,
        },
        AHORA,
      );
      expect(r).toEqual({ puede: true });
    });
  });
});
