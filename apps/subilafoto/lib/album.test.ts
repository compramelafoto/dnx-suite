import { describe, expect, test } from "vitest";
import { condicionDePublicadas, estaPublicada, puedeVerElAlbum, puedeVerElMuro } from "./album";

describe("qué foto llega al álbum y a la pantalla", () => {
  test("una aprobada y publicada, sí", () => {
    expect(estaPublicada({ status: "APPROVED", publishedAt: new Date() })).toBe(true);
  });

  test("aprobada pero sin fecha de publicación, no", () => {
    // Las dos condiciones tienen que darse. `publishedAt` es lo único que
    // decide si algo se proyecta; el estado solo no alcanza.
    expect(estaPublicada({ status: "APPROVED", publishedAt: null })).toBe(false);
  });

  test("con fecha de publicación pero oculta a mano, no", () => {
    // Pasa cuando el dueño del evento saca una foto de la pantalla.
    expect(estaPublicada({ status: "HIDDEN", publishedAt: new Date() })).toBe(false);
  });

  test.each(["PROCESSING", "REVIEW_REQUIRED", "BLOCKED", "UPLOADING", "DELETED"])(
    "en estado %s no se muestra, tenga la fecha que tenga",
    (estado) => {
      expect(estaPublicada({ status: estado, publishedAt: new Date() })).toBe(false);
    },
  );

  test("la consulta a la base exige las dos condiciones", () => {
    // Este test existe para que nadie borre una de las dos del `where` sin
    // darse cuenta. Es el criterio de aceptación 2.8 del backlog.
    const donde = condicionDePublicadas("evento-1");
    expect(donde.eventId).toBe("evento-1");
    expect(donde.status).toBe("APPROVED");
    expect(donde.publishedAt).toEqual({ not: null });
  });
});

describe("quién puede ver el álbum", () => {
  test("el invitado depende del interruptor", () => {
    expect(puedeVerElAlbum({ guestsCanSeeAlbum: true, esElCliente: false })).toBe(true);
    expect(puedeVerElAlbum({ guestsCanSeeAlbum: false, esElCliente: false })).toBe(false);
  });

  test("al cliente no lo alcanza el interruptor: es su material", () => {
    expect(puedeVerElAlbum({ guestsCanSeeAlbum: false, esElCliente: true })).toBe(true);
  });
});

describe("el muro en vivo no es el álbum", () => {
  /*
    La diferencia es el punto. El álbum es todo lo del evento, para siempre y con la foto
    entera: por eso nace cerrado a los invitados. El muro es lo que está llegando ahora,
    en chico, mientras la fiesta pasa.

    Existe por la fiesta del 10/10/2026, que no se hizo porque el salón no tenía pantalla.
    Sin pantalla el invitado sube una foto y no recibe nada: la manda a un pozo.
  */
  test("mientras la fiesta corre, se ve", () => {
    expect(puedeVerElMuro({ guestsCanSeeLive: true, momento: "ABIERTO" })).toBe(true);
  });

  test("terminada la fiesta, no: ahí manda el álbum", () => {
    expect(puedeVerElMuro({ guestsCanSeeLive: true, momento: "CERRADO" })).toBe(false);
  });

  test("antes de empezar tampoco: no hay nada en vivo todavía", () => {
    expect(puedeVerElMuro({ guestsCanSeeLive: true, momento: "ANTES" })).toBe(false);
  });

  test("el fotógrafo lo puede apagar", () => {
    // El que tiene pantalla y prefiere que el salón mire hacia arriba.
    expect(puedeVerElMuro({ guestsCanSeeLive: false, momento: "ABIERTO" })).toBe(false);
  });
});
