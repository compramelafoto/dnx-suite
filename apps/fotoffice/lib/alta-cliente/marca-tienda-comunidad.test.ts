import { describe, expect, it } from "vitest";
import { CUESTIONARIO_MARCA_TIENDA_COMUNIDAD as C } from "./cuestionarios/marca-tienda-comunidad";
import { cuestionarioPorClave } from "./cuestionarios";
import { estaRespondida, faltantes, fotosDe, limpiarRespuestas, respuestasEnTexto, seMuestra } from "./tipos";

const preguntas = C.secciones.flatMap((s) => s.preguntas);
const pregunta = (id: string) => preguntas.find((p) => p.id === id)!;
const URL_A = "https://media.fotoffice.com/fotoffice/alta-clientes/alta_x/a.jpg";
const URL_B = "https://media.fotoffice.com/fotoffice/alta-clientes/alta_x/b.jpg";

describe("cuestionario marca-tienda-comunidad (Proyecto Design)", () => {
  it("está registrado por su clave", () => {
    expect(cuestionarioPorClave("marca-tienda-comunidad-v1")).toBe(C);
  });

  it("no repite ids y cada condición apunta a una pregunta que existe", () => {
    const ids = preguntas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of [...C.secciones, ...preguntas]) {
      const conds = item.mostrarSi ? (Array.isArray(item.mostrarSi) ? item.mostrarSi : [item.mostrarSi]) : [];
      for (const c of conds) expect(ids, `${item.id} → ${c.pregunta}`).toContain(c.pregunta);
    }
  });

  it("abre diez casillas de producto, cada una con fotos, precio, variantes y datos de envío", () => {
    const p = pregunta("productos");
    if (p.tipo !== "lista") throw new Error("tipo");
    expect(p.obligatoria).toBe(true);
    expect(p.filasIniciales).toHaveLength(10);
    const campos = p.campos.map((c) => c.id);
    expect(campos).toEqual(expect.arrayContaining(["nombre", "fotos", "precio", "variantes", "peso_paquete", "medidas_paquete", "dias_fabricacion"]));
    expect(p.campos.find((c) => c.id === "fotos")?.tipo).toBe("fotos");
  });

  it("cubre las cuatro áreas que pidió Daniel: tienda y envíos, a medida, mayoristas y comunidad", () => {
    const secciones = C.secciones.map((s) => s.id);
    expect(secciones).toEqual(expect.arrayContaining(["productos", "envios", "medida", "mayorista", "comunidad"]));
  });

  it("la cuota de la comunidad aparece sólo si es paga o mixta", () => {
    const cuota = pregunta("comunidad_cuota");
    expect(seMuestra(cuota, { comunidad_costo: "gratis" })).toBe(false);
    expect(seMuestra(cuota, { comunidad_costo: "compra" })).toBe(false);
    expect(seMuestra(cuota, { comunidad_costo: "paga" })).toBe(true);
    expect(seMuestra(cuota, { comunidad_costo: "mixta" })).toBe(true);
  });

  it("no deja enviar sin productos, y las fotos se guardan y salen en el resumen", () => {
    const base = { nombre_completo: "Jonatan Pérez", marca: "Proyecto Design", email_acceso: "a@b.com", whatsapp: "343" };
    expect(faltantes(C, base)).toEqual(["Tus 10 productos principales: Productos"]);

    const r = limpiarRespuestas(C, {
      ...base,
      logo: `${URL_A}\n${URL_B}`,
      productos: [{ nombre: "Arnés doble", fotos: `${URL_A}\n${URL_B}`, precio: "85000", inventado: "x" }],
    });
    expect(faltantes(C, r)).toEqual([]);
    expect((r.productos as Record<string, string>[])[0]).not.toHaveProperty("inventado");
    const texto = respuestasEnTexto(C, r, "Jonatan Pérez");
    expect(texto).toContain(`Fotos del producto: ${URL_A} ${URL_B}`);
    expect(texto).toContain(`  - ${URL_B}`);
  });
});

describe("fotosDe", () => {
  it("separa por renglón, saca vacíos, repetidas y lo que no es https", () => {
    expect(fotosDe(` ${URL_A}\n\n${URL_B}\n${URL_A}\njavascript:alert(1)\nhttp://x.com/a.jpg`)).toEqual([URL_A, URL_B]);
    expect(fotosDe("")).toEqual([]);
    expect(fotosDe(undefined)).toEqual([]);
  });

  it("un campo de fotos con direcciones cuenta como respondido", () => {
    expect(estaRespondida(pregunta("logo"), URL_A)).toBe(true);
    expect(estaRespondida(pregunta("logo"), "")).toBe(false);
  });
});
