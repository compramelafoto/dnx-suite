import { describe, expect, it } from "vitest";
import { cifrasNoRespaldadas } from "@/lib/dnx-bot/cifras";
import { cifrasRespaldadasEnAtencion } from "./cifras-atencion";
import { herramientasDeAtencion } from "./herramientas";
import { ENLACE_PORTFOLIO_XV, esCategoriaXv, pesosConPunto, precioDesde, textoPresentacionXv } from "./presentacion-xv";

describe("presentación de XV", () => {
  it("reconoce las categorías de XV", () => {
    for (const n of ["XV años", "15 años", "Fiesta de 15", "Quinceañera", "Cobertura XV"]) expect(esCategoriaXv(n)).toBe(true);
    for (const n of ["Casamiento", "Cumpleaños", "Sesión 150 fotos", "Bautismo"]) expect(esCategoriaXv(n)).toBe(false);
  });

  it("el desde es el menor total positivo, redondeado; sin totales, null", () => {
    expect(precioDesde([620000, 450000.4, 800000])).toBe(450000);
    expect(precioDesde([0, -5, Number.NaN])).toBeNull();
    expect(precioDesde([])).toBeNull();
  });

  it("los pesos van con punto de miles", () => {
    expect(pesosConPunto(450000)).toBe("$450.000");
    expect(pesosConPunto(1294000)).toBe("$1.294.000");
    expect(pesosConPunto(900)).toBe("$900");
  });

  it("con precio: enlace y desde; sin precio: enlace y la orden de no decir ninguno", () => {
    const con = textoPresentacionXv(450000);
    expect(con).toContain(ENLACE_PORTFOLIO_XV);
    expect(con).toContain("desde $450.000");
    const sin = textoPresentacionXv(null);
    expect(sin).toContain(ENLACE_PORTFOLIO_XV);
    expect(sin).toMatch(/no digas ningún precio/);
    expect(sin).not.toMatch(/\$/);
  });

  it("la herramienta presentacion_xv devuelve el desde que calcula el estudio", async () => {
    const { tools } = herramientasDeAtencion("ws1", { precioDesdeXv: async () => 450000 });
    const t = tools.find((x) => x.name === "presentacion_xv")!;
    const r = (await t.run({}, {} as never)) as { message: string };
    expect(r.message).toContain("desde $450.000");
  });

  it("si el cálculo falla, la herramienta no da precio", async () => {
    const { tools } = herramientasDeAtencion("ws1", { precioDesdeXv: async () => { throw new Error("x"); } });
    const r = (await tools.find((x) => x.name === "presentacion_xv")!.run({}, {} as never)) as { message: string };
    expect(r.message).not.toMatch(/\$/);
  });

  it("control de cifras: el desde de la herramienta pasa; otro número no", () => {
    const appended = [{ role: "user", content: [{ type: "tool_result", content: textoPresentacionXv(450000) }] }];
    const bien = `¡Hola Laura! Gracias por escribirnos 😊 Acá podés ver fotos de fiestas de XV que hicimos y nuestros paquetes: ${ENLACE_PORTFOLIO_XV} ✨ La cobertura arranca desde $450.000. ¿Para qué fecha es la fiesta? 🎉`;
    expect(cifrasNoRespaldadas(bien, cifrasRespaldadasEnAtencion([], appended, bien))).toEqual([]);
    const mal = bien.replace("$450.000", "$380.000");
    expect(cifrasNoRespaldadas(mal, cifrasRespaldadasEnAtencion([], appended, mal))).toEqual(["$380000"]);
  });
});
