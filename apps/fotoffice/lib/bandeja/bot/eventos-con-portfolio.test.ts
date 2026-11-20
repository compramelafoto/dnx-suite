import { describe, expect, it } from "vitest";
import {
  elegirPaquete,
  estadoDeLaFecha,
  eventoDeCategoria,
  fraseDelPase,
  hoyEnArgentina,
  instruccionDelPase,
  mismoPaquete,
  PORTFOLIO_DE_EVENTOS,
  primerNombre,
  textoDeLaFecha,
  textoDePaquetes,
} from "./eventos-con-portfolio";

const AHORA = new Date("2026-11-20T15:00:00.000Z");
const PAQUETES = [
  { nombre: "Básico", total: 450000 },
  { nombre: "Intermedio", total: 620000 },
  { nombre: "Premium", total: 890000 },
];

describe("qué categoría es un evento con portfolio", () => {
  it("XV: la categoría de DNX y las otras formas de decirlo", () => {
    expect(eventoDeCategoria("Fotografía o Video de Cumpleaños de 15")).toBe("XV");
    expect(eventoDeCategoria("XV años")).toBe("XV");
    expect(eventoDeCategoria("Quinceañera")).toBe("XV");
  });

  it("bodas: Boda, bodas y casamientos, sin importar tildes ni mayúsculas", () => {
    expect(eventoDeCategoria("Boda")).toBe("BODA");
    expect(eventoDeCategoria("BODAS")).toBe("BODA");
    expect(eventoDeCategoria("Casamiento civil")).toBe("BODA");
  });

  it("los demás eventos siguen como hoy", () => {
    for (const c of ["Bautismo", "Cumpleaños infantil", "Evento", "Sesión de fotos", "Embodado", "", null]) expect(eventoDeCategoria(c)).toBeNull();
  });

  it("cada evento tiene su enlace de portfolio (el de XV es el mismo de la presentación)", () => {
    expect(PORTFOLIO_DE_EVENTOS.XV.enlace).toBe("https://www.compramelafoto.com/dnx/xv");
    expect(PORTFOLIO_DE_EVENTOS.BODA.enlace).toBe("https://www.compramelafoto.com/dnx/bodas");
  });
});

describe("fecha ocupada", () => {
  it("sin eventos contratados está libre; con alguno, el dueño ya tiene uno; con la capacidad llena, completa", () => {
    expect(estadoDeLaFecha(0, 2)).toBe("LIBRE");
    expect(estadoDeLaFecha(1, 2)).toBe("DUENO_OCUPADO");
    expect(estadoDeLaFecha(2, 2)).toBe("COMPLETA");
    expect(estadoDeLaFecha(3, 2)).toBe("COMPLETA");
    // Con capacidad 1, un evento ya la llena (no se promete otro fotógrafo).
    expect(estadoDeLaFecha(1, 1)).toBe("COMPLETA");
    // Una capacidad rara vale 1.
    expect(estadoDeLaFecha(1, 0)).toBe("COMPLETA");
  });

  it("el día de hoy es el de Argentina (a la medianoche UTC todavía es el día anterior)", () => {
    expect(hoyEnArgentina(new Date("2026-11-21T02:00:00.000Z"))).toBe("2026-11-20");
  });

  it("con el dueño ocupado da la frase con su nombre y el del estudio, y qué hacer si duda", () => {
    const t = textoDeLaFecha({ fecha: "2027-03-13", ahora: AHORA, estado: "DUENO_OCUPADO", dueno: "Daniel", estudio: "DNX Estudio" });
    expect(t).toContain("Ese día Daniel, el dueño de DNX Estudio, ya tiene un evento.");
    expect(t).toContain("somos un equipo de fotógrafos que trabajamos juntos y te garantizamos la misma calidad fotográfica y humana que nos caracteriza");
    expect(t).toContain("¿Te gustaría que avancemos igual?");
    expect(t).toContain("pasar_a_persona");
  });

  it("sin nombre del dueño ni del estudio no inventa ninguno", () => {
    const t = textoDeLaFecha({ fecha: "2027-03-13", ahora: AHORA, estado: "DUENO_OCUPADO", dueno: null, estudio: null });
    expect(t).toContain("Ese día el dueño del estudio ya tiene un evento.");
  });

  it("libre sigue con el portfolio; completa pasa a una persona; una fecha pasada se confirma", () => {
    expect(textoDeLaFecha({ fecha: "2027-03-13", ahora: AHORA, estado: "LIBRE", dueno: "Daniel", estudio: null })).toContain("paquetes_del_evento");
    expect(textoDeLaFecha({ fecha: "2027-03-13", ahora: AHORA, estado: "COMPLETA", dueno: "Daniel", estudio: null })).toContain('pasar_a_persona con el motivo "fecha completa: "');
    expect(textoDeLaFecha({ fecha: "2026-11-19", ahora: AHORA, estado: "LIBRE", dueno: null, estudio: null })).toContain("ya pasó");
    expect(textoDeLaFecha({ fecha: "2026-11-20", ahora: AHORA, estado: "LIBRE", dueno: null, estudio: null })).not.toContain("ya pasó");
  });
});

describe("qué paquete eligió", () => {
  it("reconoce el nombre sin tildes, con artículo o con 'pack'/'paquete'", () => {
    expect(mismoPaquete("Básico", "basico")).toBe(true);
    expect(mismoPaquete("Intermedio", "el intermedio")).toBe(true);
    expect(mismoPaquete("Premium", "Pack Premium")).toBe(true);
    expect(mismoPaquete("Premium", "paquete premium")).toBe(true);
    expect(mismoPaquete("Básico", "Intermedio")).toBe(false);
  });

  it("devuelve el paquete con su precio, o por qué no", () => {
    expect(elegirPaquete(PAQUETES, "intermedio")).toEqual({ ok: true, paquete: { nombre: "Intermedio", total: 620000 } });
    expect(elegirPaquete(PAQUETES, "Gold")).toEqual({ ok: false, motivo: "NO_ESTA" });
    expect(elegirPaquete([], "Básico")).toEqual({ ok: false, motivo: "SIN_PAQUETES" });
    expect(elegirPaquete([{ nombre: "Básico", total: 0 }], "Básico")).toEqual({ ok: false, motivo: "SIN_PAQUETES" });
    expect(elegirPaquete([{ nombre: "Básico", total: 1 }, { nombre: "Básico plus", total: 2 }], "basico")).toEqual({ ok: false, motivo: "AMBIGUO" });
  });

  it("el texto de los paquetes trae el enlace, los nombres y los precios con punto de miles", () => {
    const t = textoDePaquetes("BODA", PAQUETES);
    expect(t).toContain("https://www.compramelafoto.com/dnx/bodas");
    expect(t).toContain("Paquetes: Básico, Intermedio, Premium.");
    expect(t).toContain("- Intermedio: $620.000");
    expect(t).toContain("enviar_cotizacion_del_paquete");
    expect(t).toContain("preparar_presupuesto");
  });

  it("sin paquetes con precio pasa el enlace y no da precios", () => {
    const t = textoDePaquetes("XV", []);
    expect(t).toContain("https://www.compramelafoto.com/dnx/xv");
    expect(t).not.toMatch(/\$\s?\d/);
    expect(t).toContain("no digas ningún precio");
  });
});

describe("el pase a ventas", () => {
  it("con la responsable dice su nombre y que es de ventas; con el dueño, sólo el nombre", () => {
    expect(fraseDelPase("Giuli", true)).toBe("Te dejo con Giuli, de nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊");
    expect(fraseDelPase("Daniel", false)).toBe("Te dejo con Daniel, que te va a acompañar para cerrar todo 😊");
    expect(fraseDelPase(null, true)).toBe("Te dejo con nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊");
  });

  it("el primer nombre sale del nombre completo", () => {
    expect(primerNombre("Giuliana Pérez")).toBe("Giuliana");
    expect(primerNombre("  ")).toBeNull();
    expect(primerNombre(null)).toBeNull();
  });

  it("la instrucción pide terminar el mensaje con la frase tal cual", () => {
    expect(instruccionDelPase("Te dejo con Giuli 😊")).toContain('Terminá tu mensaje con esta frase (es la única vez que decís que sigue otra persona): "Te dejo con Giuli 😊"');
  });
});
