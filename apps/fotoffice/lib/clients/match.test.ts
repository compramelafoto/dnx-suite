import { describe, expect, it } from "vitest";
import { matchExistingClient } from "./match";

const juan = { id: "c1", docNumber: "12345678", email: "juan@casa.com", phone: "3411234567" };
const ana = { id: "c2", docNumber: null, email: "ana@casa.com", phone: null };
const pedro = { id: "c3", docNumber: null, email: null, phone: "3417654321" };

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

  it("si el documento de uno y el correo de otro compiten, gana el documento", () => {
    // A diferencia de "el documento manda por encima de todo", acá el correo SÍ pertenece
    // a un candidato real (Ana). Si el orden de prioridad se invirtiera, esta prueba
    // devolvería a Ana en lugar de a Juan y lo delataría.
    const r = matchExistingClient([juan, ana], { docNumber: juan.docNumber, email: ana.email });
    expect(r?.id).toBe("c1");
  });

  it("si el correo de uno y el teléfono de otro compiten, gana el correo", () => {
    // Ana sólo tiene correo y Pedro sólo tiene teléfono: ambos matchean con datos reales,
    // así que si se invirtiera el orden (teléfono antes que correo) devolvería a Pedro.
    const r = matchExistingClient([ana, pedro], { email: ana.email, phone: pedro.phone });
    expect(r?.id).toBe("c2");
  });
});
