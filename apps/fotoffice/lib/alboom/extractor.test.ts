import { describe, expect, it } from "vitest";
import { avanceInicial, leerAvance, type Avance } from "./avance";
import { AlboomApiError, AlboomLoginError, esRutaDeLectura, type ClienteAlboom, type PedidoLectura } from "./client";
import { ENTIDADES, entidadPorClave, type Entidad } from "./entidades";
import { armarFilas, detectarId, ejecutarTanda, FALLAS_SEGUIDAS_PAUSA, FALLAS_SIN_EXITO, tamanoMenor, type Almacen, type FilaCruda } from "./extractor";
import { huella } from "./huella";

const WS = "ws-1";

/** Almacén en memoria con la misma regla que el de Prisma: nuevo / cambió la huella / igual. */
function almacenEnMemoria() {
  const filas = new Map<string, FilaCruda & { entity: string; workspaceId: string }>();
  const clave = (ws: string, e: string, id: string) => `${ws}|${e}|${id}`;
  const almacen: Almacen = {
    async guardarFilas(workspaceId, entity, nuevas) {
      let nuevos = 0, cambiados = 0, iguales = 0;
      const tocados: string[] = [];
      for (const f of nuevas) {
        const k = clave(workspaceId, entity, f.alboomId);
        const previa = filas.get(k);
        if (!previa) nuevos++;
        else if (previa.hash !== f.hash) cambiados++;
        else iguales++;
        if (!previa || previa.hash !== f.hash) tocados.push(f.alboomId);
        filas.set(k, { ...f, entity, workspaceId });
      }
      return { nuevos, cambiados, iguales, tocados };
    },
    async leerLote(workspaceId, entity, despuesDe, limite) {
      return [...filas.values()]
        .filter((f) => f.workspaceId === workspaceId && f.entity === entity && (despuesDe === null || f.alboomId > despuesDe))
        .sort((a, b) => (a.alboomId < b.alboomId ? -1 : 1))
        .slice(0, limite)
        .map((f) => ({ alboomId: f.alboomId, payload: f.payload }));
    },
  };
  const de = (entity: string) => [...filas.values()].filter((f) => f.entity === entity);
  return { almacen, filas, de };
}

/** Cliente falso: responde por ruta, cuenta pedidos y verifica que todo esté en la lista blanca. */
function clienteFalso(responder: (p: PedidoLectura) => unknown) {
  const pedidos: PedidoLectura[] = [];
  const cliente: ClienteAlboom = {
    async leer(p) {
      if (!esRutaDeLectura(p.method, p.ruta)) throw new Error(`fuera de la lista blanca: ${p.method} ${p.ruta}`);
      pedidos.push(p);
      return responder(p);
    },
    pedidosHechos: () => pedidos.length,
  };
  return { cliente, pedidos };
}

/** Reloj que avanza 1 s por pedido. */
function reloj() {
  let t = 0;
  return { ahora: () => t, tick: () => (t += 1000) };
}

function tanda(o: {
  cliente: ClienteAlboom;
  almacen: Almacen;
  avance?: Avance;
  entidades?: readonly Entidad[];
  limite?: number;
  ahora?: () => number;
  guardar?: (a: Avance) => Promise<boolean>;
  tamanoPagina?: number;
  modo?: "TODO" | "INCREMENTAL";
  anteriores?: Avance[];
}) {
  return ejecutarTanda({
    workspaceId: WS,
    cliente: o.cliente,
    almacen: o.almacen,
    avance: o.avance ?? avanceInicial(),
    ahora: o.ahora ?? (() => 0),
    limite: o.limite ?? Number.MAX_SAFE_INTEGER,
    margenMs: 0,
    guardar: o.guardar ?? (async () => true),
    entidades: o.entidades,
    tamanoPagina: o.tamanoPagina,
    modo: o.modo,
    anteriores: o.anteriores,
  });
}

const contactos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Contacto ${i + 1}` }));
const ENT_CONTACTOS: Entidad = {
  clave: "contactos",
  nombre: "Contactos",
  fuente: { tipo: "paginada", ruta: "/contacts/paginate", body: (pagina, tamano) => ({ pageNumber: pagina, pageSize: tamano }) },
};

function paginar(todos: unknown[], p: PedidoLectura) {
  const b = p.body as { pageNumber: number; pageSize: number };
  return { rows: todos.slice((b.pageNumber - 1) * b.pageSize, b.pageNumber * b.pageSize), count: String(todos.length) };
}

describe("identificadores y huellas", () => {
  it("usa `id`, después las claves de la entidad, y si no la huella (sumando una duda)", () => {
    expect(detectarId({ id: 7 })).toBe("7");
    expect(detectarId({ id: "", name: "Bodas" }, ["name"])).toBe("Bodas");
    expect(detectarId({ x: 1 })).toBeNull();
    const ent: Entidad = { clave: "x", nombre: "x", claves: ["name"], fuente: { tipo: "noDisponible", motivo: "" } };
    const r = armarFilas(ent, [{ id: 1 }, { name: "a" }, { otra: true }], null);
    expect(r.filas.map((f) => f.alboomId)).toEqual(["1", "a", `h${huella({ otra: true }).slice(0, 32)}`]);
    expect(r.dudas).toBe(1);
    // Con `idEsperado: false` (historiales) no es duda.
    expect(armarFilas({ ...ent, idEsperado: false }, [{ otra: true }], "5").dudas).toBe(0);
    // Hijos: con el padre adelante.
    expect(armarFilas(ent, [{ id: 9 }], "5").filas[0]!.alboomId).toBe("5/9");
    // Repetidos en la misma respuesta: queda uno y suma una duda.
    expect(armarFilas(ent, [{ id: 1, v: 1 }, { id: 1, v: 2 }], null)).toMatchObject({ dudas: 1, filas: [{ alboomId: "1", payload: { id: 1, v: 2 } }] });
  });

  it("la huella no depende del orden de las claves", () => {
    expect(huella({ a: 1, b: { c: [1, 2], d: null } })).toBe(huella({ b: { d: null, c: [1, 2] }, a: 1 }));
    expect(huella({ a: 1 })).not.toBe(huella({ a: 2 }));
    expect(huella({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractor", () => {
  it("pagina hasta el final (por `count` y por página corta) y guarda crudo cada registro", async () => {
    const todos = contactos(250);
    const { cliente, pedidos } = clienteFalso((p) => paginar(todos, p));
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("COMPLETA");
    expect(pedidos.map((p) => (p.body as { pageNumber: number }).pageNumber)).toEqual([1, 2, 3]);
    expect(m.de("contactos")).toHaveLength(250);
    expect(m.de("contactos").find((f) => f.alboomId === "17")!.payload).toEqual({ id: "17", name: "Contacto 17" });
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", cantidad: 250, nuevos: 250, paginas: 3 });

    // Con count exacto múltiplo de la página, no pide una página vacía de más.
    const cien = contactos(200);
    const c2 = clienteFalso((p) => paginar(cien, p));
    await tanda({ cliente: c2.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(c2.pedidos).toHaveLength(2);
  });

  it("con `count`, una página corta NO es el final: sigue hasta el total (Alboom puede limitar el tamaño)", async () => {
    const todos = contactos(130);
    // El servidor devuelve como mucho 50 por página, aunque se pidan 100 (desplazamiento por lo devuelto).
    let entregadas = 0;
    const { cliente, pedidos } = clienteFalso(() => {
      const filas = todos.slice(entregadas, entregadas + 50);
      entregadas += filas.length;
      return { rows: filas, count: 130 };
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("COMPLETA");
    expect(pedidos).toHaveLength(3);
    expect(m.de("contactos")).toHaveLength(130);
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 0 });

    // Si se acaba antes del total (página vacía), termina pero deja la duda a la vista.
    const corto = clienteFalso((p) => {
      const b = p.body as { pageNumber: number };
      return { rows: b.pageNumber === 1 ? contactos(40) : [], count: 90 };
    });
    const r2 = await tanda({ cliente: corto.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1, ultimoError: "Alboom informó 90 registros y llegaron 40" });
    expect(corto.pedidos).toHaveLength(2);
  });

  it("si Alboom ignora la página y repite la misma, frena con una duda en vez de dar vueltas", async () => {
    const todos = contactos(100);
    const sinCount = clienteFalso(() => ({ rows: todos }));
    const r = await tanda({ cliente: sinCount.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(sinCount.pedidos).toHaveLength(2);
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1 });
    expect(r.avance.entidades.contactos!.ultimoError).toMatch(/misma página/);

    const conCount = clienteFalso(() => ({ rows: todos.slice(0, 50), count: 500 }));
    const r2 = await tanda({ cliente: conCount.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(conCount.pedidos).toHaveLength(2);
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("un error que no es de Alboom (la base) corta la tanda en vez de dejar la entidad en ERROR", async () => {
    const { cliente } = clienteFalso((p) => paginar(contactos(10), p));
    const m = almacenEnMemoria();
    m.almacen.guardarFilas = async () => {
      throw new Error("conexión cortada");
    };
    const avance = avanceInicial();
    await expect(tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance })).rejects.toThrow("conexión cortada");
    expect(avance.entidades.contactos!.estado).not.toBe("ERROR");
  });

  it("se frena por tiempo y la tanda siguiente retoma desde la página guardada, sin repetir", async () => {
    const todos = contactos(450);
    const r0 = reloj();
    const { cliente, pedidos } = clienteFalso((p) => {
      r0.tick();
      return paginar(todos, p);
    });
    const m = almacenEnMemoria();
    const guardados: Avance[] = [];
    const guardar = async (a: Avance) => {
      guardados.push(JSON.parse(JSON.stringify(a)) as Avance);
      return true;
    };
    // Presupuesto para 2 pedidos (1 s cada uno).
    const a = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], ahora: r0.ahora, limite: 1500, guardar });
    expect(a.resultado).toBe("PAUSADA");
    expect(pedidos).toHaveLength(2);
    expect(a.avance.entidades.contactos).toMatchObject({ estado: "EN_CURSO", pagina: 3, cantidad: 200 });

    // Lo que retoma la próxima tanda es lo que quedó GUARDADO en la base (pasa por JSON).
    const avanceGuardado = leerAvance(JSON.parse(JSON.stringify(guardados.at(-1))));
    const b = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance: avanceGuardado });
    expect(b.resultado).toBe("COMPLETA");
    expect(pedidos.map((p) => (p.body as { pageNumber: number }).pageNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(m.de("contactos")).toHaveLength(450);
    expect(b.avance.entidades.contactos).toMatchObject({ estado: "LISTA", cantidad: 450, nuevos: 450, iguales: 0 });
  });

  it("volver a extraer es idempotente: lo igual no cambia, lo modificado se cuenta como cambiado", async () => {
    let todos = contactos(30);
    const { cliente } = clienteFalso((p) => paginar(todos, p));
    const m = almacenEnMemoria();
    await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    todos = todos.map((c) => (c.id === "3" ? { ...c, name: "Cambiado" } : c));
    todos.push({ id: "31", name: "Nuevo" });
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.avance.entidades.contactos).toMatchObject({ cantidad: 31, nuevos: 1, cambiados: 1, iguales: 29 });
    expect(m.de("contactos")).toHaveLength(31);
  });

  it("si la cancelan, frena al guardar el próximo avance", async () => {
    const todos = contactos(500);
    const { cliente, pedidos } = clienteFalso((p) => paginar(todos, p));
    let guardadas = 0;
    const r = await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS], guardar: async () => ++guardadas < 2 });
    expect(r.resultado).toBe("CANCELADA");
    expect(pedidos).toHaveLength(2);
  });

  it("401 → CREDENCIAL; 429/5xx → REINTENTAR sin mover el cursor", async () => {
    const login = clienteFalso(() => {
      throw new AlboomLoginError();
    });
    expect((await tanda({ cliente: login.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] })).resultado).toBe("CREDENCIAL");

    const todos = contactos(300);
    let n = 0;
    const lim = clienteFalso((p) => {
      if (++n === 2) throw new AlboomApiError("Alboom respondió 429", 429, true);
      return paginar(todos, p);
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente: lim.cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("REINTENTAR");
    expect(r.avance.entidades.contactos).toMatchObject({ pagina: 2, cantidad: 100 });
    const r2 = await tanda({ cliente: lim.cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance: r.avance });
    expect(r2.resultado).toBe("COMPLETA");
    expect(m.de("contactos")).toHaveLength(300);
  });

  it("un 404 o una forma desconocida frenan sólo esa entidad (con duda) y sigue con la próxima", async () => {
    const otra: Entidad = { clave: "tipos_cita", nombre: "Tipos", fuente: { tipo: "simple", pedido: { method: "GET", ruta: "/eventtypes" }, filas: (j) => (Array.isArray(j) ? j : null) } };
    const forma = clienteFalso((p) => (p.ruta === "/eventtypes" ? [{ id: 1 }] : { algo: "raro" }));
    const r = await tanda({ cliente: forma.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS, otra] });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "ERROR", dudas: 1, errores: 1 });
    expect(r.avance.entidades.tipos_cita).toMatchObject({ estado: "LISTA", cantidad: 1 });

    const no = clienteFalso((p) => {
      if (p.ruta === "/contacts/paginate") throw new AlboomApiError("Alboom respondió 404 en /contacts/paginate", 404);
      return [{ id: 1 }];
    });
    const r2 = await tanda({ cliente: no.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS, otra] });
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "ERROR", ultimoError: "Alboom respondió 404 en /contacts/paginate" });
    expect(r2.avance.entidades.tipos_cita!.estado).toBe("LISTA");
  });

  it("hijos por padre: paginan por desplazamiento, filtran y retoman en el padre y el desplazamiento guardados", async () => {
    const padre: Entidad = { clave: "oportunidades", nombre: "Op", fuente: { tipo: "paginada", ruta: "/leads/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const notas: Entidad = {
      clave: "oportunidades_notas",
      nombre: "Notas",
      fuente: {
        tipo: "porPadre",
        padre: "oportunidades",
        paginaDe: 2,
        filtro: (p) => (p as { abierta: boolean }).abierta,
        pedido: (id, offset) => ({ method: "POST", ruta: "/notes/paginate", body: { type: "leads", id, offset, count: 2 } }),
        filas: (j) => (j as { rows: unknown[] }).rows,
      },
    };
    const leads = [
      { id: "1", abierta: true },
      { id: "2", abierta: false },
      { id: "3", abierta: true },
    ];
    const notasDe: Record<string, unknown[]> = { "1": [{ id: 10 }, { id: 11 }, { id: 12 }], "3": [{ id: 30 }] };
    const r0 = reloj();
    const { cliente, pedidos } = clienteFalso((p) => {
      r0.tick();
      if (p.ruta === "/leads/paginate") return paginar(leads, p);
      const b = p.body as { id: string; offset: number };
      return { rows: (notasDe[b.id] ?? []).slice(b.offset, b.offset + 2) };
    });
    const m = almacenEnMemoria();
    // 2 pedidos: leads + primera página de notas del lead 1.
    const a = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas], ahora: r0.ahora, limite: 1500 });
    expect(a.resultado).toBe("PAUSADA");
    expect(a.avance.entidades.oportunidades_notas).toMatchObject({ offset: 2 });
    const b = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas], avance: leerAvance(JSON.parse(JSON.stringify(a.avance))) });
    expect(b.resultado).toBe("COMPLETA");
    expect(m.de("oportunidades_notas").map((f) => f.alboomId).sort()).toEqual(["1/10", "1/11", "1/12", "3/30"]);
    // El lead 2 no cumple el filtro: nunca se pidió.
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "2")).toHaveLength(0);
    expect(pedidos.filter((p) => p.ruta === "/notes/paginate").map((p) => [(p.body as { id: string }).id, (p.body as { offset: number }).offset])).toEqual([
      ["1", 0],
      ["1", 2],
      ["3", 0],
    ]);
  });

  it("hijos con `count`: siguen aunque la página venga corta, y frenan si se repite", async () => {
    const padre: Entidad = { clave: "oportunidades", nombre: "Op", fuente: { tipo: "paginada", ruta: "/leads/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const notas: Entidad = {
      clave: "oportunidades_notas",
      nombre: "Notas",
      fuente: {
        tipo: "porPadre",
        padre: "oportunidades",
        paginaDe: 50,
        pedido: (id, offset) => ({ method: "POST", ruta: "/notes/paginate", body: { type: "leads", id, offset, count: 50 } }),
        filas: (j) => (j as { rows: unknown[] }).rows,
      },
    };
    const notasDe = Array.from({ length: 45 }, (_, i) => ({ id: 100 + i }));
    const { cliente, pedidos } = clienteFalso((p) => {
      if (p.ruta === "/leads/paginate") return paginar([{ id: "1" }, { id: "2" }], p);
      const b = p.body as { id: string; offset: number };
      // Lead 1: de a 20 con total 45. Lead 2: repite siempre la misma página con un total enorme.
      if (b.id === "1") return { rows: notasDe.slice(b.offset, b.offset + 20), count: 45 };
      return { rows: [{ id: 900 }], count: 1000 };
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas] });
    expect(r.resultado).toBe("COMPLETA");
    expect(m.de("oportunidades_notas").filter((f) => f.alboomId.startsWith("1/"))).toHaveLength(45);
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "1").map((p) => (p.body as { offset: number }).offset)).toEqual([0, 20, 40]);
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "2")).toHaveLength(2);
    expect(r.avance.entidades.oportunidades_notas).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("un 5xx en un hijo: una pausa, y si vuelve a fallar se cuenta como error y se sigue; un 429 nunca se saltea", async () => {
    const padre: Entidad = { clave: "pedidos", nombre: "P", fuente: { tipo: "paginada", ruta: "/orders/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const det: Entidad = { clave: "pedidos_detalle", nombre: "D", fuente: { tipo: "porPadre", padre: "pedidos", mismoId: true, pedido: (id) => ({ method: "GET", ruta: `/orders/${id}` }), filas: (j) => [j] } };
    const status = { valor: 500 };
    const { cliente } = clienteFalso((p) => {
      if (p.ruta === "/orders/paginate") return paginar([{ id: "1" }, { id: "2" }], p);
      if (p.ruta === "/orders/1") throw new AlboomApiError("Alboom respondió 5xx", status.valor, true);
      return { id: "2", total: 10 };
    });
    const m = almacenEnMemoria();
    let r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, det] });
    expect(r.resultado).toBe("REINTENTAR");
    // Lo que hace `correr` ante REINTENTAR: suma un reintento y espera.
    r.avance.reintentos = 1;
    status.valor = 429;
    expect((await tanda({ cliente, almacen: m.almacen, entidades: [padre, det], avance: r.avance })).resultado).toBe("REINTENTAR");
    status.valor = 503;
    r.avance.reintentos = 1;
    r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, det], avance: r.avance });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.pedidos_detalle).toMatchObject({ estado: "LISTA", errores: 1, cantidad: 1, exitos: 1, fallasSeguidas: 0 });
    expect(r.avance.reintentos).toBe(0);
    expect(m.de("pedidos_detalle").map((f) => f.alboomId)).toEqual(["2"]);
  });

  /** Padre con `n` registros (ids 101…), su detalle por id y una entidad posterior (cobros). */
  function escenarioDetalle(n: number, responderDetalle: (id: number) => unknown) {
    const padre: Entidad = { clave: "presupuestos", nombre: "P", fuente: { tipo: "paginada", ruta: "/quotes/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const det: Entidad = {
      clave: "presupuestos_detalle",
      nombre: "D",
      fuente: { tipo: "porPadre", padre: "presupuestos", mismoId: true, pedido: (id) => ({ method: "GET", ruta: `/quotes/${id}` }), filas: (j) => [j] },
    };
    const despues: Entidad = { clave: "cobros", nombre: "C", fuente: { tipo: "paginada", ruta: "/account_trans/paginate_apr", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const { cliente, pedidos } = clienteFalso((p) => {
      if (p.ruta === "/quotes/paginate") return paginar(Array.from({ length: n }, (_, i) => ({ id: String(101 + i) })), p);
      if (p.ruta === "/account_trans/paginate_apr") return paginar([{ id: "9001" }, { id: "9002" }], p);
      const id = Number(/^\/quotes\/(\d+)$/.exec(p.ruta)![1]);
      return responderDetalle(id);
    });
    return { entidades: [padre, det, despues], cliente, pedidos, m: almacenEnMemoria() };
  }
  const roto = () => {
    throw new AlboomApiError("Alboom respondió 500 en /quotes/x", 500, true);
  };

  it("un detalle que falla en todos los registros queda en ERROR y la extracción sigue con lo que viene después", async () => {
    const s = escenarioDetalle(30, roto);
    let r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades });
    expect(r.resultado).toBe("REINTENTAR");
    r.avance.reintentos = 1;
    r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades, avance: r.avance });
    expect(r.resultado).toBe("COMPLETA");
    const d = r.avance.entidades.presupuestos_detalle!;
    expect(d.estado).toBe("ERROR");
    expect(d.errores).toBe(FALLAS_SIN_EXITO);
    expect(d.ultimoError).toMatch(/sin ningún éxito/);
    // Una pausa y después FALLAS_SIN_EXITO pedidos; no recorre los 30.
    expect(s.pedidos.filter((p) => p.ruta.startsWith("/quotes/") && p.ruta !== "/quotes/paginate")).toHaveLength(FALLAS_SIN_EXITO + 1);
    expect(r.avance.entidades.cobros).toMatchObject({ estado: "LISTA", cantidad: 2 });
  });

  it("un 404 en todos los registros también deja la entidad en ERROR, sin pausas", async () => {
    const s = escenarioDetalle(30, () => {
      throw new AlboomApiError("Alboom respondió 404 en /quotes/x", 404);
    });
    const r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "ERROR", errores: FALLAS_SIN_EXITO });
    expect(r.avance.entidades.cobros!.estado).toBe("LISTA");
  });

  it("con éxitos previos, los registros que fallan se saltean y cada racha larga vuelve a pausar", async () => {
    // 101 y 102 andan; del 103 en adelante, 500.
    const s = escenarioDetalle(30, (id) => (id <= 102 ? { id: String(id), items: [] } : roto()));
    let r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades });
    expect(r.resultado).toBe("REINTENTAR");
    r.avance.reintentos = 1;
    r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades, avance: r.avance });
    // Se saltean FALLAS_SEGUIDAS_PAUSA y vuelve a pausar: nunca queda en ERROR porque hubo éxitos.
    expect(r.resultado).toBe("REINTENTAR");
    expect(r.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "EN_CURSO", errores: FALLAS_SEGUIDAS_PAUSA, exitos: 2 });
    for (let i = 0; i < 5 && r.resultado === "REINTENTAR"; i++) {
      r.avance.reintentos = 1;
      r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades, avance: r.avance });
    }
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "LISTA", errores: 28, cantidad: 2 });
    expect(r.avance.entidades.cobros!.estado).toBe("LISTA");
  });

  it("si cambió la forma de pedir (versión), una extracción trabada rehace esa entidad desde cero y sigue", async () => {
    const s = escenarioDetalle(3, (id) => ({ id: String(id), items: [{ product_id: 1 }] }));
    const det = { ...s.entidades[1]!, version: 2 };
    const entidades = [s.entidades[0]!, det, s.entidades[2]!];
    // Avance como el de DNX: el listado LISTA, el detalle EN_CURSO con el cursor adelante y sólo errores (versión 1).
    const avance = avanceInicial();
    const previo = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: [s.entidades[0]!], avance });
    previo.avance.entidades.presupuestos_detalle = {
      ...previo.avance.entidades.presupuestos_detalle!,
      estado: "EN_CURSO",
      padre: "102",
      errores: 174,
      ultimoError: "Alboom respondió 500 en /quotes?id=102",
    };
    delete previo.avance.entidades.presupuestos_detalle!.version;
    const antes = s.pedidos.length;
    const r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades, avance: leerAvance(JSON.parse(JSON.stringify(previo.avance))) });
    expect(r.resultado).toBe("COMPLETA");
    // No vuelve a pedir el listado (estaba LISTA) y pide los 3 detalles, también los que habían quedado atrás del cursor.
    expect(s.pedidos.slice(antes).map((p) => p.ruta)).toEqual(["/quotes/101", "/quotes/102", "/quotes/103", "/account_trans/paginate_apr"]);
    expect(r.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "LISTA", errores: 0, cantidad: 3, version: 2 });
    expect(r.avance.entidades.presupuestos_detalle!.ultimoError).toBeUndefined();

    // Ya en la versión nueva y LISTA: no se rehace.
    const n = s.pedidos.length;
    const r2 = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades, avance: r.avance });
    expect(r2.resultado).toBe("COMPLETA");
    expect(s.pedidos.length).toBe(n);
  });

  it("el avance guarda y relee éxitos, racha de fallas y versión", () => {
    const a = avanceInicial();
    expect(a.entidades.presupuestos_detalle!.version).toBe(2);
    a.entidades.presupuestos_detalle = { ...a.entidades.presupuestos_detalle!, exitos: 5, fallasSeguidas: 2 };
    const b = leerAvance(JSON.parse(JSON.stringify(a)));
    expect(b.entidades.presupuestos_detalle).toMatchObject({ exitos: 5, fallasSeguidas: 2, version: 2 });
    // Un avance viejo sin versión queda sin versión (= 1), para que el extractor lo rehaga.
    const viejo = JSON.parse(JSON.stringify(a));
    delete viejo.entidades.presupuestos_detalle.version;
    expect(leerAvance(viejo).entidades.presupuestos_detalle!.version).toBeUndefined();
  });

  it("por desplazamiento: frena con una página vacía o si Alboom repite la misma página", async () => {
    const ent: Entidad = { clave: "tareas", nombre: "Tareas", fuente: { tipo: "porDesplazamiento", ruta: (o) => `/tasks?offset=${o}&filteruser=all` } };
    const tareas = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const ok = clienteFalso((p) => {
      const offset = Number(/offset=(\d+)/.exec(p.ruta)![1]);
      return tareas.slice(offset, offset + 10);
    });
    const m = almacenEnMemoria();
    expect((await tanda({ cliente: ok.cliente, almacen: m.almacen, entidades: [ent] })).resultado).toBe("COMPLETA");
    expect(m.de("tareas")).toHaveLength(25);
    expect(ok.pedidos.map((p) => p.ruta)).toEqual(["/tasks?offset=0&filteruser=all", "/tasks?offset=10&filteruser=all", "/tasks?offset=20&filteruser=all", "/tasks?offset=25&filteruser=all"]);

    const terca = clienteFalso(() => tareas.slice(0, 10));
    const r = await tanda({ cliente: terca.cliente, almacen: almacenEnMemoria().almacen, entidades: [ent] });
    expect(r.resultado).toBe("COMPLETA");
    expect(terca.pedidos).toHaveLength(2);
    expect(r.avance.entidades.tareas).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("una entidad sin endpoint queda NO_DISPONIBLE sin pedir nada", async () => {
    const ent: Entidad = { clave: "facturas", nombre: "Facturas", fuente: { tipo: "noDisponible", motivo: "Alboom no documenta un listado de lectura." } };
    const { cliente, pedidos } = clienteFalso(() => []);
    const r = await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ent] });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.facturas).toMatchObject({ estado: "NO_DISPONIBLE", ultimoError: "Alboom no documenta un listado de lectura." });
    expect(pedidos).toHaveLength(0);
  });
});

/** Un Alboom falso que responde a todos los endpoints del catálogo real con la forma documentada. */
function alboomCompleto() {
  const leads = [{ id: "101", name: "Boda" }, { id: "102", name: "XV" }];
  const pedidos = [{ id: "201" }];
  const productos = [{ id: "1", pack: "1" }, { id: "2", pack: "0" }];
  return (p: PedidoLectura): unknown => {
    const r = p.ruta;
    const pag = (filas: unknown[]) => paginar(filas, p);
    if (r === "/settings") return { lead_origin: "Instagram\nRecomendado\n", MailTemplates: { followup: { subject: "Hola", body: "..." } }, company: "Estudio" };
    if (r.startsWith("/settings/custom_")) return [{ id: 1, subject: "Plantilla" }];
    if (r.startsWith("/stages/list?type=order_stage")) return { stage_list: [{ id: "9", name: "Pedidos Simple" }], stages: { "9": [{ id: "91", stage: "1" }] } };
    if (r.startsWith("/stages/list")) return { stage_list: [{ id: "5", name: "Embudo" }], stages: { "5": [{ id: "51", stage: "1", name: "Recepción" }, { id: "52", stage: "2", name: "Contrato" }] } };
    if (r.startsWith("/categories")) return [{ id: 1, name: "Una" }];
    if (r.startsWith("/tags")) return [{ tag: "vip" }];
    if (r === "/eventtypes") return [{ id: 3, name: "Sesión" }];
    if (r.startsWith("/accounts")) return [{ id: r.slice(-1) === "R" ? "3.1" : "4.1", name: "Cuenta" }];
    if (r === "/products/all") return productos;
    if (r.startsWith("/products/pack/")) return [{ product_id: "2", qty: 1 }];
    if (r.startsWith("/products/costs/")) return [{ id: `c${r.split("/").pop()}`, cost: "10" }];
    if (r === "/agreement_templates") return [{ id: 1, name: "CONTRATO EVENTOS 2024" }];
    if (r === "/leads/paginate") return pag(leads);
    if (r.startsWith("/leads/progress/")) return [{ created: "2026-01-01", stage_id: "1" }];
    if (r === "/notes/paginate" || r === "/activities/paginate") return { rows: [{ id: `${r.length}${(p.body as { id: string }).id}`, text: "x" }] };
    if (r.startsWith("/mails/leads/")) return { rows: [] };
    if (r === "/quotes/paginate") return pag([{ id: "301" }]);
    if (/^\/quotes\/\d+$/.test(r)) return { id: "301", quote_items: [] };
    if (r === "/orders/paginate") return pag(pedidos);
    if (/^\/orders\/\d+$/.test(r)) return { id: "201", order_payments: [{ id: "7001", value: "100" }, { id: "7002", value: "200" }] };
    if (r.startsWith("/orders/items")) return [{ id: "8001", name: "Cobertura" }];
    if (r.startsWith("/costs/orders/")) return [];
    if (r === "/agreements/paginate") return pag([{ id: "401" }]);
    if (r.startsWith("/agreements/")) return { id: "401", text: "<p>contrato</p>" };
    if (r === "/projects/paginate") return pag([{ id: "501" }]);
    if (r.startsWith("/projects/progress/")) return [{ created: "2026-01-02", stage_id: "2" }];
    if (r === "/participants/paginate") return { rows: [{ id: "601", contact_id: "1" }] };
    if (r.startsWith("/tasks?offset=0")) return [{ id: "701" }];
    if (r.startsWith("/tasks?")) return [];
    if (r.endsWith("/paginate") || r.endsWith("/paginate_apr")) return pag([{ id: `${r.length}` }]);
    throw new AlboomApiError(`404 ${r}`, 404);
  };
}

describe("el catálogo real contra un Alboom falso", () => {
  it("extrae todas las entidades en orden, sin errores ni pedidos fuera de la lista blanca", async () => {
    const { cliente, pedidos } = clienteFalso(alboomCompleto());
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen });
    expect(r.resultado).toBe("COMPLETA");
    const conError = Object.entries(r.avance.entidades).filter(([, e]) => e.estado !== "LISTA");
    expect(conError).toEqual([]);
    expect(Object.keys(r.avance.entidades)).toEqual(ENTIDADES.map((e) => e.clave));
    expect(m.de("origenes").map((f) => f.alboomId).sort()).toEqual(["settings/Instagram", "settings/Recomendado"]);
    expect(m.de("plantillas_sistema").map((f) => f.alboomId)).toEqual(["settings/followup"]);
    expect(m.de("etapas_embudo").map((f) => f.alboomId).sort()).toEqual(["51", "52"]);
    expect(m.de("categorias").map((f) => f.alboomId)).toContain("contact/1");
    expect(m.de("combos").map((f) => f.alboomId)).toHaveLength(1);
    expect(m.de("combos")[0]!.alboomId.startsWith("1/")).toBe(true);
    expect(m.de("pedidos_detalle").map((f) => f.alboomId)).toEqual(["201"]);
    expect(m.de("pedidos_plan_pagos").map((f) => f.alboomId).sort()).toEqual(["201/7001", "201/7002"]);
    expect(m.de("oportunidades_historial")).toHaveLength(2);
    expect(r.avance.entidades.oportunidades_historial!.dudas).toBe(0);
    expect(m.de("configuracion").map((f) => f.alboomId)).toEqual(["settings"]);
    expect(pedidos.length).toBe(r.avance.pedidos);

    // Volver a extraer: nada nuevo ni cambiado.
    const r2 = await tanda({ cliente, almacen: m.almacen });
    const sumas = Object.values(r2.avance.entidades).reduce((s, e) => ({ n: s.n + e.nuevos, c: s.c + e.cambiados }), { n: 0, c: 0 });
    expect(sumas).toEqual({ n: 0, c: 0 });
  });
});

describe("pedidos de Alboom: el listado como el panel", () => {
  it("pide `/orders/paginate` exactamente como el panel: de a 25 y por id descendente", async () => {
    const ent = entidadPorClave("pedidos")!;
    expect(ent.tamanoPagina).toBe(25);
    const { cliente, pedidos } = clienteFalso((p) => paginar([{ id: "3" }, { id: "2" }, { id: "1" }], p));
    const r = await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ent] });
    expect(r.resultado).toBe("COMPLETA");
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toEqual({
      method: "POST",
      ruta: "/orders/paginate",
      body: {
        type: "all",
        class: null,
        user: "all",
        pageNumber: 1,
        pageSize: 25,
        sortBy: "id",
        sortDir: "DESC",
        searchTerm: "",
        period: "all",
        period_job: "all",
        start_date: "all",
        end_date: null,
      },
    });
    expect(Object.keys(pedidos[0]!.body as object)).toHaveLength(12);
  });

  it("los pedidos y sus hijos van antes que los hijos de las oportunidades, y cada hijo después de su padre", () => {
    const orden = ENTIDADES.map((e) => e.clave);
    const pos = (c: string) => orden.indexOf(c);
    for (const c of ["presupuestos", "pedidos", "pedidos_detalle", "pedidos_items", "pedidos_costos", "contratos", "contratos_detalle", "proyectos", "cuentas_cobrar"]) {
      expect(pos(c)).toBeGreaterThan(pos("contactos"));
      for (const hijo of ["oportunidades_historial", "oportunidades_notas", "oportunidades_actividades", "oportunidades_correos"]) expect(pos(c)).toBeLessThan(pos(hijo));
    }
    for (const e of ENTIDADES) {
      if (e.fuente.tipo === "porPadre") expect(pos(e.fuente.padre)).toBeLessThan(pos(e.clave));
      if (e.fuente.tipo === "derivada") expect(pos(e.fuente.de)).toBeLessThan(pos(e.clave));
    }
  });

  it("escalera de tamaños: 100 → 25 → 5 → 1", () => {
    expect([tamanoMenor(100), tamanoMenor(25), tamanoMenor(5), tamanoMenor(1), tamanoMenor(30), tamanoMenor(7)]).toEqual([25, 5, 1, null, 5, 1]);
  });
});

describe("listados paginados: una fila rota no frena la extracción", () => {
  /** 60 pedidos (ids 1…60); pedir cualquier página que incluya el desplazamiento 37 (id 38) da 500. */
  function alboomConFilaRota() {
    const todos = Array.from({ length: 60 }, (_, i) => ({ id: String(i + 1) }));
    return clienteFalso((p) => {
      const b = p.body as { pageNumber: number; pageSize: number };
      const desde = (b.pageNumber - 1) * b.pageSize;
      if (desde <= 37 && 37 < desde + b.pageSize) throw new AlboomApiError("Alboom respondió 500 en /orders/paginate", 500, true);
      return { rows: todos.slice(desde, desde + b.pageSize), count: todos.length };
    });
  }
  const ENT: Entidad = { clave: "pedidos", nombre: "Pedidos", tamanoPagina: 25, fuente: { tipo: "paginada", ruta: "/orders/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };

  it("tras la pausa de siempre, repite el tramo de a 5 y de a 1, saltea sólo la fila rota y no repite ni pierde ninguna", async () => {
    const { cliente, pedidos } = alboomConFilaRota();
    const m = almacenEnMemoria();
    let r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT] });
    // Primera falla: la pausa de siempre, sin mover el cursor.
    expect(r.resultado).toBe("REINTENTAR");
    expect(r.avance.entidades.pedidos).toMatchObject({ desde: 25, leidas: 25 });
    // Lo que hace `correr` ante REINTENTAR; la próxima tanda lee el avance desde la base (JSON).
    r.avance.reintentos = 1;
    r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT], avance: leerAvance(JSON.parse(JSON.stringify(r.avance))) });
    expect(r.resultado).toBe("COMPLETA");
    const tamanos = pedidos.map((p) => {
      const b = p.body as { pageNumber: number; pageSize: number };
      return `${(b.pageNumber - 1) * b.pageSize}+${b.pageSize}`;
    });
    expect(tamanos).toEqual([
      "0+25",
      "25+25", // falla → pausa
      "25+25", // vuelve a fallar → de a 5
      "25+5",
      "30+5",
      "35+5", // falla → de a 1
      "35+1",
      "36+1",
      "37+1", // falla sola → se saltea
      "38+1",
      "39+1",
      "40+5",
      "45+5",
      "50+25", // vuelve al tamaño normal
    ]);
    const ids = m.de("pedidos").map((f) => Number(f.alboomId)).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 60 }, (_, i) => i + 1).filter((id) => id !== 38));
    expect(r.avance.entidades.pedidos).toMatchObject({ estado: "LISTA", cantidad: 59, saltados: 1, filasSalteadas: [37], errores: 1, leidas: 59 });
    expect(r.avance.entidades.pedidos!.dudas).toBeGreaterThanOrEqual(1);
    expect(r.avance.entidades.pedidos!.ultimoError).toMatch(/fila 38 del listado/);
    expect(r.avance.entidades.pedidos!.tramos).toBeUndefined();
    expect(r.avance.reintentos).toBe(0);
  });

  it("cortada a mitad del tramo chico, la tanda siguiente retoma en el mismo tamaño y desplazamiento", async () => {
    const { cliente, pedidos } = alboomConFilaRota();
    const m = almacenEnMemoria();
    let r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT] });
    r.avance.reintentos = 1;
    // Presupuesto para 5 pedidos: 25+25 (falla), 25+5, 30+5, 35+5 (falla), 35+1.
    let t = 0;
    const ahora = () => t;
    const cl: ClienteAlboom = { leer: async (p) => ((t += 1000), cliente.leer(p)), pedidosHechos: () => pedidos.length };
    r = await tanda({ cliente: cl, almacen: m.almacen, entidades: [ENT], avance: r.avance, ahora, limite: 4500 });
    expect(r.resultado).toBe("PAUSADA");
    const guardado = leerAvance(JSON.parse(JSON.stringify(r.avance)));
    expect(guardado.entidades.pedidos).toMatchObject({ desde: 36, tramos: [{ tamano: 5, hasta: 50 }, { tamano: 1, hasta: 40 }] });
    r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT], avance: guardado });
    expect(r.resultado).toBe("COMPLETA");
    expect(m.de("pedidos")).toHaveLength(59);
    expect(r.avance.entidades.pedidos).toMatchObject({ estado: "LISTA", saltados: 1 });
  });

  it("un 429 nunca achica la página: sólo pausa", async () => {
    let n = 0;
    const { cliente, pedidos } = clienteFalso((p) => {
      if (++n <= 3) throw new AlboomApiError("Alboom respondió 429", 429, true);
      return paginar([{ id: "1" }], p);
    });
    const avance = avanceInicial();
    for (let i = 0; i < 3; i++) {
      avance.reintentos = i;
      expect((await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT], avance })).resultado).toBe("REINTENTAR");
    }
    expect(pedidos.every((p) => (p.body as { pageSize: number }).pageSize === 25)).toBe(true);
    expect(avance.entidades.pedidos!.tramos).toBeUndefined();
  });
});

describe("volver a extraer: hijos sólo de los padres que cambiaron", () => {
  /** Presupuestos 101…10n con su detalle; `cambiar` modifica el listado. */
  function escenario(n: number) {
    let lista = Array.from({ length: n }, (_, i) => ({ id: String(101 + i), v: 1 }));
    const fallan = new Set<string>();
    const padre: Entidad = { clave: "presupuestos", nombre: "P", fuente: { tipo: "paginada", ruta: "/quotes/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const det: Entidad = {
      clave: "presupuestos_detalle",
      nombre: "D",
      // La misma versión que el catálogo: el avance inicial la toma de ahí.
      version: entidadPorClave("presupuestos_detalle")!.version,
      fuente: { tipo: "porPadre", padre: "presupuestos", mismoId: true, pedido: (id) => ({ method: "GET", ruta: `/quotes/${id}` }), filas: (j) => [j] },
    };
    const { cliente, pedidos } = clienteFalso((p) => {
      if (p.ruta === "/quotes/paginate") return paginar(lista, p);
      const id = /^\/quotes\/(\d+)$/.exec(p.ruta)![1]!;
      if (fallan.has(id)) throw new AlboomApiError("Alboom respondió 404", 404);
      return { id, detalle: true };
    });
    const m = almacenEnMemoria();
    const detalles = (desde: number) => pedidos.slice(desde).filter((p) => p.ruta !== "/quotes/paginate").map((p) => p.ruta.split("/").pop());
    return {
      entidades: [padre, det],
      cliente,
      pedidos,
      m,
      fallan,
      detalles,
      cambiar: (ids: string[]) => (lista = lista.map((x) => (ids.includes(x.id) ? { ...x, v: x.v + 1 } : x))),
      agregar: (id: string) => lista.push({ id, v: 1 }),
      correr: (modo: "TODO" | "INCREMENTAL", anteriores: Avance[] = []) =>
        tanda({ cliente, almacen: m.almacen, entidades: [padre, det], modo, anteriores: anteriores.map((a) => leerAvance(JSON.parse(JSON.stringify(a)))) }),
    };
  }

  it("pide los hijos sólo de lo nuevo o cambiado; \"Extraer todo\" sigue pidiendo todos", async () => {
    const s = escenario(5);
    const todo = await s.correr("TODO");
    expect(s.detalles(0)).toEqual(["101", "102", "103", "104", "105"]);
    expect(todo.avance.entidades.presupuestos!.tocados).toHaveLength(5);

    s.cambiar(["102"]);
    s.agregar("106");
    let n = s.pedidos.length;
    const inc = await s.correr("INCREMENTAL", [todo.avance]);
    expect(inc.resultado).toBe("COMPLETA");
    expect(s.detalles(n)).toEqual(["102", "106"]);
    expect(inc.avance.entidades.presupuestos!.tocados!.sort()).toEqual(["102", "106"]);
    expect(inc.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "LISTA", salteados: 4 });

    // Nada cambió: no pide ningún detalle.
    n = s.pedidos.length;
    await s.correr("INCREMENTAL", [inc.avance, todo.avance]);
    expect(s.detalles(n)).toEqual([]);

    // "Extraer todo" pide todos aunque no haya cambios.
    n = s.pedidos.length;
    await s.correr("TODO", [inc.avance, todo.avance]);
    expect(s.detalles(n)).toHaveLength(6);
  });

  it("lo que cambió en una extracción que se cortó antes de los hijos, y lo que falló en la última completa, se vuelve a pedir", async () => {
    const s = escenario(5);
    s.fallan.add("104");
    const todo = await s.correr("TODO");
    expect(todo.avance.entidades.presupuestos_detalle).toMatchObject({ estado: "LISTA", fallidos: ["104"] });
    s.fallan.clear();

    // Una extracción que vio el cambio de 103 pero se cortó antes de pedir los hijos (como las que murieron en pedidos).
    s.cambiar(["103"]);
    const cortada = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: [s.entidades[0]!], modo: "INCREMENTAL" });
    expect(cortada.avance.entidades.presupuestos!.tocados).toEqual(["103"]);

    const n = s.pedidos.length;
    await s.correr("INCREMENTAL", [cortada.avance, todo.avance]);
    expect(s.detalles(n).sort()).toEqual(["103", "104"]);
  });

  it("sin ancla, con un avance viejo sin `tocados` o con una ancla vieja con errores, pide todos", async () => {
    const s = escenario(3);
    const todo = await s.correr("TODO");
    // Sin extracciones anteriores: todos.
    let n = s.pedidos.length;
    await s.correr("INCREMENTAL", []);
    expect(s.detalles(n)).toHaveLength(3);

    // Una anterior del código viejo (sin `tocados`) entre el ancla y ésta: no se sabe qué cambió → todos.
    const vieja = JSON.parse(JSON.stringify(todo.avance)) as Avance;
    vieja.entidades.presupuestos_detalle = { ...vieja.entidades.presupuestos_detalle!, estado: "EN_CURSO" };
    delete vieja.entidades.presupuestos!.tocados;
    n = s.pedidos.length;
    await s.correr("INCREMENTAL", [vieja, todo.avance]);
    expect(s.detalles(n)).toHaveLength(3);

    // Un ancla del código viejo (sin `fallidos`) que tuvo errores: no se sabe cuáles → todos.
    const anclaVieja = JSON.parse(JSON.stringify(todo.avance)) as Avance;
    anclaVieja.entidades.presupuestos_detalle = { ...anclaVieja.entidades.presupuestos_detalle!, errores: 2 };
    delete anclaVieja.entidades.presupuestos_detalle!.fallidos;
    n = s.pedidos.length;
    await s.correr("INCREMENTAL", [anclaVieja]);
    expect(s.detalles(n)).toHaveLength(3);
    // La misma ancla vieja sin errores sí sirve.
    anclaVieja.entidades.presupuestos_detalle!.errores = 0;
    n = s.pedidos.length;
    await s.correr("INCREMENTAL", [anclaVieja]);
    expect(s.detalles(n)).toHaveLength(0);
  });

  it("un padre que venía del código viejo a mitad de camino (sin `tocados`) hace pedir todos los hijos", async () => {
    const s = escenario(3);
    const todo = await s.correr("TODO");
    // Extracción en curso del código viejo: el listado EN_CURSO con filas ya leídas y sin `tocados`.
    const enCurso = avanceInicial();
    enCurso.entidades.presupuestos = { ...enCurso.entidades.presupuestos!, estado: "EN_CURSO", paginas: 1, cantidad: 3, pagina: 2 };
    const n = s.pedidos.length;
    const r = await tanda({ cliente: s.cliente, almacen: s.m.almacen, entidades: s.entidades, modo: "INCREMENTAL", anteriores: [todo.avance], avance: leerAvance(JSON.parse(JSON.stringify(enCurso))) });
    expect(r.avance.entidades.presupuestos!.tocadosDesbordado).toBe(true);
    expect(s.detalles(n)).toHaveLength(3);
  });
});

describe("compatibilidad con el avance de la extracción que ya está corriendo", () => {
  it("un avance del código viejo se lee, retoma los listados por su página y hace pedidos antes que las notas", async () => {
    // Como el de DNX el 21/10: listados LISTA, notas EN_CURSO con cursor, pedidos PENDIENTE sin versión, y un
    // listado a mitad (página 3 de a 100) sin los campos nuevos.
    const viejo: Record<string, unknown> = {
      version: 1,
      pedidos: 9000,
      reintentos: 0,
      reintentarDesde: null,
      entidades: {
        contactos: { estado: "LISTA", paginas: 38, cantidad: 3776, nuevos: 0, cambiados: 0, iguales: 3776, errores: 0, dudas: 0, pagina: 39, leidas: 3776 },
        oportunidades: { estado: "LISTA", paginas: 31, cantidad: 3078, nuevos: 0, cambiados: 3, iguales: 3075, errores: 0, dudas: 0, pagina: 32, leidas: 3078 },
        oportunidades_notas: { estado: "EN_CURSO", paginas: 1800, cantidad: 433, nuevos: 0, cambiados: 0, iguales: 433, errores: 0, dudas: 0, padre: "102", exitos: 1800 },
        pedidos: { estado: "PENDIENTE", paginas: 0, cantidad: 0, nuevos: 0, cambiados: 0, iguales: 0, errores: 0, dudas: 0 },
        cobros: { estado: "EN_CURSO", paginas: 2, cantidad: 200, nuevos: 0, cambiados: 0, iguales: 200, errores: 0, dudas: 0, pagina: 3, leidas: 200, huellaPagina: "x" },
      },
    };
    const avance = leerAvance(viejo);
    expect(avance.entidades.oportunidades_notas).toMatchObject({ estado: "EN_CURSO", padre: "102" });
    expect(avance.entidades.pedidos!.version).toBeUndefined();
    expect(avance.entidades.cobros!.desde).toBeUndefined();

    const cobrosFilas = Array.from({ length: 250 }, (_, i) => ({ id: String(9000 + i) }));
    const { cliente, pedidos } = clienteFalso((p) => {
      if (p.ruta === "/orders/paginate") return paginar([{ id: "201" }], p);
      if (p.ruta === "/account_trans/paginate_apr") return paginar(cobrosFilas, p);
      if (p.ruta === "/notes/paginate") return { rows: [] };
      return { id: "201" };
    });
    const m = almacenEnMemoria();
    await m.almacen.guardarFilas(WS, "oportunidades", ["101", "102", "103"].map((id) => ({ alboomId: id, payload: { id }, hash: id })));
    const entidades = ["oportunidades", "pedidos", "pedidos_detalle", "cobros", "oportunidades_notas"].map((c) => entidadPorClave(c)!);
    const r = await tanda({ cliente, almacen: m.almacen, entidades, avance, modo: "INCREMENTAL", anteriores: [] });
    expect(r.resultado).toBe("COMPLETA");
    const rutas = pedidos.map((p) => p.ruta);
    // Pedidos primero (el orden nuevo), los cobros retoman en la página 3 y las notas siguen después del 102.
    expect(rutas).toEqual(["/orders/paginate", "/orders/201", "/account_trans/paginate_apr", "/notes/paginate"]);
    expect((pedidos[2]!.body as { pageNumber: number }).pageNumber).toBe(3);
    expect((pedidos[3]!.body as { id: string }).id).toBe("103");
    expect(r.avance.entidades.pedidos).toMatchObject({ estado: "LISTA", version: 2, cantidad: 1 });
    expect(r.avance.entidades.cobros).toMatchObject({ estado: "LISTA", leidas: 250 });
    expect(r.avance.entidades.oportunidades_notas!.estado).toBe("LISTA");
  });

  it("los campos nuevos del avance se guardan y se releen; los que vienen mal se ignoran", () => {
    const a = avanceInicial();
    a.entidades.pedidos = {
      ...a.entidades.pedidos!,
      desde: 35,
      tramos: [{ tamano: 5, hasta: 50 }, { tamano: 1, hasta: 40 }],
      saltados: 1,
      filasSalteadas: [37],
      total: 60,
      tocados: ["1", "2"],
      fallidos: ["9"],
      salteados: 4,
    };
    const b = leerAvance(JSON.parse(JSON.stringify(a)));
    expect(b.entidades.pedidos).toMatchObject({ desde: 35, tramos: [{ tamano: 5, hasta: 50 }, { tamano: 1, hasta: 40 }], saltados: 1, filasSalteadas: [37], total: 60, tocados: ["1", "2"], fallidos: ["9"], salteados: 4 });
    const roto = leerAvance({ entidades: { pedidos: { estado: "EN_CURSO", tramos: "x", tocados: [1, null, "3"], fallidos: {} } } });
    expect(roto.entidades.pedidos!.tramos).toBeUndefined();
    expect(roto.entidades.pedidos!.tocados).toEqual(["3"]);
    expect(roto.entidades.pedidos!.fallidos).toBeUndefined();
  });
});
