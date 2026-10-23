import { describe, expect, it } from "vitest";
import { leerInvitados } from "./invitados";

describe("lista de invitados", () => {
  it("acepta correo solo, con coma, con <> y con tabulador", () => {
    const r = leerInvitados(
      [
        "ana@mail.com",
        "Luciano Pérez, LUCIANO@Mail.com",
        "Yesica Alvarez <yesi@mail.com>",
        "Paula Gomez\tpaula@mail.com",
      ].join("\n"),
    );
    expect(r.invitados).toEqual([
      { email: "ana@mail.com", nombre: "" },
      { email: "luciano@mail.com", nombre: "Luciano Pérez" },
      { email: "yesi@mail.com", nombre: "Yesica Alvarez" },
      { email: "paula@mail.com", nombre: "Paula Gomez" },
    ]);
    expect(r.descartados).toEqual([]);
  });

  it("no repite un correo y separa los renglones sin correo", () => {
    const r = leerInvitados("ana@mail.com\n\nAna@mail.com\nSin correo\n");
    expect(r.invitados).toHaveLength(1);
    expect(r.descartados).toEqual(["Sin correo"]);
  });
});
