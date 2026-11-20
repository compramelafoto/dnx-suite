import { describe, expect, it } from "vitest";
import { esTablaFaltante, esTokenValido, rutaPublica } from "./base";
import { CUESTIONARIO_BODAS, CUESTIONARIO_XV, CUESTIONARIOS_DE_FABRICA, faltantesDeFabrica } from "./de-fabrica";
import { armarMensaje, enlaceCorreo, enlaceWhatsapp, enlacesDeEnvio, primerNombre } from "./mensaje";
import { agruparPorSeccion, esFechaValida, esTelefonoValido, LARGO_MAXIMO, normalizarRespuestas } from "./respuestas";
import { leerDefinicion, leerRespuestasGuardadas, valoresIniciales, type DefinicionCuestionario } from "./tipos";

const DEF: DefinicionCuestionario = {
  secciones: [
    {
      id: "a",
      titulo: "Datos",
      preguntas: [
        { id: "nombre", etiqueta: "Nombre", tipo: "corto" },
        { id: "nacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha" },
        { id: "tel", etiqueta: "WhatsApp", tipo: "telefono" },
      ],
    },
    { id: "b", titulo: "Gustos", preguntas: [{ id: "musica", etiqueta: "Música", tipo: "largo" }] },
  ],
};

describe("cuestionarios de fábrica", () => {
  it("son dos, con claves xv y bodas", () => {
    expect(CUESTIONARIOS_DE_FABRICA.map((c) => c.clave)).toEqual(["xv", "bodas"]);
    expect(CUESTIONARIO_XV.nombre).toBe("Cuestionario para quinceañeras");
    expect(CUESTIONARIO_BODAS.nombre).toBe("Cuestionario para bodas");
  });

  it("los ids de pregunta no se repiten dentro de cada uno y la definición se lee igual", () => {
    for (const c of CUESTIONARIOS_DE_FABRICA) {
      const ids = c.definicion.secciones.flatMap((s) => s.preguntas.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(leerDefinicion(JSON.parse(JSON.stringify(c.definicion)))).toEqual(c.definicion);
    }
  });

  it("tienen las secciones del formulario original", () => {
    expect(CUESTIONARIO_XV.definicion.secciones.map((s) => s.titulo)).toEqual([
      "Información familiar",
      "Datos de la quinceañera",
      "La sesión, la fiesta y la quinceañera",
      "Proveedores de la fiesta",
    ]);
    expect(CUESTIONARIO_BODAS.definicion.secciones).toHaveLength(6);
    const xv = CUESTIONARIO_XV.definicion.secciones.flatMap((s) => s.preguntas);
    expect(xv.find((p) => p.id === "fecha_fiesta")?.tipo).toBe("fecha");
    expect(xv.find((p) => p.id === "madre_whatsapp")?.tipo).toBe("telefono");
    expect(xv.filter((p) => p.id.startsWith("prov_"))).toHaveLength(12);
  });

  it("faltantesDeFabrica sólo devuelve las claves que no existen", () => {
    expect(faltantesDeFabrica([]).map((c) => c.clave)).toEqual(["xv", "bodas"]);
    expect(faltantesDeFabrica(["xv"]).map((c) => c.clave)).toEqual(["bodas"]);
    expect(faltantesDeFabrica(["xv", "bodas", "otro"])).toEqual([]);
  });
});

describe("leerDefinicion", () => {
  it("descarta lo que no tiene forma, ids repetidos y tipos desconocidos", () => {
    const d = leerDefinicion({
      secciones: [
        { id: "s", titulo: " Uno ", preguntas: [{ id: "x", etiqueta: "X", tipo: "raro" }, { id: "x", etiqueta: "Otra X" }, { etiqueta: "sin id" }, null] },
        { id: "vacia", titulo: "Vacía", preguntas: [] },
        "basura",
      ],
    });
    expect(d).toEqual({ secciones: [{ id: "s", titulo: "Uno", preguntas: [{ id: "x", etiqueta: "X", tipo: "corto" }] }] });
    expect(leerDefinicion(null)).toEqual({ secciones: [] });
  });
});

describe("normalizarRespuestas", () => {
  it("recorta, ignora ids desconocidos y guarda etiqueta y sección", () => {
    const r = normalizarRespuestas(DEF, { nombre: "  Ana   María ", desconocido: "x", musica: "  Rock\r\n\n\n\nPop  ", tel: "" });
    expect(r).toEqual({
      ok: true,
      respuestas: [
        { preguntaId: "nombre", etiqueta: "Nombre", seccion: "Datos", valor: "Ana María" },
        { preguntaId: "musica", etiqueta: "Música", seccion: "Gustos", valor: "Rock\n\nPop" },
      ],
    });
  });

  it("rechaza un envío vacío", () => {
    const r = normalizarRespuestas(DEF, { nombre: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/al menos una/);
    expect(normalizarRespuestas(DEF, "nada").ok).toBe(false);
    expect(normalizarRespuestas(DEF, ["x"]).ok).toBe(false);
  });

  it("valida fechas, teléfonos y largo máximo", () => {
    const r = normalizarRespuestas(DEF, { nacimiento: "2010-02-30", tel: "llamame", nombre: "a".repeat(LARGO_MAXIMO.corto + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.map((e) => e.preguntaId).sort()).toEqual(["nacimiento", "nombre", "tel"]);
    const bien = normalizarRespuestas(DEF, { nacimiento: "2010-02-28", tel: "+54 9 341 555-1234" });
    expect(bien.ok).toBe(true);
  });

  it("ignora valores que no son texto", () => {
    const r = normalizarRespuestas(DEF, { nombre: 42, musica: { x: 1 }, tel: "341 5551234" });
    expect(r.ok && r.respuestas.map((x) => x.preguntaId)).toEqual(["tel"]);
  });
});

describe("fechas y teléfonos", () => {
  it("esFechaValida", () => {
    expect(esFechaValida("2024-02-29")).toBe(true);
    expect(esFechaValida("2023-02-29")).toBe(false);
    expect(esFechaValida("14/03/2026")).toBe(false);
    expect(esFechaValida("1800-01-01")).toBe(false);
  });
  it("esTelefonoValido", () => {
    expect(esTelefonoValido("(0341) 15-555-1234")).toBe(true);
    expect(esTelefonoValido("12345")).toBe(false);
    expect(esTelefonoValido("341abc5551234")).toBe(false);
  });
});

describe("agruparPorSeccion", () => {
  it("agrupa en orden y muestra las fechas como día/mes/año", () => {
    const grupos = agruparPorSeccion(
      [
        { preguntaId: "nombre", etiqueta: "Nombre", seccion: "Datos", valor: "Ana" },
        { preguntaId: "musica", etiqueta: "Música", seccion: "Gustos", valor: "Rock" },
        { preguntaId: "nacimiento", etiqueta: "Fecha de nacimiento", seccion: "Datos", valor: "2010-03-14" },
      ],
      DEF,
    );
    expect(grupos).toEqual([
      {
        seccion: "Datos",
        items: [
          { preguntaId: "nombre", etiqueta: "Nombre", valor: "Ana" },
          { preguntaId: "nacimiento", etiqueta: "Fecha de nacimiento", valor: "14/03/2010" },
        ],
      },
      { seccion: "Gustos", items: [{ preguntaId: "musica", etiqueta: "Música", valor: "Rock" }] },
    ]);
  });

  it("sin sección cae en «Respuestas»", () => {
    expect(agruparPorSeccion([{ preguntaId: "x", etiqueta: "X", seccion: "", valor: "1" }])[0].seccion).toBe("Respuestas");
  });
});

describe("respuestas guardadas", () => {
  it("se leen sin confiar en la forma y vuelven a llenar el formulario", () => {
    const leidas = leerRespuestasGuardadas([{ preguntaId: "a", etiqueta: "A", seccion: "S", valor: "1" }, { preguntaId: "b" }, "x", { valor: "sin id" }]);
    expect(leidas).toEqual([{ preguntaId: "a", etiqueta: "A", seccion: "S", valor: "1" }]);
    expect(valoresIniciales(leidas)).toEqual({ a: "1" });
    expect(leerRespuestasGuardadas(null)).toEqual([]);
  });
});

describe("mensaje para mandar el enlace", () => {
  it("primerNombre", () => {
    expect(primerNombre("Pérez, Ana María")).toBe("Ana");
    expect(primerNombre("Ana Pérez")).toBe("Ana");
    expect(primerNombre("Sin nombre")).toBe("");
    expect(primerNombre(null)).toBe("");
  });

  it("arma el texto con el saludo, el estudio y el enlace", () => {
    const m = armarMensaje({ nombreCliente: "Gómez, Sofía", nombreCuestionario: "Cuestionario para quinceañeras", nombreEstudio: "DNX Estudio", enlace: "https://x.test/cuestionario/abc" });
    expect(m.texto).toContain("¡Hola, Sofía!");
    expect(m.texto).toContain("el cuestionario para quinceañeras de DNX Estudio");
    expect(m.texto).toContain("https://x.test/cuestionario/abc");
    expect(m.asunto).toBe("Cuestionario para quinceañeras · DNX Estudio");
  });

  it("enlace de WhatsApp con el número normalizado, o sin número si no sirve", () => {
    expect(enlaceWhatsapp("0341 15 555-1234", "hola mundo")).toBe("https://wa.me/5493415551234?text=hola%20mundo");
    expect(enlaceWhatsapp(null, "hola")).toBe("https://wa.me/?text=hola");
    expect(enlaceWhatsapp("123", "hola")).toBe("https://wa.me/?text=hola");
  });

  it("mailto con asunto y cuerpo codificados; un correo inválido se omite", () => {
    expect(enlaceCorreo("ana@mail.com", "Asunto & más", "Línea 1\nLínea 2")).toBe(
      "mailto:ana@mail.com?subject=Asunto%20%26%20m%C3%A1s&body=L%C3%ADnea%201%0AL%C3%ADnea%202",
    );
    expect(enlaceCorreo("no es correo", "a", "b")).toBe("mailto:?subject=a&body=b");
  });

  it("enlacesDeEnvio junta todo", () => {
    const e = enlacesDeEnvio({ enlace: "https://x.test/c", nombreCuestionario: "Cuestionario para bodas", telefono: "+54 9 11 5555 1234", correo: "a@b.com" });
    expect(e.enlace).toBe("https://x.test/c");
    expect(e.whatsappUrl.startsWith("https://wa.me/5491155551234?text=")).toBe(true);
    expect(e.mailtoUrl.startsWith("mailto:a@b.com?subject=")).toBe(true);
  });
});

describe("base", () => {
  it("token y ruta pública", () => {
    expect(esTokenValido("a".repeat(32))).toBe(true);
    expect(esTokenValido("a".repeat(31))).toBe(false);
    expect(esTokenValido("../../etc/passwd_xxxxxxxxxxxxxxxxx")).toBe(false);
    expect(rutaPublica("https://fotoffice.test/", "tok")).toBe("https://fotoffice.test/cuestionario/tok");
  });
  it("reconoce la tabla que todavía no existe", () => {
    expect(esTablaFaltante(Object.assign(new Error("x"), { code: "P2021" }))).toBe(true);
    expect(esTablaFaltante(new Error("otra cosa"))).toBe(false);
  });
});
