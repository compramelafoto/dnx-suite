import { describe, expect, it } from "vitest";
import { normalizarInstagram, validarInscripcion } from "./inscripcion";
import { rutaDeEntrada, slugDeEvento, tokenDeEntrada, tokenDeEntradaValido } from "./enlace";

function fd(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

const completo = { nombre: "María Gómez", email: "maria@ejemplo.com", dni: "30.123.456", instagram: "@Maria.Gomez", terminos: "on", imagen: "on" };

describe("validarInscripcion", () => {
  it("acepta los datos completos y normaliza DNI e Instagram", () => {
    const r = validarInscripcion(fd(completo), { pideFoto: true, tieneFoto: true, correoObligatorio: true });
    expect(r.ok && r.datos).toMatchObject({ dni: "30123456", instagram: "maria.gomez", email: "maria@ejemplo.com" });
  });
  it("pide la foto si el evento la pide y no la subió", () => {
    const r = validarInscripcion(fd(completo), { pideFoto: true, tieneFoto: false, correoObligatorio: false });
    expect(r.ok ? null : r.errores.foto).toMatch(/foto/);
  });
  it("con foto exige el permiso de uso de imagen", () => {
    const r = validarInscripcion(fd({ ...completo, imagen: "" }), { pideFoto: false, tieneFoto: true, correoObligatorio: false });
    expect(r.ok ? null : r.errores.imagen).toBeTruthy();
  });
  it("sin foto pedida ni subida no exige el permiso de imagen", () => {
    const r = validarInscripcion(fd({ ...completo, imagen: "" }), { pideFoto: false, tieneFoto: false, correoObligatorio: false });
    expect(r.ok).toBe(true);
  });
  it("sin aceptar las condiciones no se inscribe", () => {
    const r = validarInscripcion(fd({ ...completo, terminos: "" }), { pideFoto: false, tieneFoto: true, correoObligatorio: false });
    expect(r.ok ? null : r.errores.terminos).toBeTruthy();
  });
  it("en la página pública el correo es obligatorio", () => {
    const r = validarInscripcion(fd({ ...completo, email: "" }), { pideFoto: false, tieneFoto: true, correoObligatorio: true });
    expect(r.ok ? null : r.errores.email).toBeTruthy();
  });
});

describe("normalizarInstagram", () => {
  it("saca la arroba, la dirección y las mayúsculas", () => {
    expect(normalizarInstagram("https://www.instagram.com/Juan.Perez/?hl=es")).toBe("juan.perez");
    expect(normalizarInstagram("@@juan_p")).toBe("juan_p");
    expect(normalizarInstagram("no vale con espacios")).toBeNull();
  });
});

describe("enlace de entrada", () => {
  const clave = "clave-de-prueba-de-32-caracteres!!";
  it("el token es del inscripto y se valida en tiempo constante", () => {
    const t = tokenDeEntrada("insc_1", clave);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenDeEntradaValido("insc_1", t, clave)).toBe(true);
    expect(tokenDeEntradaValido("insc_2", t, clave)).toBe(false);
    expect(tokenDeEntradaValido("insc_1", "corto", clave)).toBe(false);
  });
  it("la ruta lleva el código y el token", () => {
    expect(rutaDeEntrada("AB7K2M", "x")).toBe("/entrada/AB7K2M?t=x");
  });
  it("el slug del evento queda limpio", () => {
    expect(slugDeEvento("Rafaela en Foco 2027 — Preventa")).toBe("rafaela-en-foco-2027-preventa");
  });
});
