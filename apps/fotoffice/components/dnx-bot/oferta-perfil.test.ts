import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La oferta usa la decisión pura (`debeOfrecerBot`, con sus pruebas) y abre el bot con el contexto del perfil. */
describe("OfertaArmarConversando (fuente)", () => {
  const s = readFileSync(join(__dirname, "oferta-perfil.tsx"), "utf8");
  const form = readFileSync(join(__dirname, "../../app/workspace/configuracion/precios/perfil-form.tsx"), "utf8");
  it("decide con debeOfrecerBot y cuenta visitas en localStorage", () => {
    expect(s).toContain("debeOfrecerBot({");
    expect(s).toContain("registrarVisita(almacen, workspaceId, perfilCompleto)");
    expect(s).toContain("window.localStorage");
  });
  it("abre el bot para armar el perfil (abrirDnxBot) y tiene «Prefiero seguir yo» y el enlace de los datos", () => {
    expect(s).toContain('abrirDnxBot({ texto: OFERTA.mensajeAlBot, contexto: { pantalla: "precios" } })');
    expect(s).toContain("setDescartada(true)");
    expect(s).toContain("ENLACE_DATOS.ruta");
  });
  it("el formulario marca «trabado» al fallar la validación o al guardar incompleto, y pasa si está completo", () => {
    expect(form.match(/setGuardadoTrabado\(true\)/g)).toHaveLength(3);
    expect(form).toContain("perfilCompleto={resumen.completo}");
  });
});
