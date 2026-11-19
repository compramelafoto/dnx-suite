import { describe, expect, it } from "vitest";
import { armarTexto, contarVariables, describirEvento, parsearPlantillas, sugerirValores, urlDelBoton, validarValores } from "./plantillas-puro";

const META = {
  data: [
    {
      name: "retomar_consulta", language: "es_AR", status: "APPROVED", category: "MARKETING",
      components: [{ type: "BODY", text: "¡Hola {{1}}! Te escribo por tu consulta sobre {{2}}.", example: { body_text: [["Martina", "los 15 del 12/12/2026"]] } }],
    },
    {
      name: "coordinar_entrevista", language: "es_AR", status: "APPROVED", category: "MARKETING",
      components: [
        { type: "BODY", text: "¡Hola {{1}}! Elegí el día desde el botón." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Elegir día y hora", url: "https://fotoffice.com/w/dnx-estudio/turnos" }] },
      ],
    },
    {
      name: "recordatorio_pago", language: "es_AR", status: "APPROVED", category: "UTILITY",
      components: [
        { type: "BODY", text: "Hola {{1}}, tu pedido N° {{2}} quedó pendiente ({{3}})." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Pagar", url: "https://fotoffice.com/p/{{1}}" }] },
      ],
    },
    { name: "en_revision", language: "es_AR", status: "PENDING", category: "MARKETING", components: [{ type: "BODY", text: "Hola" }] },
    { name: "con_imagen", language: "es_AR", status: "APPROVED", category: "MARKETING", components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hola" }] },
    { name: "con_codigo", language: "es_AR", status: "APPROVED", category: "MARKETING", components: [{ type: "BODY", text: "Hola" }, { type: "BUTTONS", buttons: [{ type: "COPY_CODE", text: "Copiar" }] }] },
    { name: "con_nombre", language: "es_AR", status: "APPROVED", category: "UTILITY", components: [{ type: "BODY", text: "Hola {{nombre}}" }] },
    "basura",
  ],
};

describe("lista de Meta", () => {
  it("sólo las aprobadas que se pueden completar, ordenadas por nombre", () => {
    const p = parsearPlantillas(META);
    expect(p.map((x) => x.nombre)).toEqual(["coordinar_entrevista", "recordatorio_pago", "retomar_consulta"]);
    const retomar = p.find((x) => x.nombre === "retomar_consulta")!;
    expect(retomar).toMatchObject({ idioma: "es_AR", categoria: "MARKETING", variables: 2, ejemplos: ["Martina", "los 15 del 12/12/2026"], boton: null });
    expect(p.find((x) => x.nombre === "coordinar_entrevista")!.boton).toEqual({ texto: "Elegir día y hora", url: "https://fotoffice.com/w/dnx-estudio/turnos", dinamico: false });
    expect(p.find((x) => x.nombre === "recordatorio_pago")!.boton?.dinamico).toBe(true);
  });

  it("tolera respuestas vacías o rotas", () => {
    expect(parsearPlantillas(null)).toEqual([]);
    expect(parsearPlantillas({ data: "x" })).toEqual([]);
    expect(parsearPlantillas({ error: { code: 190 } })).toEqual([]);
  });
});

describe("texto y valores", () => {
  it("cuenta variables y arma el texto; lo que falta se nota", () => {
    expect(contarVariables("Hola {{1}}, {{3}} y {{2}}")).toBe(3);
    expect(contarVariables("Hola")).toBe(0);
    expect(armarTexto("Hola {{1}}, tu {{2}}", ["Ana", ""])).toBe("Hola Ana, tu [2]");
    expect(urlDelBoton("https://x.com/p/{{1}}", " abc ")).toBe("https://x.com/p/abc");
  });

  it("propone el nombre de pila y, en las conocidas, el evento o la cita", () => {
    const datos = { nombre: "Martina López", categoria: "Fotografía o Video de Cumpleaños de 15", fechaEvento: new Date("2026-12-12T00:00:00.000Z"), proximaCita: new Date("2026-11-20T20:00:00.000Z") };
    expect(sugerirValores({ nombre: "retomar_consulta", variables: 2 }, datos)).toEqual(["Martina", "los 15 del 12/12/2026"]);
    expect(sugerirValores({ nombre: "seguimiento_cotizacion", variables: 2 }, datos)).toEqual(["Martina", "tus 15"]);
    expect(sugerirValores({ nombre: "recordatorio_entrevista", variables: 3 }, datos)).toEqual(["Martina", "viernes 20/11", "17:00"]);
    expect(sugerirValores({ nombre: "otra", variables: 3 }, datos)).toEqual(["Martina", "", ""]);
    expect(sugerirValores({ nombre: "retomar_consulta", variables: 2 }, { nombre: null, categoria: "Boda", fechaEvento: null, proximaCita: null })).toEqual(["", "el casamiento"]);
  });

  it("describe el evento con artículo", () => {
    expect(describirEvento(null, null)).toBe("tu evento");
    expect(describirEvento("Sesión de Fotos", null)).toBe("la sesión de fotos");
    expect(describirEvento("Graduación", new Date("2026-12-15T00:00:00.000Z"))).toBe("la graduación del 15/12/2026");
  });

  it("valida los valores: cantidad, vacíos, largo y saltos de línea", () => {
    expect(validarValores(2, ["Ana", " los  15\n del 12/12 "])).toEqual({ ok: true, valores: ["Ana", "los 15 del 12/12"] });
    expect(validarValores(2, ["Ana"])).toMatchObject({ ok: false });
    expect(validarValores(1, [" "])).toMatchObject({ ok: false });
    expect(validarValores(1, ["a".repeat(201)])).toMatchObject({ ok: false });
    expect(validarValores(1, "Ana")).toMatchObject({ ok: false });
    expect(validarValores(0, [])).toEqual({ ok: true, valores: [] });
  });
});
