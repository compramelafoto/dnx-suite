import { describe, expect, it } from "vitest";
import { matchExistingClient } from "./match";

const juan = { id: "c1", docNumber: "12345678", email: "juan@casa.com", phone: "3411234567" };
const ana = { id: "c2", docNumber: null, email: "ana@casa.com", phone: null };

describe("matchExistingClient", () => {
  it("el documento manda por encima de todo", () => {
    const r = matchExistingClient([juan, ana], { docNumber: "12345678", email: "otro@casa.com" });
    expect(r?.id).toBe("c1");
  });

  it("sin documento, empareja por correo", () => {
    expect(matchExistingClient([juan, ana], { email: "ana@casa.com" })?.id).toBe("c2");
  });

  it("el correo empareja sin importar mayúsculas ni espacios", () => {
    expect(matchExistingClient([juan, ana], { email: "  ANA@casa.com " })?.id).toBe("c2");
  });

  it("sin documento ni correo, empareja por teléfono", () => {
    expect(matchExistingClient([juan, ana], { phone: "3411234567" })?.id).toBe("c1");
  });

  it("el teléfono empareja ignorando guiones, espacios y paréntesis", () => {
    expect(matchExistingClient([juan, ana], { phone: "(341) 123-4567" })?.id).toBe("c1");
  });

  it("sin ningún dato de contacto no empareja con nadie", () => {
    expect(matchExistingClient([juan, ana], {})).toBeNull();
  });

  it("un dato que no coincide con nadie devuelve null en vez del primero de la lista", () => {
    expect(matchExistingClient([juan, ana], { email: "pedro@casa.com" })).toBeNull();
  });

  it("nunca empareja por un campo nulo del candidato", () => {
    // Ana no tiene documento: pedir por documento nulo no puede devolverla.
    expect(matchExistingClient([ana], { docNumber: null, email: null, phone: null })).toBeNull();
  });
});
