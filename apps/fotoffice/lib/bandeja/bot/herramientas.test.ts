import { describe, expect, it } from "vitest";
import { buscarEnCatalogo, herramientasDeAtencion, type ProductoAtencion } from "./herramientas";

const P = (name: string, pesos: number, variantes: { name: string; pesos: number }[] = []): ProductoAtencion => ({
  name,
  priceMinor: pesos * 100,
  categoryName: null,
  variants: variantes.map((v) => ({ name: v.name, priceMinor: v.pesos * 100 })),
});

const CATALOGO = [
  P("Digitalización de VHS", 12000),
  P("Digitalización de DVD", 12000),
  P("Revelado de rollo", 35000),
  P("Copia para mañana 15x21 · más de 10", 5000),
  P("Copia instantánea 15x21", 8000),
  P("Portarretratos madera 13x18", 0),
];

describe("buscarEnCatalogo", () => {
  it("encuentra por palabras sin importar tildes ni terminaciones", () => {
    const r = buscarEnCatalogo(CATALOGO, "quiero digitalizar unos vhs");
    expect(r[0].name).toBe("Digitalización de VHS");
  });

  it("ordena por cuántas palabras coinciden y deja afuera los de precio 0", () => {
    expect(buscarEnCatalogo(CATALOGO, "copias 15x21").map((p) => p.name)).toEqual([
      "Copia instantánea 15x21",
      "Copia para mañana 15x21 · más de 10",
    ]);
    expect(buscarEnCatalogo(CATALOGO, "portarretratos")).toEqual([]);
  });

  it("sin palabras útiles no devuelve nada", () => {
    expect(buscarEnCatalogo(CATALOGO, "de la")).toEqual([]);
  });
});

describe("herramientasDeAtencion", () => {
  const deps = {
    productos: async () => CATALOGO,
    estudio: async () => ({ nombre: "DNX Estudio", direccion: "San José 1672, Funes", horario: "Lunes a viernes de 8 a 13", ciudad: "Funes" }),
  };

  it("buscar_productos devuelve nombre y precio en pesos", async () => {
    const { tools } = herramientasDeAtencion("w1", deps);
    const t = tools.find((x) => x.name === "buscar_productos")!;
    const r = await t.run({ texto: "rollo" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Revelado de rollo");
    expect(r.message).toMatch(/35\.000/);
  });

  it("buscar_productos sin resultados lo dice", async () => {
    const { tools } = herramientasDeAtencion("w1", deps);
    const r = await tools.find((x) => x.name === "buscar_productos")!.run({ texto: "drones" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/no encontr/i);
  });

  it("datos_del_estudio devuelve dirección y horario", async () => {
    const { tools } = herramientasDeAtencion("w1", deps);
    const r = await tools.find((x) => x.name === "datos_del_estudio")!.run({}, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.message).toContain("San José 1672");
    expect(r.message).toContain("Lunes a viernes");
  });

  it("pasar_a_persona no tiene efectos: sólo deja anotado el motivo", async () => {
    const h = herramientasDeAtencion("w1", deps);
    expect(h.pedidoDePersona()).toBeNull();
    await h.tools.find((x) => x.name === "pasar_a_persona")!.run({ motivo: "presupuesto de boda" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(h.pedidoDePersona()).toBe("presupuesto de boda");
  });

  it("preparar_presupuesto acepta las horas (con media hora) y los invitados y se los pasa al estudio", async () => {
    const recibidos: unknown[] = [];
    const prepararPresupuesto = async (_w: string, _c: unknown, d: unknown) => {
      recibidos.push(d);
      return { ok: true, message: "listo" };
    };
    const h = herramientasDeAtencion("w1", { ...deps, prepararPresupuesto }, { id: "c1", waId: "5493410000000", clientId: null, nombre: null });
    const t = h.tools.find((x) => x.name === "preparar_presupuesto")!;
    const datos = { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 3.5, invitados: 250 };
    expect(t.input.safeParse(datos).success).toBe(true);
    expect(t.input.safeParse({ ...datos, horas: 40 }).success).toBe(false);
    await t.run(datos, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0]).toMatchObject({ horas: 3.5, invitados: 250 });
    expect(t.description).toMatch(/horas/);
  });

  it("cursos_del_estudio devuelve los cursos publicados con precio y enlace", async () => {
    const cursos = async () => [
      { titulo: "Taller de fotografía de XV", modalidad: "GRABADO" as const, resumen: "Clases grabadas para ver a tu ritmo.", precio: 50000, url: "https://fotoffice.com/w/dnx-estudio/cursos/taller-de-xv", proximas: [] },
      { titulo: "Iluminación en estudio", modalidad: "PRESENCIAL" as const, resumen: null, precio: null, url: "https://fotoffice.com/w/dnx-estudio/cursos/luz", proximas: [{ fecha: "sábado 14/11 10:00", lugar: "DNX Estudio", precio: 80000 }] },
    ];
    const t = herramientasDeAtencion("w1", { ...deps, cursos }).tools.find((x) => x.name === "cursos_del_estudio")!;
    const r = await t.run({}, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.message).toContain("Taller de fotografía de XV");
    expect(r.message).toMatch(/\$\s?50\.000/);
    expect(r.message).toContain("https://fotoffice.com/w/dnx-estudio/cursos/taller-de-xv");
    expect(r.message).toContain("grabado");
    expect(r.message).toContain("sábado 14/11 10:00");
    expect(r.message).toMatch(/\$\s?80\.000/);
    const vacio = await herramientasDeAtencion("w1", { ...deps, cursos: async () => [] }).tools.find((x) => x.name === "cursos_del_estudio")!.run({}, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(vacio.message).toMatch(/no hay cursos/i);
  });

  it("armar_pedido_impresion traduce los números de foto y devuelve el resumen con los dos links", async () => {
    const recibidos: unknown[] = [];
    const armarPedido = async (_w: string, _c: unknown, d: unknown) => {
      recibidos.push(d);
      return {
        ok: true as const, numero: 12, subtotal: 28000, envio: 0, total: 28000, sena: 14000, linkSena: "https://mp/sena", linkTotal: "https://mp/total",
        lineas: [{ medida: "13x18", plazo: "MANANA" as const, cantidad: 2, precioUnitario: 7000, costoUnitario: 600, proveedorId: "f", productoId: "p" }],
        fechas: [{ plazo: "MANANA" as const, fecha: "2026-10-29" }],
      };
    };
    const fotos = new Map([[1, "m1"], [2, "m2"]]);
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" }, fotos);
    const t = h.tools.find((x) => x.name === "armar_pedido_impresion")!;
    const entrada = { renglones: [{ fotos: "todas", medida: "13x18", cantidad: 1, plazo: "para mañana" }, { fotos: [2], medida: "10x15", cantidad: 3, plazo: "proxima semana", papel: "mate" }] };
    expect(t.input.safeParse(entrada).success).toBe(true);
    const r = await t.run(entrada, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0]).toMatchObject({
      renglones: [
        { fotos: [{ mensajeId: "m1" }, { mensajeId: "m2" }], medida: "13x18", cantidad: 1, plazo: "MANANA", papel: "BRILLO" },
        { fotos: [{ mensajeId: "m2" }], medida: "10x15", cantidad: 3, plazo: "SEMANA", papel: "MATE" },
      ],
      envio: null,
    });
    expect(r.message).toContain("https://mp/sena");
    expect(r.message).toContain("https://mp/total");
    expect(r.message).toMatch(/\$\s?14\.000/);
    expect(r.message).toMatch(/\$\s?28\.000/);
  });

  it("armar_pedido_impresion: una foto que no existe o un precio que falta se lo explica al bot", async () => {
    const armarPedido = async () => ({ ok: false as const, motivo: "PRECIO" as const, detalle: "13x13 para mañana" });
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido }, { id: "c1", waId: "549", clientId: null, nombre: null }, new Map([[1, "m1"]]));
    const t = h.tools.find((x) => x.name === "armar_pedido_impresion")!;
    const sinFoto = await t.run({ renglones: [{ fotos: [5], medida: "13x18", cantidad: 1, plazo: "para mañana" }] }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(sinFoto.message).toMatch(/foto 5/);
    const sinPrecio = await t.run({ renglones: [{ fotos: [1], medida: "13x13", cantidad: 1, plazo: "para mañana" }] }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(sinPrecio.message).toContain("13x13 para mañana");
    expect(sinPrecio.message).toContain("pasar_a_persona");
  });

  it("todas son de lectura (no hay acciones que confirmar)", () => {
    expect(herramientasDeAtencion("w1", deps).tools.every((t) => t.kind === "read")).toBe(true);
  });
});
