import { describe, expect, it, vi } from "vitest";
import { buscarEnCatalogo, herramientasDeAtencion, textoFotolibro, type ProductoAtencion } from "./herramientas";

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

describe("filtro del último pedido del chat", () => {
  it("incluye los pedidos sin error (lastError nulo) y excluye sólo los reemplazados", async () => {
    const { filtroPedidosDelChat } = await import("./herramientas");
    expect(filtroPedidosDelChat("w1", "c1")).toEqual({
      workspaceId: "w1", waChatId: "c1", OR: [{ lastError: null }, { lastError: { not: "REEMPLAZADO" } }],
    });
  });
});

describe("herramientasDeAtencion", () => {
  const deps = {
    productos: async () => CATALOGO,
    estudio: async () => ({ nombre: "DNX Estudio", direccion: "San José 1672, Funes", horario: "Lunes a viernes de 8 a 13", ciudad: "Funes" }),
    // Sin alias ni CVU cargados: el bot sigue con los links de Mercado Pago, como antes.
    datosTransferencia: async () => null,
  };
  const TRANSFERENCIA = { alias: "estudio.fotos.mp", cbuCvu: "0000003100012345678901", titular: "Estudio Ejemplo", banco: "Mercado Pago", cuit: null };

  it("buscar_productos devuelve nombre y precio en pesos", async () => {
    const { tools } = herramientasDeAtencion("w1", deps);
    const t = tools.find((x) => x.name === "buscar_productos")!;
    const r = await t.run({ texto: "rollo" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Revelado de rollo");
    expect(r.message).toMatch(/35\.000/);
  });

  it("buscar_productos avisa lo que no tiene stock y cuánto queda", async () => {
    const { tools } = herramientasDeAtencion("w1", {
      ...deps,
      productos: async () => [
        { ...P("Portarretratos madera 13x18", 9000), tracksStock: true, stockQty: 0 },
        { ...P("Portarretratos vidrio 13x18", 9500), tracksStock: true, stockQty: 3 },
        { ...P("Portarretratos VGO", 0), tracksStock: true, stockQty: 0, variants: [{ name: "Negro", priceMinor: 1_000_000, stockQty: 0 }, { name: "Blanco", priceMinor: 1_000_000, stockQty: 4 }] },
      ],
    });
    const r = await tools.find((x) => x.name === "buscar_productos")!.run({ texto: "portarretratos" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(r.message).toMatch(/madera 13x18: \$\s?9\.000 \(sin stock\)/);
    expect(r.message).toMatch(/vidrio 13x18: \$\s?9\.500 \(quedan 3\)/);
    expect(r.message).toMatch(/Negro \$\s?10\.000 \(sin stock\)/);
    expect(r.message).toMatch(/Blanco \$\s?10\.000 \(quedan 4\)/);
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

  it("armar_pedido vende del catálogo con seña y devuelve el enlace; un nombre dudoso vuelve al bot", async () => {
    const recibidos: unknown[] = [];
    const armarPedidoCatalogo = async (_w: string, _c: unknown, d: { lineas: { producto: string }[] }) => {
      recibidos.push(d);
      if (d.lineas[0].producto === "pendrive") return { ok: false as const, motivo: "PRODUCTO" as const, detalle: '"pendrive" puede ser: Pendrive 64 GB, Pendrive 128 GB.' };
      return {
        ok: true as const, numero: "2026-0042", lineas: [{ nombre: "Digitalización de VHS", cantidad: 5, precio: 12000 }],
        total: 60000, aPagarAhora: 30000, saldo: 30000, url: "https://fotoffice.com/p/tok", fotos: 0,
      };
    };
    const h = herramientasDeAtencion("w1", { ...deps, armarPedidoCatalogo }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" });
    const t = h.tools.find((x) => x.name === "armar_pedido")!;
    const entrada = { lineas: [{ producto: "Digitalización de VHS", cantidad: 5 }], pago: "seña", nombre: "Ana Pérez" };
    expect(t.input.safeParse(entrada).success).toBe(true);
    const r = await t.run(entrada, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0]).toEqual({ lineas: [{ producto: "Digitalización de VHS", cantidad: 5 }], pago: "SENA", nombre: "Ana Pérez", email: null });
    expect(r.message).toContain("https://fotoffice.com/p/tok");
    expect(r.message).toContain("30.000");
    expect(h.pedidoDePersona()).toBeNull();
    const dudoso = await t.run({ lineas: [{ producto: "pendrive", cantidad: 1 }], pago: "total", nombre: "Ana Pérez" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(dudoso.message).toContain("Pendrive 128 GB");
  });

  it("armar_pedido: por omisión da los datos para transferir y pide el comprobante; con medio tarjeta, el enlace", async () => {
    const armarPedidoCatalogo = async () => ({
      ok: true as const, numero: "2026-0042", lineas: [{ nombre: "Digitalización de VHS", cantidad: 5, precio: 12000 }],
      total: 60000, aPagarAhora: 30000, saldo: 30000, url: "https://fotoffice.com/p/tok", fotos: 0,
    });
    const h = herramientasDeAtencion("w1", { ...deps, armarPedidoCatalogo, datosTransferencia: async () => TRANSFERENCIA }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" });
    const t = h.tools.find((x) => x.name === "armar_pedido")!;
    const actor = { userId: 0, role: "CLIENTE", email: "", name: null };
    const entrada = { lineas: [{ producto: "Digitalización de VHS", cantidad: 5 }], pago: "seña", nombre: "Ana Pérez" };
    const r = await t.run(entrada, actor);
    expect(r.message).toContain("estudio.fotos.mp");
    expect(r.message).toContain("0000003100012345678901");
    expect(r.message).toContain("Estudio Ejemplo");
    expect(r.message).toContain("comprobante");
    expect(r.message).not.toContain("https://fotoffice.com/p/tok");
    expect(t.input.safeParse({ ...entrada, medio: "tarjeta" }).success).toBe(true);
    const tarjeta = await t.run({ ...entrada, medio: "tarjeta" }, actor);
    expect(tarjeta.message).toContain("https://fotoffice.com/p/tok");
    expect(tarjeta.message).not.toContain("estudio.fotos.mp");
  });

  it("armar_pedido traduce los números de foto de cada renglón", async () => {
    const recibidos: { lineas: unknown[] }[] = [];
    const armarPedidoCatalogo = async (_w: string, _c: unknown, d: { lineas: unknown[] }) => {
      recibidos.push(d);
      return { ok: true as const, numero: "2026-0050", lineas: [{ nombre: "Fotoimán 10x15", cantidad: 2, precio: 3600 }], total: 7200, aPagarAhora: 3600, saldo: 3600, url: "https://fotoffice.com/p/t", fotos: 2 };
    };
    const fotos = new Map([[1, { id: "m1", en: new Date("2026-10-28T10:00:00Z") }], [2, { id: "m2", en: new Date("2026-10-28T10:01:00Z") }]]);
    const h = herramientasDeAtencion("w1", { ...deps, armarPedidoCatalogo, ultimoPedidoEn: async () => null }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" }, fotos);
    const t = h.tools.find((x) => x.name === "armar_pedido")!;
    const entrada = { lineas: [{ producto: "Fotoimán 10x15", cantidad: 2, fotos: [2, 1] }], pago: "seña", nombre: "Ana Pérez" };
    expect(t.input.safeParse(entrada).success).toBe(true);
    const r = await t.run(entrada, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0].lineas).toEqual([{ producto: "Fotoimán 10x15", cantidad: 2, fotos: [{ mensajeId: "m2" }, { mensajeId: "m1" }] }]);
    expect(r.message).toMatch(/2 fotos/);
    const todas = await t.run({ lineas: [{ producto: "Fotoimán 10x15", cantidad: 2, fotos: "todas" }], pago: "seña", nombre: "Ana Pérez" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(todas.ok).toBe(true);
    expect(recibidos[1].lineas).toEqual([{ producto: "Fotoimán 10x15", cantidad: 2, fotos: [{ mensajeId: "m1" }, { mensajeId: "m2" }] }]);
    const falta = await t.run({ lineas: [{ producto: "Fotoimán 10x15", cantidad: 1, fotos: [7] }], pago: "seña", nombre: "Ana Pérez" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(falta.message).toMatch(/foto 7/);
    expect(recibidos).toHaveLength(2);
  });

  it("cotizar_fotolibro usa la calculadora y le dice al bot cómo venderlo", async () => {
    const pedidos: unknown[] = [];
    const cotizarFotolibro = async (_w: string, p: unknown) => {
      pedidos.push(p);
      return {
        tipo: "PRECIO" as const, proveedorId: "roman", modelo: "Gold", medida: "30x45", hojas: 18, fotos: 180,
        precioMinor: 52_900_000, costoMinor: 1, caja: { precioMinor: 12_600_000, costoMinor: 1 }, conCaja: false,
      };
    };
    const h = herramientasDeAtencion("w1", { ...deps, cotizarFotolibro });
    const t = h.tools.find((x) => x.name === "cotizar_fotolibro")!;
    const r = await t.run({ tapa: "rigida", modelo: "gold", medida: "30x45", fotos: 180 }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(pedidos[0]).toEqual({ tapa: "RIGIDA", modelo: "gold", medida: "30x45", fotos: 180 });
    expect(r.message).toMatch(/Gold 30x45, 18 hojas/);
    expect(r.message).toMatch(/529\.000/);
    expect(r.message).toMatch(/Caja .*126\.000/);
    expect(r.message).toContain('"Fotolibro tapa rígida"');
    // El costo nunca sale en el texto.
    expect(r.message).not.toMatch(/costo/i);
  });

  it("cotizar_fotolibro sin modelo da rangos y no manda la lista entera", () => {
    const texto = textoFotolibro({ tipo: "RANGO", fotos: 100, modelos: ["Basic", "Gold"], filas: [{ medida: "30x45", hojas: 10, desdeMinor: 12_600_000, hastaMinor: 18_000_000, desdeModelo: "Basic" }] }, "rigida");
    expect(texto).toMatch(/30x45 \(10 hojas\): desde .*126\.000 \(tapa Basic\) hasta .*180\.000/);
    expect(texto).toMatch(/No le mandes la lista entera/);
  });

  it("armar_pedido_impresion traduce los números de foto y devuelve el resumen con los dos links", async () => {
    const recibidos: unknown[] = [];
    const armarPedido = async (_w: string, _c: unknown, d: unknown) => {
      recibidos.push(d);
      return {
        ok: true as const, numero: 12, subtotal: 28000, envio: 0, total: 28000, sena: 14000, depositPct: 50, linkSena: "https://mp/sena", linkTotal: "https://mp/total",
        lineas: [{ medida: "13x18", plazo: "MANANA" as const, cantidad: 2, precioUnitario: 7000, costoUnitario: 600, proveedorId: "f", productoId: "p" }],
        fechas: [{ plazo: "MANANA" as const, fecha: "2026-10-29" }],
      };
    };
    const fotos = new Map([[1, { id: "m1", en: new Date("2026-10-28T10:00:00Z") }], [2, { id: "m2", en: new Date("2026-10-28T10:01:00Z") }]]);
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido, ultimoPedidoEn: async () => null }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" }, fotos);
    const t = h.tools.find((x) => x.name === "armar_pedido_impresion")!;
    const entrada = { renglones: [{ fotos: "todas", medida: "13x18", cantidad: 1, plazo: "para mañana" }, { fotos: [2], medida: "10x15", cantidad: 3, plazo: "proxima semana", papel: "mate" }], email: "ana@test.com" };
    expect(t.input.safeParse(entrada).success).toBe(true);
    const r = await t.run(entrada, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0]).toMatchObject({
      renglones: [
        { fotos: [{ mensajeId: "m1" }, { mensajeId: "m2" }], medida: "13x18", cantidad: 1, plazo: "MANANA", papel: "BRILLO" },
        { fotos: [{ mensajeId: "m2" }], medida: "10x15", cantidad: 3, plazo: "SEMANA", papel: "MATE" },
      ],
      envio: null,
      email: "ana@test.com",
    });
    expect(r.message).toContain("https://mp/sena");
    expect(r.message).toContain("ana@test.com");
    expect(r.message).toContain("https://mp/total");
    expect(r.message).toMatch(/\$\s?14\.000/);
    expect(r.message).toContain("Seña del 50 %");
    expect(r.message).toMatch(/\$\s?28\.000/);
  });

  it("armar_pedido_impresion: por omisión, transferencia (sin links); con medio tarjeta, los dos links", async () => {
    const armarPedido = async () => ({
      ok: true as const, numero: 12, subtotal: 28000, envio: 0, total: 28000, sena: 14000, depositPct: 50, linkSena: "https://mp/sena", linkTotal: "https://mp/total",
      lineas: [{ medida: "13x18", plazo: "MANANA" as const, cantidad: 2, precioUnitario: 7000, costoUnitario: 600, proveedorId: "f", productoId: "p" }],
      fechas: [{ plazo: "MANANA" as const, fecha: "2026-10-29" }],
    });
    const fotos = new Map([[1, { id: "m1", en: new Date("2026-10-28T10:00:00Z") }]]);
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido, ultimoPedidoEn: async () => null, datosTransferencia: async () => TRANSFERENCIA }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" }, fotos);
    const t = h.tools.find((x) => x.name === "armar_pedido_impresion")!;
    const actor = { userId: 0, role: "CLIENTE", email: "", name: null };
    const entrada = { renglones: [{ fotos: [1], medida: "13x18", cantidad: 2, plazo: "para mañana" }] };
    const r = await t.run(entrada, actor);
    expect(r.message).toContain("Alias: estudio.fotos.mp");
    expect(r.message).toContain("Banco: Mercado Pago");
    expect(r.message).toContain("mande el comprobante por acá");
    expect(r.message).not.toContain("https://mp/");
    expect(r.message).toMatch(/\$\s?14\.000/);
    const tarjeta = await t.run({ ...entrada, medio: "tarjeta" }, actor);
    expect(tarjeta.message).toContain("https://mp/sena");
    expect(tarjeta.message).toContain("https://mp/total");
    expect(tarjeta.message).not.toContain("estudio.fotos.mp");
  });

  it("'todas' son las fotos posteriores al último pedido; avisa las que se están bajando; la seña dice el % configurado", async () => {
    const recibidos: { renglones: { fotos: { mensajeId: string }[] }[] }[] = [];
    const armarPedido = async (_w: string, _c: unknown, d: unknown) => {
      recibidos.push(d as never);
      return {
        ok: true as const, numero: 13, subtotal: 10000, envio: 0, total: 10000, sena: 3000, depositPct: 30, linkSena: "s", linkTotal: "t",
        lineas: [], fechas: [{ plazo: "MANANA" as const, fecha: "2026-10-29" }],
      };
    };
    const fotos = new Map([[1, { id: "vieja", en: new Date("2026-10-20T10:00:00Z") }], [2, { id: "nueva", en: new Date("2026-10-28T10:00:00Z") }]]);
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido, ultimoPedidoEn: async () => new Date("2026-10-21T00:00:00Z") }, { id: "c1", waId: "549", clientId: null, nombre: "Ana" }, fotos, 1);
    const r = await h.tools.find((x) => x.name === "armar_pedido_impresion")!.run({ renglones: [{ fotos: "todas", medida: "10x15", cantidad: 1, plazo: "para mañana" }] }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0].renglones[0].fotos).toEqual([{ mensajeId: "nueva" }]);
    expect(r.message).toContain("Seña del 30 %");
    expect(r.message).not.toContain("50 %");
    expect(r.message).toMatch(/1 foto.*todavía se está bajando/);
  });

  it("armar_pedido_impresion: una foto que no existe o un precio que falta se lo explica al bot", async () => {
    const armarPedido = async () => ({ ok: false as const, motivo: "PRECIO" as const, detalle: "13x13 para mañana" });
    const h = herramientasDeAtencion("w1", { ...deps, armarPedido, ultimoPedidoEn: async () => null }, { id: "c1", waId: "549", clientId: null, nombre: null }, new Map([[1, { id: "m1", en: null }]]));
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

describe("herramientasDeAtencion en un chat de Instagram", () => {
  const IG = { id: "c-ig", waId: "17841400000000001", clientId: null, nombre: "Sofi", canal: "INSTAGRAM" as const, usuarioInstagram: "sofi.r" };

  it("no arma pedidos ni cotiza fotolibros: sólo precios, cursos, datos, cotización de eventos y pasar a persona", () => {
    const { tools } = herramientasDeAtencion("w1", {}, IG);
    expect(tools.map((t) => t.name)).toEqual([
      "buscar_productos", "cursos_del_estudio", "datos_del_estudio", "presentacion_xv", "preparar_presupuesto",
      "fecha_disponible", "paquetes_del_evento", "enviar_cotizacion_del_paquete", "pasar_a_persona", "no_responder",
    ]);
  });

  it("preparar_presupuesto acepta el WhatsApp que dio el cliente y se lo pasa al estudio", async () => {
    const recibidos: unknown[] = [];
    const prepararPresupuesto = async (_w: string, _c: unknown, d: unknown) => {
      recibidos.push(d);
      return { ok: true, message: "listo" };
    };
    const t = herramientasDeAtencion("w1", { prepararPresupuesto, vendedora: async () => null }, IG).tools.find((x) => x.name === "preparar_presupuesto")!;
    const datos = { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "341 555-1234" };
    expect(t.input.safeParse(datos).success).toBe(true);
    expect(t.input.safeParse({ ...datos, whatsapp: "1".repeat(31) }).success).toBe(false);
    await t.run(datos, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(recibidos[0]).toMatchObject({ whatsapp: "341 555-1234" });
  });

  it("en WhatsApp siguen todas las herramientas", () => {
    const { tools } = herramientasDeAtencion("w1", {}, { id: "c1", waId: "5493410000000", clientId: null, nombre: null });
    expect(tools.map((t) => t.name)).toContain("armar_pedido_impresion");
    expect(tools.map((t) => t.name)).toContain("estado_de_mi_pedido");
  });
});


describe("XV y bodas: fecha, paquetes y pase a ventas (spec 2026-11-20)", () => {
  const ACTOR = { userId: 0, role: "CLIENTE", email: "", name: null };
  const CHAT = { id: "c1", waId: "5493410000000", clientId: null, nombre: "Laura" };
  const PAQ = {
    categoriaId: "cat-boda", categoria: "Boda", conOpciones: true,
    paquetes: [{ nombre: "Básico", total: 450000 }, { nombre: "Intermedio", total: 620000 }, { nombre: "Premium", total: 890000 }],
  };
  const GIULI = { userId: 7, nombre: "Giuli", esResponsable: true };
  const DATOS = { evento: "boda", paquete: "intermedio", nombre: "Laura Gómez", fecha: "2027-03-13", lugar: "Salón Los Álamos, Funes", horario: "21 a 5", horas: 8 };
  const herramienta = (h: ReturnType<typeof herramientasDeAtencion>, nombre: string) => h.tools.find((t) => t.name === nombre)!;

  it("fecha_disponible: libre, el dueño ya tiene un evento (con su nombre) o completa", async () => {
    const con = (contratados: number) =>
      herramientasDeAtencion("w1", { ocupacionDelDia: async () => ({ contratados, capacidad: 2, dueno: "Daniel", estudio: "DNX Estudio" }) }, CHAT);
    const pedir = async (n: number) => (await herramienta(con(n), "fecha_disponible").run({ fecha: "2099-03-13" }, ACTOR)).message;
    expect(await pedir(0)).toContain("La fecha está libre");
    expect(await pedir(1)).toContain("Ese día Daniel, el dueño de DNX Estudio, ya tiene un evento.");
    expect(await pedir(2)).toContain("fecha completa");
    expect(herramienta(con(0), "fecha_disponible").input.safeParse({ fecha: "13/03/2027" }).success).toBe(false);
  });

  it("fecha_disponible sin poder leer la agenda no dice nada sobre la fecha", async () => {
    const h = herramientasDeAtencion("w1", { ocupacionDelDia: async () => null }, CHAT);
    expect((await herramienta(h, "fecha_disponible").run({ fecha: "2099-03-13" }, ACTOR)).message).toContain("sin decir nada sobre la fecha");
  });

  it("paquetes_del_evento da el enlace de bodas y los precios de la propuesta modelo", async () => {
    const pedidos: string[] = [];
    const h = herramientasDeAtencion("w1", { paquetesDelEvento: async (_w, e) => (pedidos.push(e), PAQ) }, CHAT);
    const r = await herramienta(h, "paquetes_del_evento").run({ evento: "boda" }, ACTOR);
    expect(pedidos).toEqual(["BODA"]);
    expect(r.message).toContain("https://www.compramelafoto.com/dnx/bodas");
    expect(r.message).toContain("- Premium: $890.000");
  });

  it("enviar_cotizacion_del_paquete manda el paquete elegido (sin Telegram) y deja el chat para ventas", async () => {
    const enviados: unknown[] = [];
    const h = herramientasDeAtencion(
      "w1",
      {
        paquetesDelEvento: async () => PAQ,
        vendedora: async () => GIULI,
        enviarCotizacionDelPaquete: async (_w, _c, datos, paquete) => (enviados.push({ datos, paquete }), { ok: true, message: "Listo: salió." }),
      },
      CHAT,
    );
    const t = herramienta(h, "enviar_cotizacion_del_paquete");
    expect(t.input.safeParse(DATOS).success).toBe(true);
    expect(t.input.safeParse({ ...DATOS, evento: "bautismo" }).success).toBe(false);
    const r = await t.run(DATOS, ACTOR);
    expect(enviados[0]).toMatchObject({
      datos: { tipo: "Boda", nombre: "Laura Gómez", fecha: "2027-03-13", lugar: "Salón Los Álamos, Funes", horas: 8, detalle: expect.stringContaining("Horario: 21 a 5.") },
      paquete: { categoriaId: "cat-boda", categoria: "Boda", nombre: "Intermedio" },
    });
    expect(r.message).toContain("Te dejo con Giuli, de nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊");
    expect(h.paseAVentas()).toEqual({ persona: GIULI, motivo: "le salió la cotización del paquete Intermedio" });
    expect(h.pedidoDePersona()).toBeNull();
  });

  it("con un paquete que no existe no manda nada ni pasa el chat", async () => {
    const enviar = vi.fn();
    const h = herramientasDeAtencion("w1", { paquetesDelEvento: async () => PAQ, vendedora: async () => GIULI, enviarCotizacionDelPaquete: enviar }, CHAT);
    const r = await herramienta(h, "enviar_cotizacion_del_paquete").run({ ...DATOS, paquete: "Gold" }, ACTOR);
    expect(r.message).toContain("Los paquetes son: Básico, Intermedio, Premium");
    expect(enviar).not.toHaveBeenCalled();
    expect(h.paseAVentas()).toBeNull();
  });

  it("si la cotización del paquete no salió, el chat no pasa a ventas", async () => {
    const h = herramientasDeAtencion(
      "w1",
      { paquetesDelEvento: async () => PAQ, vendedora: async () => GIULI, enviarCotizacionDelPaquete: async () => ({ ok: false, message: "usá pasar_a_persona" }) },
      CHAT,
    );
    await herramienta(h, "enviar_cotizacion_del_paquete").run(DATOS, ACTOR);
    expect(h.paseAVentas()).toBeNull();
  });

  it("preparar_presupuesto de XV o boda (personalizado) también pasa a ventas; otro evento sigue igual", async () => {
    const prepararPresupuesto = async () => ({ ok: true, message: "Listo, el estudio ya está armando la cotización." });
    const xv = herramientasDeAtencion("w1", { prepararPresupuesto, vendedora: async () => ({ userId: 1, nombre: "Daniel", esResponsable: false }) }, CHAT);
    const r = await herramienta(xv, "preparar_presupuesto").run({ tipo: "15 años", nombre: "Sofía Rodríguez", detalle: "Intermedio con video" }, ACTOR);
    expect(r.message).toContain("Te dejo con Daniel, que te va a acompañar para cerrar todo 😊");
    expect(xv.paseAVentas()).toMatchObject({ persona: { userId: 1 } });

    const otro = herramientasDeAtencion("w1", { prepararPresupuesto, vendedora: async () => GIULI }, CHAT);
    const r2 = await herramienta(otro, "preparar_presupuesto").run({ tipo: "bautismo", nombre: "Ana Pérez" }, ACTOR);
    expect(r2.message).not.toContain("Te dejo con");
    expect(otro.paseAVentas()).toBeNull();
  });

  it("si ya había una cotización en preparación no pasa el chat", async () => {
    const prepararPresupuesto = async () => ({ ok: true, message: "Ya hay una cotización en preparación para este cliente." });
    const h = herramientasDeAtencion("w1", { prepararPresupuesto, vendedora: async () => GIULI }, CHAT);
    await herramienta(h, "preparar_presupuesto").run({ tipo: "boda", nombre: "Ana Pérez" }, ACTOR);
    expect(h.paseAVentas()).toBeNull();
  });
});
