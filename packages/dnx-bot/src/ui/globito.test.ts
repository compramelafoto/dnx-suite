import { describe, expect, it } from "vitest";
import {
  botonGlobito,
  enlaceInterno,
  estadoUrl,
  globitoBody,
  haceloPorMiMensaje,
  parseDnxbotParam,
  parseGlobito,
  parseProgreso,
  pasoSiguiente,
  progresoInicial,
  stripDnxbotParam,
  tarjetaProgreso,
  type ProgresoEscolar,
} from "./globito";

const paso = (n: number, estado: "hecho" | "pendiente" | "no_aplica", extra: Record<string, unknown> = {}) => ({
  n, id: `p${n}`, titulo: `Paso ${n}`, estado, opcional: false, accion: true, enlace: `/dashboard/albums/9?tab=t${n}`, ...extra,
});
const progreso = (over: Partial<ProgresoEscolar> = {}): ProgresoEscolar => {
  const pasos = [paso(1, "hecho"), paso(2, "no_aplica"), paso(3, "hecho"), paso(4, "pendiente", { opcional: true }), paso(5, "pendiente")];
  return { albumId: 9, albumTitulo: "Egresados", schoolId: 2, pasos, hechos: 2, total: 11, siguiente: pasos[4]!, aMedias: false, ...over };
};

describe("?dnxbot=", () => {
  it("lee la campaña del enlace del mail", () => {
    expect(parseDnxbotParam("?dnxbot=escolar_en_curso")).toBe("escolar_en_curso");
    expect(parseDnxbotParam("?x=1&dnxbot=nuevo")).toBe("nuevo");
  });
  it("sin parámetro o con algo raro → null", () => {
    expect(parseDnxbotParam("")).toBeNull();
    expect(parseDnxbotParam("?dnxbot=")).toBeNull();
    expect(parseDnxbotParam("?dnxbot=<script>")).toBeNull();
    expect(parseDnxbotParam("?dnxbot=Nuevo")).toBeNull();
    expect(parseDnxbotParam(`?dnxbot=${"a".repeat(41)}`)).toBeNull();
  });
  it("quita sólo dnxbot de la URL", () => {
    expect(stripDnxbotParam("https://x.com/dashboard?dnxbot=nuevo&tab=a#h")).toBe("/dashboard?tab=a#h");
    expect(stripDnxbotParam("https://x.com/dashboard?dnxbot=nuevo")).toBe("/dashboard");
  });
  it("arma la URL del estado con la campaña", () => {
    expect(estadoUrl("/api/bot", null)).toBe("/api/bot/estado");
    expect(estadoUrl("/api/bot", "sin_ventas")).toBe("/api/bot/estado?campaign=sin_ventas");
  });
});

describe("globito", () => {
  const g = { campaign: "nuevo", texto: "Hola **Ana**", botones: [
    { label: "Sí, ayudame", mensaje: "Quiero armar mi primer álbum", accion: "CLICKED" },
    { label: "Ahora no", mensaje: null, accion: "DECLINED" },
  ] };
  it("valida la forma y descarta botones inválidos", () => {
    expect(parseGlobito(g)).toEqual(g);
    expect(parseGlobito(null)).toBeNull();
    expect(parseGlobito({ ...g, texto: " " })).toBeNull();
    expect(parseGlobito({ ...g, botones: [{ label: "x", mensaje: null, accion: "BORRAR" }, g.botones[1]] })!.botones).toEqual([g.botones[1]]);
  });
  it("botón con mensaje: registra la acción, abre y manda el mensaje", () => {
    expect(botonGlobito(g.botones[0] as never)).toEqual({ accion: "CLICKED", abrir: true, mensaje: "Quiero armar mi primer álbum", ocultar: true });
  });
  it("botón sin mensaje: registra y oculta sin abrir; nunca cuenta como CLICKED", () => {
    expect(botonGlobito({ label: "Ahora no", mensaje: null, accion: "DECLINED" })).toEqual({ accion: "DECLINED", abrir: false, mensaje: null, ocultar: true });
    expect(botonGlobito({ label: "Cerrar", mensaje: null, accion: "DISMISSED" }).accion).toBe("DISMISSED");
    expect(botonGlobito({ label: "?", mensaje: null, accion: "CLICKED" }).accion).toBe("DECLINED");
  });
  it("cuerpo del POST", () => {
    expect(JSON.parse(globitoBody("nuevo", "DISMISSED"))).toEqual({ campaign: "nuevo", accion: "DISMISSED" });
    expect(JSON.parse(globitoBody("sin_escolar", "CLICKED", "Ya lo hago"))).toEqual({ campaign: "sin_escolar", accion: "CLICKED", answer: "Ya lo hago" });
  });
});

describe("progreso escolar", () => {
  it("parseProgreso acepta el contrato y rechaza basura", () => {
    const p = progreso();
    expect(parseProgreso(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProgreso({ pasos: [] })).toBeNull();
    expect(parseProgreso({ pasos: [{ n: 1, id: "x", titulo: "t", estado: "raro" }] })).toBeNull();
    expect(parseProgreso("x")).toBeNull();
  });
  it("progresoInicial sólo con la campaña escolar en curso", () => {
    const p = progreso();
    const globito = { campaign: "escolar_en_curso", texto: "t", botones: [] };
    expect(progresoInicial({ globito, progresoEscolar: p })).toEqual(p);
    expect(progresoInicial({ globito: { ...globito, campaign: "nuevo" }, progresoEscolar: p })).toBeNull();
    expect(progresoInicial({ globito: null, progresoEscolar: p })).toBeNull();
    expect(progresoInicial(null)).toBeNull();
  });
  it("el siguiente es el del servidor si sigue pendiente", () => {
    expect(pasoSiguiente(progreso())!.n).toBe(5);
  });
  it("si el del servidor no está pendiente, el primer obligatorio pendiente; si no hay, el primer pendiente", () => {
    expect(pasoSiguiente(progreso({ siguiente: paso(1, "hecho") as never }))!.n).toBe(5);
    const soloOpcional = progreso({ siguiente: null, pasos: [paso(1, "hecho"), paso(4, "pendiente", { opcional: true })] as never });
    expect(pasoSiguiente(soloOpcional)!.n).toBe(4);
    expect(pasoSiguiente(progreso({ siguiente: null, pasos: [paso(1, "hecho"), paso(2, "no_aplica")] as never }))).toBeNull();
  });
  it("tarjeta: Paso k de 11, marcas ✓ ○ — y siguiente resaltado con Abrir y Hacelo por mí", () => {
    const t = tarjetaProgreso(progreso());
    expect(t.encabezado).toBe("Paso 5 de 11");
    expect(t.titulo).toBe("Egresados");
    expect(t.filas.map((f) => f.marca)).toEqual(["✓", "—", "✓", "○", "○"]);
    expect(t.filas.filter((f) => f.esSiguiente).map((f) => f.n)).toEqual([5]);
    expect(t.siguiente).toEqual({ n: 5, titulo: "Paso 5", enlace: "/dashboard/albums/9?tab=t5", mensaje: "Hacé por mí el paso: Paso 5" });
    expect(t.aviso).toBeNull();
  });
  it("sin herramienta para el paso: sólo «Abrir», sin «Hacelo por mí»", () => {
    const pasos = [paso(1, "hecho"), paso(6, "pendiente", { id: "preventa", accion: false })];
    const t = tarjetaProgreso(progreso({ pasos: pasos as never, siguiente: pasos[1] as never }));
    expect(t.siguiente).toEqual({ n: 6, titulo: "Paso 6", enlace: "/dashboard/albums/9?tab=t6", mensaje: null });
  });
  it("parseProgreso: accion sólo si viene true (sin el dato, no se ofrece)", () => {
    const sinDato = { ...paso(5, "pendiente") } as Record<string, unknown>;
    delete sinDato.accion;
    const p = parseProgreso({ ...progreso(), pasos: [paso(1, "hecho"), sinDato], siguiente: sinDato })!;
    expect(p.pasos.map((x) => x.accion)).toEqual([true, false]);
    expect(p.siguiente!.accion).toBe(false);
    expect(tarjetaProgreso(p).siguiente!.mensaje).toBeNull();
  });
  it("tarjeta completa y a medias", () => {
    const listo = tarjetaProgreso(progreso({ siguiente: null, pasos: [paso(1, "hecho")] as never }));
    expect(listo.encabezado).toBe("Todos los pasos listos (11 de 11)");
    expect(listo.siguiente).toBeNull();
    expect(tarjetaProgreso(progreso({ aMedias: true })).aviso).toContain("a medias");
  });
  it("enlace externo o raro no se ofrece como «Abrir»", () => {
    const t = tarjetaProgreso(progreso({ pasos: [paso(5, "pendiente", { enlace: "https://evil.com" })] as never }));
    expect(t.siguiente!.enlace).toBeNull();
  });
  it("enlaceInterno: ruta interna con query simple", () => {
    expect(enlaceInterno("/fotografo/escuelas/nueva")).toBe("/fotografo/escuelas/nueva");
    expect(enlaceInterno("/dashboard/albums/9?tab=publicacion&pub=compartir")).toBe("/dashboard/albums/9?tab=publicacion&pub=compartir");
    expect(enlaceInterno("//evil.com")).toBeNull();
    expect(enlaceInterno("/a?x=<b>")).toBeNull();
    expect(enlaceInterno("/a?")).toBeNull();
    expect(enlaceInterno("javascript:alert(1)")).toBeNull();
    expect(enlaceInterno(null)).toBeNull();
  });
  it("mensaje de Hacelo por mí", () => {
    expect(haceloPorMiMensaje("Crear la escuela")).toBe("Hacé por mí el paso: Crear la escuela");
  });
});
