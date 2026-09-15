import { describe, expect, test } from "vitest";
import {
  cuitNormalizado,
  dominioDeSitio,
  correoNormalizado,
  nombreNormalizado,
  usuarioDeInstagram,
} from "./normalizar";

describe("el CUIT", () => {
  test("se queda con los dígitos", () => {
    expect(cuitNormalizado("30-71234567-4")).toBe("30712345674");
    expect(cuitNormalizado("30 71234567 4")).toBe("30712345674");
  });

  test("uno que no tiene once dígitos no sirve para comparar", () => {
    expect(cuitNormalizado("3071234567")).toBeNull();
    expect(cuitNormalizado("no tengo")).toBeNull();
    expect(cuitNormalizado(null)).toBeNull();
  });
});

describe("el correo", () => {
  test("se compara en minúscula y sin espacios", () => {
    expect(correoNormalizado("  Hola@SalonLuna.com.ar ")).toBe("hola@salonluna.com.ar");
  });

  test("algo que no parece correo no sirve", () => {
    expect(correoNormalizado("hola")).toBeNull();
    expect(correoNormalizado("")).toBeNull();
  });
});

describe("Instagram", () => {
  test("saca el arroba", () => {
    expect(usuarioDeInstagram("@SalonLuna")).toBe("salonluna");
  });

  test("entiende la dirección completa", () => {
    expect(usuarioDeInstagram("https://www.instagram.com/salon.luna/")).toBe("salon.luna");
    expect(usuarioDeInstagram("instagram.com/salon.luna?hl=es")).toBe("salon.luna");
  });

  test("vacío no sirve", () => {
    expect(usuarioDeInstagram("@")).toBeNull();
    expect(usuarioDeInstagram(null)).toBeNull();
  });
});

describe("el sitio", () => {
  test("se compara por dominio, sin www ni ruta", () => {
    expect(dominioDeSitio("https://www.SalonLuna.com.ar/contacto")).toBe("salonluna.com.ar");
    expect(dominioDeSitio("salonluna.com.ar")).toBe("salonluna.com.ar");
  });

  test("algo sin punto no es un dominio", () => {
    expect(dominioDeSitio("proximamente")).toBeNull();
  });
});

describe("el nombre", () => {
  test("ignora acentos, mayúsculas y puntuación", () => {
    expect(nombreNormalizado("Salón Luna")).toBe("salon luna");
    expect(nombreNormalizado("SALON  LUNA!")).toBe("salon luna");
  });

  test("ignora la forma societaria", () => {
    expect(nombreNormalizado("Salón Luna S.R.L.")).toBe("salon luna");
    expect(nombreNormalizado("Salon Luna SA")).toBe("salon luna");
    expect(nombreNormalizado("Salon Luna S.A.S.")).toBe("salon luna");
  });

  test("no se come una palabra que apenas se parece a una forma societaria", () => {
    expect(nombreNormalizado("Sabores del Sur")).toBe("sabores del sur");
    expect(nombreNormalizado("Casa Sar")).toBe("casa sar");
  });

  test("un nombre vacío no sirve para comparar", () => {
    expect(nombreNormalizado("  ")).toBeNull();
    expect(nombreNormalizado("S.R.L.")).toBeNull();
  });
});
