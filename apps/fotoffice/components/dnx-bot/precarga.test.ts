import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * «Abrir para enviar» (tarjeta de mensaje de DNX Bot): el texto llega a la pantalla de envío por
 * sessionStorage, una sola vez (`tomarMensajePrecargado`), nunca por la dirección. Enviar lo hace
 * la persona con el botón de siempre.
 */
const leer = (f: string) => readFileSync(join(__dirname, "../..", f), "utf8");

describe("precarga del mensaje de DNX Bot", () => {
  it("el envío del presupuesto lo toma para ESE presupuesto y sólo abre el panel", () => {
    const s = leer("components/presupuestos/enviar-presupuesto.tsx");
    expect(s).toContain('tomarMensajePrecargado(almacen, "PRESUPUESTO", presupuestoId)');
    expect(s).not.toMatch(/useSearchParams|searchParams/);
    const efecto = s.slice(s.indexOf("tomarMensajePrecargado(almacen"), s.indexOf("return () => clearTimeout"));
    expect(efecto).not.toContain("enviarPresupuestoAction");
  });
  it("el mensaje de la ficha lo toma sólo en una consulta, lo completa con la ficha y no envía", () => {
    const s = leer("components/mensajes/panel-mensaje.tsx");
    expect(s).toContain('if (entityType !== "CONSULTA") return;');
    expect(s).toContain('tomarMensajePrecargado(almacen, "CONSULTA", entityId)');
    const funcion = s.slice(s.indexOf("function tomarYPreparar"), s.indexOf("function elegirPlantilla"));
    expect(funcion).toContain("prepararMensajeAction");
    expect(funcion).not.toMatch(/enviarCorreoAction|abrirWhatsappAction/);
    expect(s).not.toMatch(/useSearchParams|searchParams/);
  });
});
