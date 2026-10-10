import { describe, expect, it } from "vitest";
import { textoInvitacionEquipo } from "./textos-equipo";

describe("textoInvitacionEquipo", () => {
  const t = textoInvitacionEquipo({
    muestra: "Rosario en blanco y negro", invita: "Daniela", rol: "TEXT_EDITOR",
    url: "https://muestrasfotograficas.com/panel/equipo/invitacion/x", vence: new Date("2026-11-10T15:00:00Z"),
  });
  it("asunto con el nombre de la muestra", () => expect(t.subject).toBe("Te invitaron al equipo de «Rosario en blanco y negro»"));
  it("quién invita, el rol y qué permite, cómo se acepta y cuándo vence", () => {
    const todo = t.parrafos.join(" ");
    expect(todo).toMatch(/Daniela te invitó/);
    expect(todo).toMatch(/Textos y curaduría/);
    expect(todo).toMatch(/texto curatorial/);
    expect(todo).toMatch(/cuenta de Google/);
    expect(todo).toMatch(/vence el 10 nov/);
  });
  it("enlace para aceptar", () => {
    expect(t.enlace).toEqual({ texto: "Aceptar la invitación", url: "https://muestrasfotograficas.com/panel/equipo/invitacion/x" });
  });
});
