import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "./ruta-segura";

describe("rutaInternaSegura", () => {
  it("deja pasar rutas internas", () => expect(rutaInternaSegura("/proponer")).toBe("/proponer"));
  it("bloquea dominios externos", () => {
    expect(rutaInternaSegura("https://malo.com")).toBeUndefined();
    expect(rutaInternaSegura("//malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/\\malo.com")).toBeUndefined();
  });
  it("bloquea caracteres de control que el navegador descarta (tab, salto de línea)", () => {
    // `new URL("/\t/malo.com", origen)` termina en https://malo.com/: el tab se borra y queda "//".
    expect(rutaInternaSegura("/\t/malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/\n/malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/\r/malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/mis\u007f-muestras")).toBeUndefined();
  });
  it("\"%09\" llega ya decodificado por URLSearchParams y también se bloquea", () => {
    const next = new URLSearchParams("next=/%09/malo.com").get("next");
    expect(next).toBe("/\t/malo.com");
    expect(rutaInternaSegura(next)).toBeUndefined();
  });
  it("una ruta que sobrevive sigue siendo interna al resolverla", () => {
    const r = rutaInternaSegura("/mis-muestras?x=1");
    expect(new URL(r!, "https://muestrasfotograficas.com").origin).toBe("https://muestrasfotograficas.com");
  });
  it("vacío da undefined", () => expect(rutaInternaSegura(null)).toBeUndefined());
});
