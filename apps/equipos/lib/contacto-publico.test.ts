import { afterEach, describe, expect, it } from "vitest";
import { contactoEmail, contactoMailto } from "./contacto-publico";

afterEach(() => {
  delete process.env.CONTACTO_EMAIL;
});

describe("contactoMailto", () => {
  it("con CONTACTO_EMAIL arma el mailto con el asunto codificado", () => {
    process.env.CONTACTO_EMAIL = " hola@mercadofotoraw.com ";
    expect(contactoEmail()).toBe("hola@mercadofotoraw.com");
    expect(contactoMailto("Serie con denuncia")).toBe(
      "mailto:hola@mercadofotoraw.com?subject=Serie%20con%20denuncia",
    );
  });

  it("sin variable, o con un valor que no es un correo, devuelve null", () => {
    expect(contactoMailto("x")).toBeNull();
    process.env.CONTACTO_EMAIL = "no es un correo";
    expect(contactoMailto("x")).toBeNull();
    process.env.CONTACTO_EMAIL = "a@b.com?bcc=otro@x.com";
    expect(contactoEmail()).toBeNull();
  });
});
