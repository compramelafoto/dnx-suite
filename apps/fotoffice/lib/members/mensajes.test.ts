import { describe, expect, it } from "vitest";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { MENSAJES_DE_PADRON, mensajeDePadron, type ClaveDeMensaje } from "./mensajes";

const socios = personVocabulary(null);
const voluntarios = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });

const CLAVES = Object.keys(MENSAJES_DE_PADRON) as ClaveDeMensaje[];

/**
 * Los mensajes del padrón, en las dos instituciones que importan.
 *
 * El primer bloque es el que protege a la SFPR: con el vocabulario por omisión, cada mensaje
 * tiene que decir **exactamente** lo que decía antes de que existiera el vocabulario. Un
 * cambio de redacción disfrazado de refactor se ve acá.
 */
describe("los mensajes por omisión dicen lo de siempre", () => {
  it("los que nombran a una persona sola", () => {
    expect(mensajeDePadron("noEncontrado", socios)).toBe("Socio no encontrado.");
    expect(mensajeDePadron("invalido", socios)).toBe("Socio inválido.");
    expect(mensajeDePadron("yaVinculado", socios)).toBe("Este socio ya tiene una cuenta vinculada.");
    expect(mensajeDePadron("cuentaTomada", socios)).toBe(
      "Esa cuenta ya está vinculada a otro socio de este workspace.",
    );
    expect(mensajeDePadron("soloSePuedeInvitarActivo", socios)).toBe(
      "Solo se puede invitar a un socio activo.",
    );
    expect(mensajeDePadron("cuentaTomadaEnEstaInstitucion", socios)).toBe(
      "Tu cuenta ya está vinculada a otro socio de esta institución.",
    );
  });

  it("los de concurrencia", () => {
    expect(mensajeDePadron("modificadoMientrasTanto", socios)).toBe(
      "Otra persona modificó este socio mientras tanto. Recargá la ficha e intentá de nuevo.",
    );
    expect(mensajeDePadron("modificadoMientrasEditabas", socios)).toBe(
      "Otra persona modificó este socio mientras lo editabas. Recargá la ficha e intentá de nuevo.",
    );
  });

  it("los del alta y la vinculación", () => {
    expect(mensajeDePadron("sinEmail", socios)).toBe(
      "Este socio no tiene email. Cargale un email propio en su ficha, o vinculá una cuenta existente.",
    );
    expect(mensajeDePadron("sinCuentaVinculada", socios)).toBe(
      "Este socio no tiene ninguna cuenta vinculada.",
    );
    expect(mensajeDePadron("cuentaNoEncontrada", socios)).toBe(
      "No encontramos una cuenta con ese email exacto. Revisá el email o invitá al socio.",
    );
    expect(mensajeDePadron("emailsNoCoinciden", socios)).toBe(
      "Los emails no coinciden: confirmá que esta es realmente la cuenta del socio antes de continuar.",
    );
  });

  it("los que piden un motivo", () => {
    expect(mensajeDePadron("motivoDeSuspension", socios)).toBe(
      "Escribí el motivo de la suspensión: queda registrado en el historial del socio.",
    );
    expect(mensajeDePadron("motivoDeBaja", socios)).toBe(
      "Escribí el motivo de la baja: queda registrado en el historial del socio.",
    );
    expect(mensajeDePadron("motivoDeDesvinculacion", socios)).toBe(
      "Escribí el motivo de la desvinculación: queda registrado en el historial del socio.",
    );
  });

  it("los de datos repetidos", () => {
    expect(mensajeDePadron("numeroRepetido", socios)).toBe(
      "Ya existe un socio con ese número en este workspace.",
    );
    expect(mensajeDePadron("documentoRepetido", socios)).toBe(
      "Ya existe un socio con ese documento en este workspace.",
    );
    expect(mensajeDePadron("emailRepetido", socios)).toBe(
      "Ya existe un socio con ese email en este workspace.",
    );
    expect(mensajeDePadron("datosRepetidos", socios)).toBe(
      "Ya existe un socio con esos datos en este workspace.",
    );
    expect(mensajeDePadron("noSePudoGuardar", socios)).toBe("No se pudo guardar el socio.");
  });

  it("los del portal", () => {
    expect(mensajeDePadron("fichaNoEncontrada", socios)).toBe("No encontramos tu ficha de socio.");
    expect(mensajeDePadron("condicionNoActiva", socios)).toBe(
      "Tu condición de socio no está activa.",
    );
    expect(mensajeDePadron("fichaNoActiva", socios)).toBe("Tu ficha de socio no está activa.");
    expect(mensajeDePadron("noPerteneceAEstaInstitucion", socios)).toBe(
      "Ese socio no pertenece a esta institución.",
    );
  });

  it("los de la importación", () => {
    expect(mensajeDePadron("emailTomadoPorOtro", socios)).toBe(
      "Ese email ya está registrado en otro socio de este workspace. Usá otro email o dejá esta fila sin email.",
    );
    expect(mensajeDePadron("numeroDuplicadoEnElArchivo", socios)).toBe(
      "Número de socio duplicado en el archivo.",
    );
  });

  it("los de las tandas y los cobros", () => {
    expect(mensajeDePadron("ningunoSeleccionado", socios)).toBe("No seleccionaste ningún socio.");
    expect(mensajeDePadron("elegiUno", socios)).toBe("Elegí a qué socio corresponde el pago.");
    expect(mensajeDePadron("choqueAlImportar", socios)).toBe(
      "No pudimos importar (algún dato choca con otro socio existente). No se creó ningún socio.",
    );
  });
});

describe("en una institución de voluntarios", () => {
  it("ningún mensaje sigue diciendo socio", () => {
    for (const clave of CLAVES) {
      expect(mensajeDePadron(clave, voluntarios)).not.toMatch(/socio/i);
    }
  });

  it("ningún mensaje queda con un marcador sin resolver", () => {
    // Un marcador mal escrito —{Personaa}— no rompe nada y se leería tal cual en pantalla.
    for (const clave of CLAVES) {
      expect(mensajeDePadron(clave, voluntarios)).not.toContain("{");
    }
  });

  it("todo mensaje nombra a la gente del padrón, si no no tendría por qué estar acá", () => {
    for (const clave of CLAVES) {
      expect(MENSAJES_DE_PADRON[clave]).toMatch(/\{[Pp]ersonas?\}/);
    }
  });

  it("la palabra no se toca dentro de otras palabras", () => {
    // El caso que justifica los marcadores: "asociación" y "asociarse" contienen "socia".
    expect(mensajeDePadron("cuentaNoEncontrada", voluntarios)).toContain("voluntario/a");
  });
});
