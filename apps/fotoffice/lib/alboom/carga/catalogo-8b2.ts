import type { ParteCarga, Progreso } from "./catalogo";
import { idsDe, porAlboomId, todosLosCrudos } from "./contexto";
import { campos, clave, idAlboom, texto } from "./normalizar";
import type { RepoCarga } from "./repositorio";
import type { Crudo, Decision } from "./tipos";
import {
  TIPO_ACTIVIDAD,
  TIPO_CONSULTA,
  TIPO_MENSAJE,
  TIPO_NOTA,
  TIPO_PASO,
  traducirActividadConsulta,
  traducirConsulta,
  traducirCorreoConsulta,
  traducirNotaConsulta,
  traducirPasoConsulta,
  type CtxConsultas,
  type CtxHijosConsulta,
} from "./traductores/consultas";
import {
  TIPO_FINANZA,
  traducirCobro,
  traducirCuentaCobrar,
  traducirCuentaPagarSuelta,
  traducirMovimientoBanco,
  traducirPagoSuelto,
  type CtxCobros,
  type CtxFinanzas,
  type CtxPagar,
} from "./traductores/finanzas";
import { padreDe, porId, porPadre } from "./traductores/historia";
import {
  TIPO_CITA,
  TIPO_CONTRATO,
  TIPO_PARTICIPANTE,
  TIPO_PROYECTO,
  TIPO_TAREA,
  registrarNumero,
  traducirCita,
  traducirContrato,
  traducirParticipante,
  traducirPasoProyecto,
  traducirProyecto,
  traducirTarea,
  type CtxCitas,
  type CtxContratos,
  type CtxHijosProyecto,
  type CtxProyectos,
  type CtxTareas,
} from "./traductores/trabajos";
import {
  TIPO_CUENTA_PAGAR,
  TIPO_CUOTA,
  TIPO_PEDIDO,
  TIPO_PRESUPUESTO,
  asientosPorPedido,
  consumidosPorCostos,
  cuotasCobradasPorPedido,
  emparejarCobros,
  emparejarCostos,
  posicionesDeCuotas,
  registrarPedido,
  traducirCostoPedido,
  traducirCuota,
  traducirPedido,
  traducirPresupuesto,
  type CtxCostosPedido,
  type CtxCuotas,
  type CtxPedidos,
  type CtxPresupuestos,
} from "./traductores/ventas";

/**
 * Partes de la etapa 8B-2 (lo histórico de DNX en Alboom), en orden de dependencias, sobre el mismo motor de la
 * 8B-1. Ver `docs/superpowers/plans/2026-10-25-alboom-8b2.md`.
 */

type Repo = RepoCarga;

/** Índice "nombre normalizado → id". */
const porNombre = (xs: { id: string; name: string }[]) => new Map(xs.map((x) => [clave(x.name), x.id]));

/** Id de Alboom de un registro → contacto de FOTOFFICE (por su `customer_id`). */
function clientesDe(crudos: Crudo[], contactoDe: Map<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of crudos) {
    const id = idAlboom(campos(c.payload).customer_id);
    const cli = id ? contactoDe.get(id) : undefined;
    if (cli) m.set(c.alboomId, cli);
  }
  return m;
}

async function comunes(repo: Repo, ws: string, pr: Progreso) {
  return {
    contactoDe: await idsDe(repo, ws, pr, "contactos"),
    usuarioDe: await idsDe(repo, ws, pr, "usuarios"),
  };
}

async function mapaYExistentes(repo: Repo, ws: string, entity: string, targetType: string) {
  return { mapa: porAlboomId(await repo.leerMapa(ws, [entity]), entity), existentes: await repo.idsExistentes(ws, targetType) };
}

/** Lo que necesitan los hijos de una oportunidad (historial, notas, actividades, correos). */
async function ctxHijosConsulta(repo: Repo, ws: string, pr: Progreso, entity: string, targetType: string): Promise<CtxHijosConsulta> {
  const { contactoDe, usuarioDe } = await comunes(repo, ws, pr);
  const leadDe = await idsDe(repo, ws, pr, "oportunidades");
  const circuitoDe = await idsDe(repo, ws, pr, "embudos");
  const embudoDeLead = new Map<string, string>();
  const oportunidades = await todosLosCrudos(repo, ws, "oportunidades");
  for (const c of oportunidades) {
    const emb = idAlboom(campos(c.payload).pipeline_id);
    if (emb && circuitoDe.has(emb)) embudoDeLead.set(c.alboomId, emb);
  }
  const cat = await repo.catalogosHistoricos(ws);
  return {
    leadDe,
    clienteDeLead: clientesDe(oportunidades, contactoDe),
    embudoDeLead,
    etapaDe: await idsDe(repo, ws, pr, "posicion_embudo"),
    contactoDe,
    usuarioDe,
    categoriasNota: porNombre(cat.categoriasNota),
    ...(await mapaYExistentes(repo, ws, entity, targetType)),
  };
}

async function nombresDe(repo: Repo, ws: string, entity: string, campo = "name"): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const c of await todosLosCrudos(repo, ws, entity)) {
    const p = campos(c.payload);
    const n = texto(p[campo], 200);
    const id = idAlboom(p.id) ?? c.alboomId.split("/").pop() ?? c.alboomId;
    if (n) m.set(id, n);
  }
  return m;
}

/** Costos de los pedidos emparejados con sus pagos y cuentas a pagar de Alboom (lo mismo para las tres partes). */
async function emparejado(repo: Repo, ws: string, pr: Progreso) {
  const pedidoDe = await idsDe(repo, ws, pr, "pedidos");
  const e = emparejarCostos(
    await todosLosCrudos(repo, ws, "pedidos_costos"),
    asientosPorPedido(await todosLosCrudos(repo, ws, "pagos")),
    asientosPorPedido(await todosLosCrudos(repo, ws, "cuentas_pagar")),
    (id) => pedidoDe.has(id),
  );
  return { pedidoDe, emparejado: e };
}

async function ctxFinanzas(repo: Repo, ws: string, pr: Progreso, entity: string, targetType: string): Promise<CtxFinanzas> {
  return {
    pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
    contactoDe: await idsDe(repo, ws, pr, "contactos"),
    bancoDe: await nombresDe(repo, ws, "bancos"),
    metodoDe: await nombresDe(repo, ws, "metodos_pago"),
    ...(await mapaYExistentes(repo, ws, entity, targetType)),
  };
}

async function ctxPagar(repo: Repo, ws: string, pr: Progreso, entity: string): Promise<CtxPagar> {
  const { pedidoDe, emparejado: e } = await emparejado(repo, ws, pr);
  return {
    pedidoDe,
    contactoDe: await idsDe(repo, ws, pr, "contactos"),
    metodoDe: await nombresDe(repo, ws, "metodos_pago"),
    consumidos: consumidosPorCostos(e),
    ...(await mapaYExistentes(repo, ws, entity, TIPO_CUENTA_PAGAR)),
  };
}

function parte(p: Omit<ParteCarga, "traducir"> & { traducir: (c: Crudo, ctx: never) => Decision }): ParteCarga {
  return p as unknown as ParteCarga;
}

export const PARTES_8B2: readonly ParteCarga[] = [
  parte({
    clave: "consultas",
    nombre: "Consultas (oportunidades)",
    fuentes: [{ entity: "oportunidades" }],
    depende: ["contactos", "origenes", "categorias_consulta", "etapas", "usuarios"],
    targetType: TIPO_CONSULTA,
    exporta: true,
    async contexto(repo, ws, pr): Promise<CtxConsultas> {
      const origenPorNombre = porNombre(await repo.origenes(ws));
      for (const [nombre, id] of await idsDe(repo, ws, pr, "origenes")) origenPorNombre.set(clave(nombre), id);
      const categoriaDe = new Map<string, string>();
      for (const [k, v] of await idsDe(repo, ws, pr, "categorias")) categoriaDe.set(k, v);
      return {
        ...(await comunes(repo, ws, pr)),
        categoriaDe,
        origenPorNombre,
        circuitoDe: await idsDe(repo, ws, pr, "embudos"),
        etapaDe: await idsDe(repo, ws, pr, "posicion_embudo"),
        hoy: pr.hoy,
        ...(await mapaYExistentes(repo, ws, "oportunidades", TIPO_CONSULTA)),
      };
    },
    traducir: (c, ctx: CtxConsultas) => traducirConsulta(c, ctx),
  }),
  parte({
    clave: "consultas_historial",
    nombre: "Historial de etapas de las consultas",
    fuentes: [{ entity: "oportunidades_historial" }],
    depende: ["consultas"],
    targetType: TIPO_PASO,
    exporta: false,
    contexto: (repo, ws, pr) => ctxHijosConsulta(repo, ws, pr, "oportunidades_historial", TIPO_PASO),
    traducir: (c, ctx: CtxHijosConsulta) => traducirPasoConsulta(c, ctx),
  }),
  parte({
    clave: "consultas_notas",
    nombre: "Notas de las consultas",
    fuentes: [{ entity: "oportunidades_notas" }],
    depende: ["consultas"],
    targetType: TIPO_NOTA,
    exporta: false,
    contexto: (repo, ws, pr) => ctxHijosConsulta(repo, ws, pr, "oportunidades_notas", TIPO_NOTA),
    traducir: (c, ctx: CtxHijosConsulta) => traducirNotaConsulta(c, ctx),
  }),
  parte({
    clave: "consultas_actividades",
    nombre: "Actividad de las consultas",
    fuentes: [{ entity: "oportunidades_actividades" }],
    depende: ["consultas"],
    targetType: TIPO_ACTIVIDAD,
    exporta: false,
    contexto: (repo, ws, pr) => ctxHijosConsulta(repo, ws, pr, "oportunidades_actividades", TIPO_ACTIVIDAD),
    traducir: (c, ctx: CtxHijosConsulta) => traducirActividadConsulta(c, ctx),
  }),
  parte({
    clave: "consultas_correos",
    nombre: "Correos y WhatsApp de las consultas",
    fuentes: [{ entity: "oportunidades_correos" }],
    depende: ["consultas"],
    targetType: TIPO_MENSAJE,
    exporta: false,
    contexto: (repo, ws, pr) => ctxHijosConsulta(repo, ws, pr, "oportunidades_correos", TIPO_MENSAJE),
    traducir: (c, ctx: CtxHijosConsulta) => traducirCorreoConsulta(c, ctx),
  }),
  parte({
    clave: "presupuestos",
    nombre: "Presupuestos",
    fuentes: [{ entity: "presupuestos" }],
    depende: ["consultas", "productos"],
    targetType: TIPO_PRESUPUESTO,
    exporta: true,
    async contexto(repo, ws, pr): Promise<CtxPresupuestos> {
      const { contactoDe, usuarioDe } = await comunes(repo, ws, pr);
      const aceptados = new Set<string>();
      for (const c of await todosLosCrudos(repo, ws, "pedidos")) {
        const q = idAlboom(campos(c.payload).quote_id);
        if (q) aceptados.add(q);
      }
      return {
        leadDe: await idsDe(repo, ws, pr, "oportunidades"),
        clienteDeLead: clientesDe(await todosLosCrudos(repo, ws, "oportunidades"), contactoDe),
        contactoDe,
        usuarioDe,
        productoDe: await idsDe(repo, ws, pr, "productos"),
        detalle: porId(await todosLosCrudos(repo, ws, "presupuestos_detalle")),
        aceptados,
        hoy: pr.hoy,
        ...(await mapaYExistentes(repo, ws, "presupuestos", TIPO_PRESUPUESTO)),
      };
    },
    traducir: (c, ctx: CtxPresupuestos) => traducirPresupuesto(c, ctx),
  }),
  parte({
    clave: "pedidos",
    nombre: "Pedidos",
    fuentes: [{ entity: "pedidos" }],
    depende: ["contactos", "consultas", "presupuestos", "productos", "usuarios"],
    targetType: TIPO_PEDIDO,
    exporta: true,
    async contexto(repo, ws, pr): Promise<CtxPedidos> {
      const cat = await repo.catalogosHistoricos(ws);
      return {
        ...(await comunes(repo, ws, pr)),
        leadDe: await idsDe(repo, ws, pr, "oportunidades"),
        presupuestoDe: await idsDe(repo, ws, pr, "presupuestos"),
        productoDe: await idsDe(repo, ws, pr, "productos"),
        detalle: porId(await todosLosCrudos(repo, ws, "pedidos_detalle")),
        itemsDe: porPadre(await todosLosCrudos(repo, ws, "pedidos_items")),
        numeros: new Set(cat.numerosPedido),
        presupuestosConPedido: new Set(cat.presupuestosConPedido),
        ...(await mapaYExistentes(repo, ws, "pedidos", TIPO_PEDIDO)),
      };
    },
    traducir: (c, ctx: CtxPedidos) => traducirPedido(c, ctx),
    registrar: (ctx, _c, d, id) => registrarPedido(ctx as CtxPedidos, d, id),
  }),
  parte({
    clave: "cuotas",
    nombre: "Plan de cuotas de los pedidos",
    fuentes: [{ entity: "pedidos_plan_pagos" }],
    depende: ["pedidos"],
    targetType: TIPO_CUOTA,
    exporta: true,
    async contexto(repo, ws, pr): Promise<CtxCuotas> {
      return {
        pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
        metodoDe: await nombresDe(repo, ws, "metodos_pago"),
        posicion: posicionesDeCuotas(await todosLosCrudos(repo, ws, "pedidos_plan_pagos")),
        ...(await mapaYExistentes(repo, ws, "pedidos_plan_pagos", TIPO_CUOTA)),
      };
    },
    traducir: (c, ctx: CtxCuotas) => traducirCuota(c, ctx),
  }),
  parte({
    clave: "costos_pedido",
    nombre: "Costos de los pedidos (cuentas a pagar)",
    fuentes: [{ entity: "pedidos_costos" }],
    depende: ["pedidos"],
    targetType: TIPO_CUENTA_PAGAR,
    exporta: false,
    async contexto(repo, ws, pr): Promise<CtxCostosPedido> {
      const { pedidoDe, emparejado: e } = await emparejado(repo, ws, pr);
      return {
        pedidoDe,
        contactoDe: await idsDe(repo, ws, pr, "contactos"),
        rubroPorNombre: porNombre((await repo.catalogosHistoricos(ws)).rubrosEgreso),
        emparejado: e,
        ...(await mapaYExistentes(repo, ws, "pedidos_costos", TIPO_CUENTA_PAGAR)),
      };
    },
    traducir: (c, ctx: CtxCostosPedido) => traducirCostoPedido(c, ctx),
  }),
  parte({
    clave: "cobros",
    nombre: "Cobros recibidos (los de pedidos ya están en sus cuotas)",
    fuentes: [{ entity: "cobros" }],
    depende: ["cuotas"],
    targetType: TIPO_FINANZA,
    exporta: false,
    async contexto(repo, ws, pr): Promise<CtxCobros> {
      const f = await ctxFinanzas(repo, ws, pr, "cobros", TIPO_FINANZA);
      const cobradas = cuotasCobradasPorPedido(await todosLosCrudos(repo, ws, "pedidos_plan_pagos"));
      // Sólo cuentan las cuotas de pedidos que se cargan: un cobro de un pedido sin cargar va al libro histórico.
      for (const k of [...cobradas.keys()]) if (!f.pedidoDe.has(k)) cobradas.delete(k);
      return { ...f, emparejados: emparejarCobros(await todosLosCrudos(repo, ws, "cobros"), cobradas) };
    },
    traducir: (c, ctx: CtxCobros) => traducirCobro(c, ctx),
  }),
  parte({
    clave: "cuentas_cobrar",
    nombre: "Cuentas a cobrar",
    fuentes: [{ entity: "cuentas_cobrar" }],
    depende: ["pedidos"],
    targetType: TIPO_FINANZA,
    exporta: false,
    contexto: (repo, ws, pr) => ctxFinanzas(repo, ws, pr, "cuentas_cobrar", TIPO_FINANZA),
    traducir: (c, ctx: CtxFinanzas) => traducirCuentaCobrar(c, ctx),
  }),
  parte({
    clave: "cuentas_pagar",
    nombre: "Cuentas a pagar",
    fuentes: [{ entity: "cuentas_pagar" }],
    depende: ["costos_pedido"],
    targetType: TIPO_CUENTA_PAGAR,
    exporta: false,
    contexto: (repo, ws, pr) => ctxPagar(repo, ws, pr, "cuentas_pagar"),
    traducir: (c, ctx: CtxPagar) => traducirCuentaPagarSuelta(c, ctx),
  }),
  parte({
    clave: "pagos",
    nombre: "Pagos hechos (sin movimiento de Caja)",
    fuentes: [{ entity: "pagos" }],
    depende: ["costos_pedido"],
    targetType: TIPO_CUENTA_PAGAR,
    exporta: false,
    contexto: (repo, ws, pr) => ctxPagar(repo, ws, pr, "pagos"),
    traducir: (c, ctx: CtxPagar) => traducirPagoSuelto(c, ctx),
  }),
  parte({
    clave: "movimientos_bancos",
    nombre: "Movimientos de bancos (libro Histórico Alboom)",
    fuentes: [{ entity: "movimientos_bancos" }],
    depende: ["pedidos"],
    targetType: TIPO_FINANZA,
    exporta: false,
    contexto: (repo, ws, pr) => ctxFinanzas(repo, ws, pr, "movimientos_bancos", TIPO_FINANZA),
    traducir: (c, ctx: CtxFinanzas) => traducirMovimientoBanco(c, ctx),
  }),
  parte({
    clave: "contratos",
    nombre: "Contratos",
    fuentes: [{ entity: "contratos" }],
    depende: ["pedidos"],
    targetType: TIPO_CONTRATO,
    exporta: false,
    async contexto(repo, ws, pr): Promise<CtxContratos> {
      const { contactoDe, usuarioDe } = await comunes(repo, ws, pr);
      return {
        pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
        clienteDePedido: clientesDe(await todosLosCrudos(repo, ws, "pedidos"), contactoDe),
        contactoDe,
        usuarioDe,
        detalle: porId(await todosLosCrudos(repo, ws, "contratos_detalle")),
        numeros: new Set((await repo.catalogosHistoricos(ws)).numerosContrato),
        ...(await mapaYExistentes(repo, ws, "contratos", TIPO_CONTRATO)),
      };
    },
    traducir: (c, ctx: CtxContratos) => traducirContrato(c, ctx),
    registrar: (ctx, _c, d) => registrarNumero((ctx as CtxContratos).numeros, d),
  }),
  parte({
    clave: "proyectos",
    nombre: "Proyectos",
    fuentes: [{ entity: "proyectos" }],
    depende: ["pedidos", "etapas", "usuarios"],
    targetType: TIPO_PROYECTO,
    exporta: true,
    async contexto(repo, ws, pr): Promise<CtxProyectos> {
      const { contactoDe, usuarioDe } = await comunes(repo, ws, pr);
      return {
        contactoDe,
        usuarioDe,
        pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
        clienteDePedido: clientesDe(await todosLosCrudos(repo, ws, "pedidos"), contactoDe),
        circuitoDe: await idsDe(repo, ws, pr, "flujos_proyecto"),
        etapaDe: await idsDe(repo, ws, pr, "posicion_flujo"),
        numeros: new Set((await repo.catalogosHistoricos(ws)).numerosProyecto),
        ...(await mapaYExistentes(repo, ws, "proyectos", TIPO_PROYECTO)),
      };
    },
    traducir: (c, ctx: CtxProyectos) => traducirProyecto(c, ctx),
    registrar: (ctx, _c, d) => registrarNumero((ctx as CtxProyectos).numeros, d),
  }),
  ...(["proyectos_historial", "proyectos_participantes"] as const).map((entity) =>
    parte({
      clave: entity,
      nombre: entity === "proyectos_historial" ? "Historial de etapas de los proyectos" : "Participantes de los proyectos",
      fuentes: [{ entity }],
      depende: ["proyectos"],
      targetType: entity === "proyectos_historial" ? TIPO_PASO : TIPO_PARTICIPANTE,
      exporta: false,
      async contexto(repo, ws, pr): Promise<CtxHijosProyecto> {
        const flujoDeProyecto = new Map<string, string>();
        for (const c of await todosLosCrudos(repo, ws, "proyectos")) {
          const f = idAlboom(campos(c.payload).pipeline_id);
          if (f) flujoDeProyecto.set(c.alboomId, f);
        }
        return {
          proyectoDe: await idsDe(repo, ws, pr, "proyectos"),
          flujoDeProyecto,
          etapaDe: await idsDe(repo, ws, pr, "posicion_flujo"),
          ...(await comunes(repo, ws, pr)),
          rolPorNombre: porNombre((await repo.catalogosHistoricos(ws)).rolesProyecto),
          ...(await mapaYExistentes(repo, ws, entity, entity === "proyectos_historial" ? TIPO_PASO : TIPO_PARTICIPANTE)),
        };
      },
      traducir: entity === "proyectos_historial" ? (c, ctx: CtxHijosProyecto) => traducirPasoProyecto(c, ctx) : (c, ctx: CtxHijosProyecto) => traducirParticipante(c, ctx),
    }),
  ),
  parte({
    clave: "citas",
    nombre: "Citas de la agenda",
    fuentes: [{ entity: "citas" }],
    depende: ["consultas", "pedidos", "proyectos"],
    targetType: TIPO_CITA,
    exporta: false,
    async contexto(repo, ws, pr): Promise<CtxCitas> {
      return {
        ...(await comunes(repo, ws, pr)),
        pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
        proyectoDe: await idsDe(repo, ws, pr, "proyectos"),
        leadDe: await idsDe(repo, ws, pr, "oportunidades"),
        tipoNombreDe: await nombresDe(repo, ws, "tipos_cita"),
        tipoPorNombre: porNombre((await repo.catalogosHistoricos(ws)).tiposCita),
        ...(await mapaYExistentes(repo, ws, "citas", TIPO_CITA)),
      };
    },
    traducir: (c, ctx: CtxCitas) => traducirCita(c, ctx),
  }),
  parte({
    clave: "tareas",
    nombre: "Tareas",
    fuentes: [{ entity: "tareas" }],
    depende: ["consultas", "pedidos", "proyectos"],
    targetType: TIPO_TAREA,
    exporta: false,
    async contexto(repo, ws, pr): Promise<CtxTareas> {
      return {
        ...(await comunes(repo, ws, pr)),
        leadDe: await idsDe(repo, ws, pr, "oportunidades"),
        proyectoDe: await idsDe(repo, ws, pr, "proyectos"),
        pedidoDe: await idsDe(repo, ws, pr, "pedidos"),
        ...(await mapaYExistentes(repo, ws, "tareas", TIPO_TAREA)),
      };
    },
    traducir: (c, ctx: CtxTareas) => traducirTarea(c, ctx),
  }),
];
