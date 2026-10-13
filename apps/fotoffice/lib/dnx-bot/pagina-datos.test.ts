import { describe, expect, it } from "vitest";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/content";
import { DIAS_DE_RETENCION } from "./limpieza";
import { MAX_MENSAJE_CLIENTE } from "./redactar";
import { SECCIONES_DATOS, TITULO_DATOS } from "./pagina-datos";

/** Cada afirmación de «Cómo cuidamos tus datos» tiene que ser verdad en el código. */
const todo = () => SECCIONES_DATOS.flatMap((s) => [s.titulo, ...s.puntos]).join("\n");

describe("Cómo cuidamos tus datos", () => {
  it("título y las secciones pedidas", () => {
    expect(TITULO_DATOS).toBe("Cómo cuidamos tus datos");
    expect(SECCIONES_DATOS.map((s) => s.titulo)).toEqual([
      "Qué se guarda",
      "Quién lo ve",
      "Quién procesa lo que escribís",
      "Los datos de tus clientes",
      "Nada sin tu confirmación",
      "Cuándo se borra",
    ]);
  });
  it("los 90 días son los de la limpieza automática", () => {
    expect(DIAS_DE_RETENCION).toBe(90);
    expect(todo()).toContain(`${DIAS_DE_RETENCION} días sin actividad`);
  });
  it("para borrar antes, el contacto que ya usa FOTOFFICE (no uno inventado)", () => {
    expect(todo()).toContain(LEGAL_CONTACT_EMAIL);
  });
  it("Anthropic, como lo dicen las condiciones del servicio", () => {
    expect(todo()).toContain("Anthropic (Claude)");
    expect(todo()).toContain("según las condiciones del servicio que contratamos, no lo usa para entrenar sus modelos");
  });
  it("del cliente sólo el nombre de pila; lo demás se tapa (redactar.ts)", () => {
    expect(MAX_MENSAJE_CLIENTE).toBeGreaterThan(0);
    expect(todo()).toMatch(/sólo le llega el nombre de pila/);
    expect(todo()).toMatch(/correo, un teléfono, un DNI o un enlace, se tapan/);
  });
  it("nada sin confirmar y el bot nunca le escribe a tus clientes", () => {
    expect(todo()).toContain("«Confirmar»");
    expect(todo()).toMatch(/Nunca le manda mensajes a tus clientes/);
  });
  it("no promete lo que no es cierto: la conversación no tiene pantalla donde otro la lea", () => {
    expect(todo()).toMatch(/La conversación: sólo vos/);
    expect(todo()).toMatch(/sólo si nos pedís ayuda/);
  });
});
