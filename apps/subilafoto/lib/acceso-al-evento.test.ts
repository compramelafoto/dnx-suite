import { describe, expect, test } from "vitest";
import {
  eventoQueAdministra,
  eventosQueAdministra,
  medioDeUnEventoQueAdministra,
} from "./acceso-al-evento";

/*
  Estas pruebas miran la forma del `where`, que es poco habitual, pero acá el `where` ES
  el control de acceso: no hay un `if` después que lo repita. Lo que se protege son tres
  invariantes que, si se rompen, no fallan ruidosamente —dejan entrar a quien no debe, o
  dejan afuera al dueño— y eso no lo nota ningún test de pantalla.
*/
describe("la puerta de un evento", () => {
  test("el dueño sigue entrando", () => {
    const w = eventoQueAdministra("ev1", 7);

    expect(w.id).toBe("ev1");
    expect(w.OR).toContainEqual({ sellerProfile: { userId: 7 } });
  });

  test("y además entra quien fue invitado a ESE evento", () => {
    const w = eventoQueAdministra("ev1", 7);
    const rama = w.OR.find((o) => "collaborators" in o);

    expect(rama).toBeDefined();
    expect(w.id).toBe("ev1");
  });

  test("una colaboración revocada no cuenta", () => {
    /*
      Sin este filtro, sacarle el acceso a alguien exigiría borrar la fila, y entonces se
      pierde el registro de que alguna vez entró. Revocar tiene que ser suficiente.
    */
    const w = eventoQueAdministra("ev1", 7);
    const rama = JSON.stringify(w.OR.find((o) => "collaborators" in o));

    expect(rama).toContain('"revokedAt":null');
  });

  test("nunca hay un camino sin condición de persona", () => {
    // Un `OR` con una rama vacía abriría el evento a cualquiera con sesión.
    const w = eventoQueAdministra("ev1", 7);

    for (const rama of w.OR) {
      expect(JSON.stringify(rama)).toContain("7");
    }
  });
});

describe("la puerta de una foto dentro de un evento", () => {
  test("ata la foto al evento y el evento a la persona", () => {
    const w = medioDeUnEventoQueAdministra("m1", "ev1", 7);

    expect(w.id).toBe("m1");
    expect(w.eventId).toBe("ev1");
    expect(w.event.OR).toContainEqual({ sellerProfile: { userId: 7 } });
  });
});

describe("la lista del panel", () => {
  test("muestra los propios y los invitados", () => {
    /*
      Sin la segunda rama, quien colabora entra y ve una lista vacía aunque tenga permiso
      en cada pantalla: no tiene por dónde llegar al evento.
    */
    const w = eventosQueAdministra("perfil1", 7);

    expect(w.OR).toContainEqual({ sellerProfileId: "perfil1" });
    expect(w.OR.some((o) => "collaborators" in o)).toBe(true);
  });
});
