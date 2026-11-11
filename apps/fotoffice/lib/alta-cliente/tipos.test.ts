import { describe, expect, it } from "vitest";
import { CUESTIONARIO_PRODUCTORA_DOCENTE as C } from "./cuestionarios/productora-docente";
import { clavesDeCuestionarios, cuestionarioPorClave } from "./cuestionarios";
import { avance, faltantes, limpiarRespuestas, respuestasEnTexto, seMuestra } from "./tipos";

describe("cuestionario productora-docente", () => {
  it("está registrado por su clave", () => {
    expect(clavesDeCuestionarios()).toContain("productora-docente-v1");
    expect(cuestionarioPorClave("productora-docente-v1")).toBe(C);
    expect(cuestionarioPorClave("no-existe")).toBeNull();
  });

  it("no repite ids de pregunta", () => {
    const ids = C.secciones.flatMap((s) => s.preguntas.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada condición apunta a una pregunta que existe", () => {
    const ids = new Set(C.secciones.flatMap((s) => s.preguntas.map((p) => p.id)));
    for (const s of C.secciones) {
      for (const p of s.preguntas) {
        const conds = p.mostrarSi ? (Array.isArray(p.mostrarSi) ? p.mostrarSi : [p.mostrarSi]) : [];
        for (const c of conds) expect(ids.has(c.pregunta), `${p.id} → ${c.pregunta}`).toBe(true);
      }
    }
  });

  it("pregunta por las cuatro cosas que pidió Daniel: presenciales, agenda, comunidad y precios de cada curso", () => {
    const ids = C.secciones.flatMap((s) => s.preguntas.map((p) => p.id));
    expect(ids).toEqual(
      expect.arrayContaining([
        "presenciales_quiere",
        "sesiones_quiere",
        "comunidad_quiere",
        "curso_inicial_precio",
        "curso_iluminacion_precio",
        "curso_productos_precio",
        "curso_boudoir_precio",
      ]),
    );
  });
});

describe("seMuestra", () => {
  it("muestra el detalle de la comunidad sólo si la quiere", () => {
    const planes = C.secciones.find((s) => s.id === "comunidad")!.preguntas.find((p) => p.id === "comunidad_planes")!;
    expect(seMuestra(planes, {})).toBe(false);
    expect(seMuestra(planes, { comunidad_quiere: "mas_adelante" })).toBe(false);
    expect(seMuestra(planes, { comunidad_quiere: "si" })).toBe(true);
  });

  it("oculta el precio de un curso que no se quiere vender", () => {
    const precio = C.secciones.find((s) => s.id === "grabados")!.preguntas.find((p) => p.id === "curso_boudoir_precio")!;
    expect(seMuestra(precio, {})).toBe(true);
    expect(seMuestra(precio, { curso_boudoir_vender: "si" })).toBe(true);
    expect(seMuestra(precio, { curso_boudoir_vender: "no" })).toBe(false);
  });

  it("con incluye, mira dentro de una respuesta de varias opciones", () => {
    const p = { mostrarSi: { pregunta: "lineas", incluye: "sesiones" } };
    expect(seMuestra(p, { lineas: ["cursos_grabados"] })).toBe(false);
    expect(seMuestra(p, { lineas: ["cursos_grabados", "sesiones"] })).toBe(true);
  });
});

describe("limpiarRespuestas", () => {
  it("descarta claves desconocidas y tipos equivocados", () => {
    const r = limpiarRespuestas(C, {
      nombre_completo: "Andrea Defagot",
      inventada: "x",
      publicar_datos: "sí",
      lineas: ["cursos_grabados", 3],
      sesiones_tipos: [{ nombre: "Boudoir", precio: "90000", hack: "x" }, "roto"],
      lema__otro: "Otro lema",
    });
    expect(r).toEqual({
      nombre_completo: "Andrea Defagot",
      lineas: ["cursos_grabados"],
      sesiones_tipos: [{ nombre: "Boudoir", precio: "90000" }, {}],
      lema__otro: "Otro lema",
    });
  });

  it("acepta basura sin romperse", () => {
    expect(limpiarRespuestas(C, null)).toEqual({});
    expect(limpiarRespuestas(C, [1, 2])).toEqual({});
  });
});

describe("faltantes y avance", () => {
  it("lista las obligatorias que faltan y deja de pedirlas cuando están", () => {
    expect(faltantes(C, {})).toContain("Tus datos: Nombre y apellido");
    const completo = {
      nombre_completo: "Andrea",
      email_acceso: "a@b.com",
      whatsapp_personal: "3492",
      nombre_comercial: "F64",
      mp_tiene: "si",
      curso_inicial_vender: "si",
      curso_iluminacion_vender: "si",
      curso_productos_vender: "si",
      curso_boudoir_vender: "si",
      presenciales_quiere: "no",
      sesiones_quiere: "no",
      comunidad_quiere: "no",
      prioridad: "grabados",
      publicar_datos: false,
    };
    expect(faltantes(C, completo)).toEqual([]);
  });

  it("cuenta sólo las visibles", () => {
    const sin = avance(C, {});
    const con = avance(C, { comunidad_quiere: "si" });
    expect(con.visibles).toBeGreaterThan(sin.visibles);
  });
});

describe("respuestasEnTexto", () => {
  it("arma el resumen con etiquetas legibles, listas y lo que falta", () => {
    const texto = respuestasEnTexto(
      C,
      {
        nombre_completo: "Andrea Defagot",
        mp_tiene: "si",
        lineas: ["cursos_grabados", "sesiones"],
        lineas__otro: "Fotografía de mascotas",
        publicar_datos: true,
        sesiones_quiere: "si",
        sesiones_tipos: [{ nombre: "Boudoir", precio: "90000" }, {}],
      },
      "Andrea Defagot",
    );
    expect(texto).toContain("# Alta en FOTOFFICE — Andrea Defagot");
    expect(texto).toContain("- **Nombre y apellido** Andrea Defagot");
    expect(texto).toContain("Cursos grabados; Sesiones de fotos");
    expect(texto).toContain("Otro: Fotografía de mascotas");
    expect(texto).toContain("1. Sesión: Boudoir · Precio (pesos): 90000");
    expect(texto).toContain("- **¿Nos autorizás a publicar en tu sitio los datos, fotos y textos que nos pasaste?** Sí");
    expect(texto).toContain("_(sin responder)_");
    expect(texto).not.toContain("Planes y precios");
  });
});
