import { describe, expect, test } from "vitest";
import { estadoDeAcceso } from "./acceso-evento";

const ABRE = new Date("2026-10-11T23:00:00Z");
const CIERRA = new Date("2026-10-12T11:00:00Z");

const evento = {
  status: "SCHEDULED" as const,
  activationAt: ABRE,
  deactivationAt: CIERRA,
};

describe("cuándo puede entrar un invitado", () => {
  test("antes de la hora, todavía no", () => {
    const r = estadoDeAcceso(evento, new Date("2026-10-11T22:59:00Z"));
    expect(r.puedeSubir).toBe(false);
    expect(r.momento).toBe("ANTES");
  });

  test("en el horario, sí", () => {
    const r = estadoDeAcceso(evento, new Date("2026-10-12T02:00:00Z"));
    expect(r.puedeSubir).toBe(true);
    expect(r.momento).toBe("ABIERTO");
  });

  test("justo en el instante de apertura ya se puede", () => {
    expect(estadoDeAcceso(evento, ABRE).puedeSubir).toBe(true);
  });

  test("justo en el instante de cierre ya no se puede", () => {
    // El borde va cerrado: a las 12 horas exactas se terminó.
    expect(estadoDeAcceso(evento, CIERRA).puedeSubir).toBe(false);
  });

  test("pasada la hora, cerrado", () => {
    const r = estadoDeAcceso(evento, new Date("2026-10-12T11:00:01Z"));
    expect(r.momento).toBe("CERRADO");
  });

  test("un evento cancelado no abre aunque el reloj diga que sí", () => {
    const r = estadoDeAcceso(
      { ...evento, status: "CANCELLED" },
      new Date("2026-10-12T02:00:00Z"),
    );
    expect(r.puedeSubir).toBe(false);
    expect(r.momento).toBe("CERRADO");
  });

  test("un evento cerrado a mano no reabre porque el reloj todavía no llegó", () => {
    const r = estadoDeAcceso(
      { ...evento, status: "CLOSED" },
      new Date("2026-10-12T02:00:00Z"),
    );
    expect(r.puedeSubir).toBe(false);
  });

  test("sin fecha de activación no hay evento que abrir", () => {
    const r = estadoDeAcceso(
      { status: "CONFIGURING", activationAt: null, deactivationAt: null },
      new Date(),
    );
    expect(r.puedeSubir).toBe(false);
    expect(r.momento).toBe("ANTES");
  });
});
