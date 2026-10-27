import { describe, expect, it } from "vitest";
import {
  createEmptyBlock,
  formConfigSchema,
  newsletterConfigSchema,
  parseWebsiteSections,
  websiteBlockSchema,
  type FormBlockConfig,
  type FormField,
} from "./blocks";
import {
  buscarBloquePublicado,
  camposConClave,
  configPublicaDelFormulario,
  contactoPorEtiquetas,
  contenidoRevelado,
  datosDeEnvioJson,
  emailValido,
  fechaDesconocidaDeJson,
  enlaceSeguroDelFormulario,
  filtrosDeLaBandeja,
  hrefDeLaBandeja,
  mensajeDeConsulta,
  nombreDelInput,
  paginaUrlDe,
  paresDeJson,
  validarEnvio,
} from "./formularios";
import { armarCsv, celdaCsv, csvDeEnvios, csvDeSuscriptores, nombreDeArchivoCsv, neutralizarFormula } from "./formularios-csv";
import { deriveHomeNavItems } from "./navigation";

const campo = (id: string, type: FormField["type"], label: string, extra: Partial<FormField> = {}): FormField => ({
  id,
  type,
  label,
  required: false,
  help: "",
  options: [],
  ...extra,
});

function configCon(fields: FormField[], extra: Partial<FormBlockConfig> = {}): FormBlockConfig {
  return { ...formConfigSchema.parse({}), fields, ...extra };
}

/** Lee un envío como lo haría el servidor con un FormData. */
const lector = (valores: Record<string, string>) => (nombre: string) => valores[nombre] ?? null;

describe("schemas de FORM y NEWSLETTER", () => {
  it("una config vacía o rota cae en valores seguros", () => {
    const c = formConfigSchema.parse({ fields: "x", afterSubmit: "explotar", createInquiry: "sí", buttonLabel: 3 });
    expect(c.fields).toEqual([]);
    expect(c.afterSubmit).toBe("message");
    expect(c.createInquiry).toBe(false);
    expect(c.buttonLabel).toBe("Enviar");
    expect(c.thanksMessage).toBe("¡Gracias! Recibimos tus datos.");
    const n = newsletterConfigSchema.parse({});
    expect(n).toMatchObject({ askName: false, buttonLabel: "Suscribirme" });
  });

  it("descarta campos rotos, recorta textos y limita a 20 campos y 30 opciones", () => {
    const muchos = Array.from({ length: 25 }, (_, i) => campo(`c${i}`, "text", `Campo ${i}`));
    const c = formConfigSchema.parse({
      fields: [null, { ...campo("a", "select", "x".repeat(300)), options: ["  Uno ", "", 5, ...Array.from({ length: 40 }, (_, i) => `op${i}`)] }, ...muchos],
    });
    expect(c.fields).toHaveLength(20);
    expect(c.fields[0].label).toHaveLength(120);
    expect(c.fields[0].options[0]).toBe("Uno");
    expect(c.fields[0].options).toHaveLength(30);
    expect(c.fields[0].options).not.toContain("");
  });

  it("un tipo de campo desconocido queda como texto", () => {
    expect(formConfigSchema.parse({ fields: [{ ...campo("a", "text", "A"), type: "archivo" }] }).fields[0].type).toBe("text");
  });

  it("los bloques nuevos entran en la unión y tienen config por omisión válida", () => {
    for (const tipo of ["FORM", "NEWSLETTER"] as const) {
      const b = createEmptyBlock(tipo, 0);
      expect(websiteBlockSchema.safeParse(b).success).toBe(true);
    }
    const form = createEmptyBlock("FORM", 0);
    if (form.type !== "FORM") throw new Error("tipo");
    expect(form.config.fields.map((f) => f.type)).toEqual(["text", "email", "phone", "textarea"]);
  });

  it("el boletín no entra al menú automático; el formulario sí", () => {
    const items = deriveHomeNavItems([
      { ...createEmptyBlock("NEWSLETTER", 0), id: "n1" },
      { ...createEmptyBlock("FORM", 1), id: "f1" },
    ]);
    expect(items.map((i) => i.label)).toEqual(["Inicio", "Escribinos"]);
  });
});

describe("validarEnvio (contra la definición publicada)", () => {
  const config = configCon([
    campo("nombre", "text", "Nombre", { required: true }),
    campo("mail", "email", "Correo", { required: true }),
    campo("tel", "phone", "WhatsApp"),
    campo("cant", "number", "Invitados"),
    campo("dia", "date", "Fecha del evento"),
    campo("tipo", "select", "Tipo", { options: ["Boda", "XV"] }),
    campo("acepto", "checkbox", "Acepto que me escriban", { required: true }),
    campo("msg", "textarea", "Mensaje"),
  ]);
  const base = {
    f_nombre: " Ana Pérez ",
    f_mail: "ANA@Ejemplo.com",
    f_tel: "341 555-1234",
    f_cant: "120",
    f_dia: "2026-12-05",
    f_tipo: "XV",
    f_acepto: "on",
    f_msg: "Hola",
  };

  it("devuelve los pares en orden, normalizados, y el contacto", () => {
    const r = validarEnvio(config, lector({ ...base, f_intruso: "no me guardes" }));
    expect(r).toEqual({
      ok: true,
      pares: [
        { etiqueta: "Nombre", valor: "Ana Pérez" },
        { etiqueta: "Correo", valor: "ana@ejemplo.com" },
        { etiqueta: "WhatsApp", valor: "341 555-1234" },
        { etiqueta: "Invitados", valor: "120" },
        { etiqueta: "Fecha del evento", valor: "05/12/2026" },
        { etiqueta: "Tipo", valor: "XV" },
        { etiqueta: "Acepto que me escriban", valor: "Sí" },
        { etiqueta: "Mensaje", valor: "Hola" },
      ],
      contacto: { nombre: "Ana Pérez", email: "ana@ejemplo.com", telefono: "341 555-1234" },
    });
  });

  it("los opcionales vacíos no se guardan", () => {
    const r = validarEnvio(config, lector({ f_nombre: "Ana", f_mail: "a@b.com", f_acepto: "on" }));
    expect(r.ok && r.pares.map((p) => p.etiqueta)).toEqual(["Nombre", "Correo", "Acepto que me escriban"]);
  });

  it.each([
    [{ f_nombre: "" }, "Completá «Nombre»."],
    [{ f_mail: "no-es-correo" }, "Revisá el correo de «Correo»."],
    [{ f_tel: "llamame" }, "Revisá el teléfono de «WhatsApp»."],
    [{ f_cant: "muchos" }, "«Invitados» tiene que ser un número."],
    [{ f_dia: "05/12/2026" }, "Revisá la fecha de «Fecha del evento»."],
    [{ f_tipo: "Bautismo" }, "Elegí una opción de «Tipo»."],
    [{ f_acepto: "" }, "Marcá «Acepto que me escriban» para seguir."],
    [{ f_nombre: "x".repeat(301) }, "«Nombre» puede tener hasta 300 caracteres."],
    [{ f_msg: "x".repeat(4001) }, "«Mensaje» puede tener hasta 4000 caracteres."],
  ])("rechaza %o", (cambio, error) => {
    expect(validarEnvio(config, lector({ ...base, ...cambio }))).toEqual({ ok: false, error });
  });

  it("una casilla opcional sin marcar se guarda como «No»", () => {
    const c = configCon([campo("n", "text", "Nombre", { required: true }), campo("x", "checkbox", "Novedades")]);
    const r = validarEnvio(c, lector({ f_n: "Ana" }));
    expect(r.ok && r.pares).toEqual([
      { etiqueta: "Nombre", valor: "Ana" },
      { etiqueta: "Novedades", valor: "No" },
    ]);
  });

  it("una lista sin opciones se valida como texto", () => {
    const c = configCon([campo("t", "select", "Cuál")]);
    expect(validarEnvio(c, lector({ f_t: "cualquiera" })).ok).toBe(true);
  });

  it("sin campos no se puede enviar", () => {
    expect(validarEnvio(configCon([]), lector({}))).toEqual({ ok: false, error: "Este formulario todavía no tiene campos." });
  });

  it("frena un envío demasiado largo en total", () => {
    const largos = Array.from({ length: 6 }, (_, i) => campo(`m${i}`, "textarea", `M${i}`));
    const valores = Object.fromEntries(largos.map((f) => [nombreDelInput(f.id), "x".repeat(4000)]));
    expect(validarEnvio(configCon(largos), lector(valores))).toEqual({ ok: false, error: "El envío es demasiado largo." });
  });

  it("claves de campo seguras y únicas aunque los ids vengan mal", () => {
    const c = camposConClave([campo("ok_1", "text", ""), campo("ok_1", "text", "B"), campo("<x>", "text", "C"), campo("", "text", "D")]);
    expect(c.map((f) => f.clave)).toEqual(["ok_1", "campo-2", "campo-3", "campo-4"]);
    expect(c[0].etiquetaVisible).toBe("Campo 1");
  });
});

describe("contacto, consulta y contenido oculto", () => {
  it("contactoPorEtiquetas reconoce nombre, correo y teléfono en español y portugués", () => {
    expect(
      contactoPorEtiquetas([
        { etiqueta: "Nome", valor: "Ana" },
        { etiqueta: "E-mail", valor: "A@B.com" },
        { etiqueta: "Celular", valor: "341 555 1234" },
        { etiqueta: "Instagram", valor: "@ana" },
      ]),
    ).toEqual({ nombre: "Ana", email: "a@b.com", telefono: "341 555 1234" });
    expect(contactoPorEtiquetas([{ etiqueta: "Dato", valor: "x@y.com" }]).email).toBe("x@y.com");
    expect(contactoPorEtiquetas([{ etiqueta: "Nombre de usuario", valor: "x" }]).nombre).toBe("x");
  });

  it("emailValido", () => {
    expect(emailValido(" Ana@Ejemplo.com.ar ")).toBe(true);
    expect(emailValido("ana@ejemplo")).toBe(false);
    expect(emailValido("a b@c.com")).toBe(false);
    expect(emailValido(`${"x".repeat(250)}@b.com`)).toBe(false);
  });

  it("mensajeDeConsulta lista los datos y respeta el tope", () => {
    const m = mensajeDeConsulta("Videos", [
      { etiqueta: "Nombre", valor: "Ana" },
      { etiqueta: "Mensaje", valor: "Hola" },
    ]);
    expect(m).toBe("Formulario del sitio «Videos»\nNombre: Ana\nMensaje: Hola");
    expect(mensajeDeConsulta("x", [{ etiqueta: "M", valor: "y".repeat(5000) }], 100)).toHaveLength(100);
  });

  it("la config que viaja al navegador no lleva el contenido oculto ni la categoría", () => {
    const c = configCon([campo("a", "email", "Correo")], {
      afterSubmit: "reveal",
      revealText: "Secreto",
      revealLinkLabel: "Mirá los videos",
      revealLinkUrl: "https://youtube.com/x",
      categoryId: "cat1",
      origenId: "or1",
    });
    const publica = configPublicaDelFormulario(c);
    expect(JSON.stringify(publica)).not.toMatch(/Secreto|youtube|cat1|or1|Mirá los videos/);
    expect(publica.fields).toEqual(c.fields);
    expect(contenidoRevelado(c)).toEqual({ texto: "Secreto", enlace: { etiqueta: "Mirá los videos", href: "https://youtube.com/x" } });
    expect(contenidoRevelado(publica)).toBeNull();
    expect(contenidoRevelado({ ...c, afterSubmit: "message" })).toBeNull();
  });

  it("el contenido oculto resuelve páginas del sitio y descarta enlaces peligrosos", () => {
    const c = configCon([], { afterSubmit: "reveal", revealText: "", revealLinkUrl: "/videos" });
    expect(contenidoRevelado(c, { videos: "/w/dnx/videos" })?.enlace).toEqual({ etiqueta: "Abrir", href: "/w/dnx/videos" });
    expect(contenidoRevelado({ ...c, revealLinkUrl: "javascript:alert(1)" })).toBeNull();
  });

  it("enlaceSeguroDelFormulario: sólo páginas propias o https", () => {
    expect(enlaceSeguroDelFormulario("/gracias")).toBe("/gracias");
    expect(enlaceSeguroDelFormulario("gracias")).toBe("/gracias");
    expect(enlaceSeguroDelFormulario("https://ejemplo.com/x")).toBe("https://ejemplo.com/x");
    expect(enlaceSeguroDelFormulario("www.ejemplo.com")).toBe("https://www.ejemplo.com");
    expect(enlaceSeguroDelFormulario("http://ejemplo.com")).toBeNull();
    expect(enlaceSeguroDelFormulario("//malo.com")).toBeNull();
    expect(enlaceSeguroDelFormulario("mailto:a@b.com")).toBeNull();
    expect(enlaceSeguroDelFormulario("javascript:alert(1)")).toBeNull();
    expect(enlaceSeguroDelFormulario("")).toBeNull();
  });
});

describe("buscarBloquePublicado y paginaUrlDe", () => {
  const sections = parseWebsiteSections({
    pages: {
      home: [{ ...createEmptyBlock("FORM", 0), id: "f-home" }],
      p_1: [
        { ...createEmptyBlock("FORM", 0), id: "f-videos" },
        { ...createEmptyBlock("FORM", 1), id: "f-oculto", visible: false },
        { ...createEmptyBlock("NEWSLETTER", 2), id: "n-1" },
      ],
    },
    pageMeta: { p_1: { slug: "videos", title: "Videos" } },
  });

  it("encuentra el bloque visible del tipo pedido y su página", () => {
    expect(buscarBloquePublicado(sections, "f-videos", "FORM")?.pageKey).toBe("p_1");
    expect(buscarBloquePublicado(sections, "f-home", "FORM")?.pageKey).toBe("home");
    expect(buscarBloquePublicado(sections, "n-1", "NEWSLETTER")?.block.type).toBe("NEWSLETTER");
  });

  it("no acepta bloques ocultos, de otro tipo o inexistentes", () => {
    expect(buscarBloquePublicado(sections, "f-oculto", "FORM")).toBeNull();
    expect(buscarBloquePublicado(sections, "n-1", "FORM")).toBeNull();
    expect(buscarBloquePublicado(sections, "nada", "FORM")).toBeNull();
  });

  it("arma la dirección pública de la página", () => {
    expect(paginaUrlDe("dnx-estudio", sections, "home")).toBe("/w/dnx-estudio");
    expect(paginaUrlDe("dnx-estudio", sections, "p_1")).toBe("/w/dnx-estudio/videos");
    expect(paginaUrlDe("dnx-estudio", sections, "p_9")).toBe("/w/dnx-estudio");
  });
});

describe("filtros de la bandeja", () => {
  it("valida lo que viene en la dirección", () => {
    expect(filtrosDeLaBandeja({ formulario: "../x", estado: "borrado", pagina: "-3", envio: "abc" })).toEqual({
      vista: "envios",
      formularioId: null,
      estado: null,
      estadoSuscriptor: "ACTIVO",
      q: "",
      pagina: 1,
      envioId: null,
    });
    const f = filtrosDeLaBandeja({ formulario: "cmv5z6qxwwmmhf0q5gp8qja1j", estado: "archivado", pagina: "3", q: "  ana " });
    expect(f).toMatchObject({ formularioId: "cmv5z6qxwwmmhf0q5gp8qja1j", estado: "ARCHIVADO", pagina: 3, q: "ana" });
    expect(filtrosDeLaBandeja({ vista: "suscriptores", estado: "baja" })).toMatchObject({ vista: "suscriptores", estadoSuscriptor: "BAJA" });
  });

  it("arma la dirección sólo con lo que no es por omisión", () => {
    expect(hrefDeLaBandeja({})).toBe("/website/formularios");
    expect(hrefDeLaBandeja({ formularioId: "abc12345", estado: "NUEVO", q: "ana", pagina: 2 })).toBe("/website/formularios?formulario=abc12345&estado=NUEVO&q=ana&pagina=2");
    expect(hrefDeLaBandeja({ vista: "suscriptores", estadoSuscriptor: "ACTIVO" })).toBe("/website/formularios?vista=suscriptores");
  });

  it("paresDeJson tolera basura", () => {
    expect(paresDeJson([{ etiqueta: "A", valor: "1" }, { etiqueta: "B", valor: 2 }, { etiqueta: 3 }, null, "x"])).toEqual([
      { etiqueta: "A", valor: "1" },
      { etiqueta: "B", valor: "2" },
    ]);
    expect(paresDeJson({})).toEqual([]);
    // Importado sin fecha: objeto con los pares y la marca.
    const sinFecha = datosDeEnvioJson([{ etiqueta: "A", valor: "1" }], true);
    expect(sinFecha).toEqual({ pares: [{ etiqueta: "A", valor: "1" }], fechaDesconocida: true });
    expect(paresDeJson(sinFecha)).toEqual([{ etiqueta: "A", valor: "1" }]);
    expect(fechaDesconocidaDeJson(sinFecha)).toBe(true);
    expect(fechaDesconocidaDeJson([{ etiqueta: "A", valor: "1" }])).toBe(false);
    expect(datosDeEnvioJson([], false)).toEqual([]);
  });
});

describe("CSV de la bandeja", () => {
  it("escapa comas, comillas y saltos de línea", () => {
    expect(celdaCsv('Pérez, "Ana"')).toBe('"Pérez, ""Ana"""');
    expect(celdaCsv("dos\nlíneas")).toBe('"dos\nlíneas"');
    expect(celdaCsv("simple")).toBe("simple");
    expect(celdaCsv(null)).toBe("");
  });

  it("neutraliza fórmulas pero no los teléfonos", () => {
    expect(neutralizarFormula('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(neutralizarFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizarFormula("-2+3+cmd|' /C calc'!A0")).toBe("'-2+3+cmd|' /C calc'!A0");
    expect(neutralizarFormula("+54 9 341 555-1234")).toBe("+54 9 341 555-1234");
    expect(neutralizarFormula("-5")).toBe("-5");
  });

  it("lleva BOM, coma como separador y CRLF", () => {
    expect(armarCsv(["A", "B"], [["1", "2"]])).toBe("﻿A,B\r\n1,2\r\n");
  });

  it("exporta todas las columnas de todos los envíos, en orden de aparición", () => {
    const csv = csvDeEnvios([
      {
        createdAt: new Date("2026-10-27T17:05:00Z"),
        formulario: "Contacto",
        estado: "NUEVO",
        paginaUrl: "/w/dnx",
        pares: [
          { etiqueta: "Nombre", valor: "Ana" },
          { etiqueta: "Correo", valor: "ana@b.com" },
        ],
      },
      {
        createdAt: new Date("2026-10-26T12:00:00Z"),
        formulario: "Videos",
        estado: "ARCHIVADO",
        paginaUrl: null,
        pares: [
          { etiqueta: "Nombre", valor: "Luis" },
          { etiqueta: "Instagram", valor: "@luis" },
          { etiqueta: "Instagram", valor: "@otro" },
        ],
      },
    ]);
    expect(csv).toBe(
      "﻿Fecha,Formulario,Estado,Página,Nombre,Correo,Instagram,Instagram (2)\r\n" +
        "27/10/2026 14:05,Contacto,Nuevo,/w/dnx,Ana,ana@b.com,,\r\n" +
        // «@…» se neutraliza (Excel lo tomaría como fórmula), aunque sea un usuario de Instagram.
        "26/10/2026 09:00,Videos,Archivado,,Luis,,'@luis,'@otro\r\n",
    );
  });

  it("un envío importado sin fecha dice «sin fecha»", () => {
    const csv = csvDeEnvios([{ createdAt: new Date(), fechaDesconocida: true, formulario: "X", estado: "LEIDO", paginaUrl: null, pares: [{ etiqueta: "A", valor: "1" }] }]);
    expect(csv).toBe("\uFEFFFecha,Formulario,Estado,Página,A\r\nsin fecha,X,Leído,,1\r\n");
  });

  it("exporta los suscriptores", () => {
    expect(
      csvDeSuscriptores([{ email: "a@b.com", nombre: null, estado: "BAJA", origen: "SITIO", createdAt: new Date("2026-01-02T03:00:00Z") }]),
    ).toBe("﻿Correo,Nombre,Estado,Origen,Fecha de alta\r\na@b.com,,Dado de baja,SITIO,02/01/2026 00:00\r\n");
  });

  it("nombre de archivo sin caracteres raros, con el día argentino", () => {
    expect(nombreDeArchivoCsv("formulario", "Contacto de «proveedores»", new Date("2026-10-28T01:00:00Z"))).toBe("formulario-contacto-de-proveedores-2026-10-27.csv");
    expect(nombreDeArchivoCsv("suscriptores", "", new Date("2026-10-27T12:00:00Z"))).toBe("suscriptores-2026-10-27.csv");
  });
});
