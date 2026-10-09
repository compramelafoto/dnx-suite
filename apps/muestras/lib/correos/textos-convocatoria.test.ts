import { describe, expect, it } from "vitest";
import {
  textoConvocatoriaCerrada, textoEnvioRecibido, textoInvitacionCurador, textoNoSeleccionada, textoSeleccionada,
} from "./textos-convocatoria";

const appUrl = "https://muestrasfotograficas.com";

describe("correos de convocatoria", () => {
  it("envío recibido: cuántas obras y hasta cuándo se puede cambiar", () => {
    const t = textoEnvioRecibido({ nombre: "Ana", convocatoria: "Ciudad", obras: 2, cierre: new Date("2026-12-01T02:59:59.999Z"), appUrl });
    expect(t.parrafos.join(" ")).toMatch(/tus 2 obras/);
    expect(t.parrafos.join(" ")).toMatch(/30 nov/);
    expect(t.enlace.url).toBe(`${appUrl}/panel/envios`);
  });
  it("cierre: avisa que la mirada es anónima", () => {
    expect(textoConvocatoriaCerrada({ nombre: null, convocatoria: "Ciudad", appUrl }).parrafos.join(" ")).toMatch(/sin ver los nombres/);
  });
  it("seleccionada: nombra las obras", () => {
    const t = textoSeleccionada({ nombre: "Ana", convocatoria: "Ciudad", titulos: ["Puerto", "Río", "Islas"], appUrl });
    expect(t.subject).toBe('Tus obras quedaron seleccionadas para "Ciudad"');
    expect(t.parrafos[1]).toContain("“Puerto”, “Río” y “Islas”");
  });
  it("no seleccionada: tono amable, sin la palabra rechazada", () => {
    const t = textoNoSeleccionada({ nombre: "Ana", convocatoria: "Ciudad", recibidas: 120, elegidas: 30, appUrl });
    const todo = [t.subject, ...t.parrafos].join(" ").toLowerCase();
    expect(todo).not.toMatch(/rechaz/);
    expect(todo).toMatch(/gracias/);
    expect(todo).toMatch(/120 obras/);
  });
  it("invitación: quién invita, cómo se acepta y cuándo vence", () => {
    const t = textoInvitacionCurador({ convocatoria: "Ciudad", organizador: "Daniel", url: `${appUrl}/panel/curaduria/invitacion/x`, vence: new Date("2026-11-10T15:00:00Z") });
    expect(t.parrafos.join(" ")).toMatch(/Daniel te invita/);
    expect(t.parrafos.join(" ")).toMatch(/10 nov/);
    expect(t.enlace.texto).toBe("Aceptar la invitación");
  });
});
