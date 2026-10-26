import { describe, expect, it } from "vitest";
import {
  MAX_DETALLE,
  MAX_EXTRACTO,
  MAX_NOMBRE,
  MAX_TEXTO,
  esTablaFaltante,
  ordenarParaPublico,
  puedePublicar,
  validarTestimonio,
} from "./dominio";

const base = { texto: "Nos encantaron las fotos.", autorNombre: "Sofía Pérez" };

describe("validarTestimonio", () => {
  it("acepta lo mínimo (texto y nombre) y deja lo opcional en null", () => {
    expect(validarTestimonio(base)).toEqual({
      ok: true,
      datos: {
        texto: "Nos encantaron las fotos.",
        extracto: null,
        autorNombre: "Sofía Pérez",
        autorDetalle: null,
        autorEnlace: null,
        autorEmail: null,
        calificacion: null,
      },
    });
  });

  it("limpia espacios del nombre y del detalle, y conserva los párrafos del texto", () => {
    const r = validarTestimonio({ ...base, texto: "  Hola\r\n\r\n\r\n\r\nChau  ", autorNombre: "  Sofía   Pérez ", autorDetalle: " Novia ,  Rosario " });
    expect(r.ok && r.datos).toMatchObject({ texto: "Hola\n\nChau", autorNombre: "Sofía Pérez", autorDetalle: "Novia , Rosario" });
  });

  it("rechaza texto vacío, nombre vacío y largos de más, con un error por campo", () => {
    const r = validarTestimonio({
      texto: "x".repeat(MAX_TEXTO + 1),
      autorNombre: "",
      extracto: "x".repeat(MAX_EXTRACTO + 1),
      autorDetalle: "x".repeat(MAX_DETALLE + 1),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errores).sort()).toEqual(["autorDetalle", "autorNombre", "extracto", "texto"]);
    expect(validarTestimonio({ texto: "   ", autorNombre: "x".repeat(MAX_NOMBRE + 1) })).toMatchObject({ ok: false, errores: { texto: expect.any(String), autorNombre: expect.any(String) } });
  });

  it("los largos justos entran", () => {
    expect(validarTestimonio({ texto: "x".repeat(MAX_TEXTO), autorNombre: "y".repeat(MAX_NOMBRE), extracto: "z".repeat(MAX_EXTRACTO), autorDetalle: "w".repeat(MAX_DETALLE) }).ok).toBe(true);
  });

  it("calificación: 1 a 5 entera u omitida; fuera de rango es un error", () => {
    for (const c of [1, 5, "3"]) expect(validarTestimonio({ ...base, calificacion: c })).toMatchObject({ ok: true, datos: { calificacion: Number(c) } });
    for (const c of [null, undefined, ""]) expect(validarTestimonio({ ...base, calificacion: c })).toMatchObject({ ok: true, datos: { calificacion: null } });
    for (const c of [0, 6, 2.5, -1, "diez"]) expect(validarTestimonio({ ...base, calificacion: c })).toMatchObject({ ok: false, errores: { calificacion: expect.any(String) } });
  });

  it("el enlace del autor sólo puede ser http(s); un @usuario se vuelve su Instagram", () => {
    expect(validarTestimonio({ ...base, autorEnlace: "https://sofi.com.ar" })).toMatchObject({ ok: true, datos: { autorEnlace: "https://sofi.com.ar/" } });
    expect(validarTestimonio({ ...base, autorEnlace: "@sofi.fotos" })).toMatchObject({ ok: true, datos: { autorEnlace: "https://instagram.com/sofi.fotos" } });
    for (const e of ["javascript:alert(1)", "ftp://x.com", "no es un enlace"]) {
      expect(validarTestimonio({ ...base, autorEnlace: e })).toMatchObject({ ok: false, errores: { autorEnlace: expect.any(String) } });
    }
  });

  it("el correo es opcional pero, si viene, tiene que tener forma de correo", () => {
    expect(validarTestimonio({ ...base, autorEmail: " Sofi@Mail.com " })).toMatchObject({ ok: true, datos: { autorEmail: "sofi@mail.com" } });
    expect(validarTestimonio({ ...base, autorEmail: "sofi" })).toMatchObject({ ok: false, errores: { autorEmail: expect.any(String) } });
  });
});

describe("puedePublicar", () => {
  const t = { consentimiento: true, texto: "Hermoso", autorNombre: "Sofi" };

  it("con permiso del autor, texto y nombre: se puede", () => {
    expect(puedePublicar(t)).toBeNull();
  });

  it("sin consentimiento nunca se publica", () => {
    expect(puedePublicar({ ...t, consentimiento: false })).toMatch(/permiso/);
  });

  it("sin texto o sin nombre tampoco", () => {
    expect(puedePublicar({ ...t, texto: "  " })).not.toBeNull();
    expect(puedePublicar({ ...t, autorNombre: "" })).not.toBeNull();
  });
});

describe("ordenarParaPublico", () => {
  const filas = [
    { id: "d1", destacado: true },
    { id: "d2", destacado: true },
    { id: "a", destacado: false },
    { id: "b", destacado: false },
    { id: "c", destacado: false },
  ];

  it("sin barajar respeta el orden recibido, con los destacados primero", () => {
    const desordenadas = [filas[2]!, filas[0]!, filas[3]!, filas[1]!, filas[4]!];
    expect(ordenarParaPublico(desordenadas, false).map((f) => f.id)).toEqual(["d1", "d2", "a", "b", "c"]);
  });

  it("barajando, los destacados siguen primero y en su orden; sólo se mezcla el resto", () => {
    // Azar fijo: siempre 0 → cada paso cambia con la primera posición.
    const r = ordenarParaPublico(filas, true, () => 0).map((f) => f.id);
    expect(r.slice(0, 2)).toEqual(["d1", "d2"]);
    expect(r.slice(2).sort()).toEqual(["a", "b", "c"]);
    expect(r.slice(2)).not.toEqual(["a", "b", "c"]);
  });

  it("no modifica la lista que recibe", () => {
    const copia = [...filas];
    ordenarParaPublico(filas, true, () => 0.5);
    expect(filas).toEqual(copia);
  });
});

describe("esTablaFaltante", () => {
  it("reconoce el P2021 de Prisma (tabla todavía no creada)", () => {
    expect(esTablaFaltante(Object.assign(new Error("x"), { code: "P2021" }))).toBe(true);
    expect(esTablaFaltante(new Error("x"))).toBe(false);
  });
});
