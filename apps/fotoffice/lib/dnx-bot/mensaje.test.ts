import { describe, expect, it } from "vitest";
import { validarMensajeDelBot } from "./mensaje";

const PRES = { destino: "PRESUPUESTO" as const, canal: "WHATSAPP" as const };

describe("validarMensajeDelBot", () => {
  it("un mensaje con variables conocidas y el enlace pasa", () => {
    const r = validarMensajeDelBot({ ...PRES, cuerpo: "¡Hola [nombre]! Te paso el presupuesto: [presupuesto_enlace]. Total: [presupuesto_total]." });
    expect(r).toEqual({ ok: true, avisos: [] });
  });
  it("con destino presupuesto exige [presupuesto_enlace]", () => {
    const r = validarMensajeDelBot({ ...PRES, cuerpo: "¡Hola [nombre]! ¿Pudiste verlo?" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(" ")).toMatch(/\[presupuesto_enlace\]/);
  });
  it("rechaza montos y porcentajes escritos a mano: van con [presupuesto_total]", () => {
    const r = validarMensajeDelBot({ ...PRES, cuerpo: "Hola [nombre], el total es $1.294.000 con 10 % de descuento: [presupuesto_enlace]" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(" ")).toMatch(/\[presupuesto_total\]/);
  });
  it("rechaza variables que no existen o que no son de ese destino", () => {
    const a = validarMensajeDelBot({ ...PRES, cuerpo: "Hola [apodo]: [presupuesto_enlace]" });
    expect(a.ok).toBe(false);
    const b = validarMensajeDelBot({ destino: "CONSULTA", canal: "EMAIL", asunto: "Tu consulta", cuerpo: "Hola [nombre], mirá [presupuesto_enlace]" });
    expect(b.ok).toBe(false);
  });
  it("consulta: no exige enlace; avisa si quedó un texto en mayúsculas para completar", () => {
    const r = validarMensajeDelBot({ destino: "CONSULTA", canal: "WHATSAPP", cuerpo: "Hola [nombre], ¿para cuántas personas es? [COMPLETAR HORARIO]" });
    expect(r).toEqual({ ok: true, avisos: ["Quedó un texto entre corchetes para completar a mano antes de enviar."] });
  });
  it("correo sin asunto o mensaje vacío o larguísimo: no", () => {
    expect(validarMensajeDelBot({ destino: "CONSULTA", canal: "EMAIL", cuerpo: "Hola [nombre]" }).ok).toBe(false);
    expect(validarMensajeDelBot({ ...PRES, cuerpo: "   " }).ok).toBe(false);
    expect(validarMensajeDelBot({ ...PRES, cuerpo: `[presupuesto_enlace] ${"a".repeat(4001)}` }).ok).toBe(false);
  });
  it("nunca deja pasar un correo o un teléfono escrito en el texto", () => {
    const r = validarMensajeDelBot({ ...PRES, cuerpo: "Hola [nombre], escribime a yo@x.com o al 3415551234: [presupuesto_enlace]" });
    expect(r.ok).toBe(false);
  });
});
