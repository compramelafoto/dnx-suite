import { describe, expect, it } from "vitest";
import { avisoAlCerrarSolicitud } from "./cierre-de-solicitud";

describe("avisoAlCerrarSolicitud", () => {
  it("un pedido sin coberturas se cierra sin nada que aclarar", () => {
    expect(avisoAlCerrarSolicitud([])).toBeNull();
  });

  it("con todas las coberturas terminadas tampoco hay nada que avisar", () => {
    expect(
      avisoAlCerrarSolicitud([{ status: "CERRADA" }, { status: "CANCELADA" }]),
    ).toBeNull();
  });

  it("avisa cuando una cobertura sigue viva, y dice en qué estado está", () => {
    const aviso = avisoAlCerrarSolicitud([{ status: "BUSCANDO_EQUIPO" }]);
    expect(aviso).toContain("Buscando equipo");
    expect(aviso).toContain("no la cierra");
  });

  it("cuenta cuántas son cuando hay más de una", () => {
    const aviso = avisoAlCerrarSolicitud([
      { status: "BUSCANDO_EQUIPO" },
      { status: "EQUIPO_CONFIRMADO" },
      { status: "CERRADA" },
    ]);
    expect(aviso).toContain("2 coberturas");
  });

  it("una cobertura sin equipo también cuenta como viva", () => {
    // `SIN_EQUIPO` no es reposo: es el estado en que más falta enterarse de que algo quedó
    // abierto (ver el comentario de `COVERAGE_STATUSES`).
    expect(avisoAlCerrarSolicitud([{ status: "SIN_EQUIPO" }])).not.toBeNull();
  });

  it("no promete que cerrar el pedido arregle la cobertura", () => {
    // El texto tiene que decir lo que NO pasa: es justo el malentendido que deja a un equipo
    // yendo a una actividad que quien coordina creía cancelada.
    const aviso = avisoAlCerrarSolicitud([{ status: "EQUIPO_CONFIRMADO" }]);
    expect(aviso).toMatch(/no la cierra ni le avisa/);
  });
});
