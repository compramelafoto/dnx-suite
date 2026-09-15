import { describe, expect, test } from "vitest";
import { condicionDePublicadas, estaPublicada, puedeVerElAlbum } from "./album";

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
