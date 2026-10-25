import { beforeEach, describe, expect, it } from "vitest";
import { CLAVES_CARGA, conDependencias, progresoInicial } from "./catalogo";
import {
  ACTIVIDAD,
  BANCO,
  CATEGORIA_15,
  CITA,
  COBRO,
  COBRO_SIN_PEDIDO,
  CONTACTO,
  CONTRATO,
  CONTRATO_DETALLE,
  CORREO,
  COSTO_PEDIDO,
  CUENTA_COBRAR,
  CUOTA_1,
  CUOTA_2,
  EMBUDO,
  ETAPA_1,
  HISTORIAL,
  HISTORIAL_PROYECTO,
  ITEM_PEDIDO,
  MOVIMIENTO_BANCO,
  NOTA,
  OPORTUNIDAD,
  PAGO,
  PAGO_SUELTO,
  PARTICIPANTE,
  PEDIDO,
  PRESUPUESTO,
  PRESUPUESTO_DETALLE,
  PRODUCTO,
  PROYECTO,
  TAREA,
  USUARIO,
} from "./ejemplos-alboom";
import { informeVacio, type Informe } from "./informe";
import { ejecutarMotor } from "./motor";
import { crearRepoMemoria, type RepoMemoria } from "./repositorio-memoria";
import type { ModoCarga } from "./tipos";
import { DUDA_EVENTO_PASADO, MOTIVO_EVENTO_PASADO } from "./traductores/consultas";
import { MOTIVOS_8B2 } from "./traductores/historia";

const WS = "ws-1";
const OTRO = "ws-2";
const HOY = "2026-10-25";
let M: RepoMemoria;

function sembrarFotoffice(ws: string) {
  M.datos.miembros.push({ workspaceId: ws, userId: 7, email: "ana@estudio.test" });
  M.datos.origenes.push({ workspaceId: ws, id: `${ws}-o1`, name: "Instagram", order: 0 });
  M.datos.categorias.push({ workspaceId: ws, id: `${ws}-c15`, name: "Fotografía o Video de Cumpleaños de 15", group: "EVENTO", order: 0 });
  M.datos.circuitos.push({ workspaceId: ws, id: `${ws}-v1`, name: "Embudo de Ventas DNX 2022", kind: "VENTA" });
  M.datos.etapas.push({ workspaceId: ws, id: `${ws}-s1`, circuitId: `${ws}-v1`, name: "Recepción de la oportunidad" });
  M.datos.circuitos.push({ workspaceId: ws, id: `${ws}-t1`, name: "Impresión de Fotografías", kind: "TRABAJO" });
  M.datos.etapas.push({ workspaceId: ws, id: `${ws}-t1e1`, circuitId: `${ws}-t1`, name: "Recepción" });
  M.datos.etapas.push({ workspaceId: ws, id: `${ws}-t1e2`, circuitId: `${ws}-t1`, name: "Edición" });
  M.datos.catalogos[ws] = { categoriasNota: [{ id: `${ws}-nc1`, name: "Presupuesto" }], rolesProyecto: [{ id: `${ws}-r1`, name: "Fotógrafo secundario" }], tiposCita: [{ id: `${ws}-tc1`, name: "Reunión" }] };
}

function sembrarCrudos(ws: string) {
  // 8B-1: lo que la 8B-2 necesita ya cargado o simulado.
  M.crudo(ws, "usuarios", "1", USUARIO);
  M.crudo(ws, "origenes", "Instagram", { name: "instagram", posicion: 2 });
  M.crudo(ws, "categorias", "lead_type/12", CATEGORIA_15);
  M.crudo(ws, "embudos", "1611", EMBUDO);
  M.crudo(ws, "etapas_embudo", "9001", ETAPA_1);
  M.crudo(ws, "flujos_proyecto", "77", { id: "77", name: "Impresion de Fotografías" });
  M.crudo(ws, "etapas_flujo", "9101", { id: "9101", name: "Recepción", stage: "1", tasks: null, offset_days: "1", type_id: "77" });
  M.crudo(ws, "etapas_flujo", "9102", { id: "9102", name: "Edición", stage: "2", tasks: null, offset_days: "5", type_id: "77" });
  M.crudo(ws, "contactos", "7001", CONTACTO);
  M.crudo(ws, "contactos", "7004", { ...CONTACTO, id: "7004", name: "Martín", lastname: "Ruiz", email: "martin@correo.test", cellular: "3416000000", rg: "", tags: "" });
  M.crudo(ws, "productos", "55", PRODUCTO);
  // 8B-2.
  M.crudo(ws, "oportunidades", "3001", OPORTUNIDAD);
  M.crudo(ws, "oportunidades", "3002", { ...OPORTUNIDAD, id: "3002", event_date: "2026-05-01", stage_id: "1" });
  M.crudo(ws, "oportunidades", "3003", { ...OPORTUNIDAD, id: "3003", status_id: "422", completed_date: "2026-09-09 10:00:00" });
  M.crudo(ws, "oportunidades_historial", "3001/h1", HISTORIAL);
  M.crudo(ws, "oportunidades_notas", "3001/501", NOTA);
  M.crudo(ws, "oportunidades_actividades", "3001/h2", ACTIVIDAD);
  M.crudo(ws, "oportunidades_correos", "3001/801", CORREO);
  M.crudo(ws, "presupuestos", "900", PRESUPUESTO);
  M.crudo(ws, "presupuestos_detalle", "900", PRESUPUESTO_DETALLE);
  M.crudo(ws, "pedidos", "2025093", PEDIDO);
  M.crudo(ws, "pedidos_detalle", "2025093", { order: PEDIDO });
  M.crudo(ws, "pedidos_items", "2025093/1", ITEM_PEDIDO);
  M.crudo(ws, "pedidos_plan_pagos", "2025093/41", CUOTA_1);
  M.crudo(ws, "pedidos_plan_pagos", "2025093/42", CUOTA_2);
  M.crudo(ws, "pedidos_costos", "2025093/71", COSTO_PEDIDO);
  M.crudo(ws, "metodos_pago", "Efectivo", { id: "1", name: "Efectivo" });
  M.crudo(ws, "bancos", "3", BANCO);
  M.crudo(ws, "cobros", "6001", COBRO);
  M.crudo(ws, "cobros", "6002", COBRO_SIN_PEDIDO);
  M.crudo(ws, "cuentas_cobrar", "6101", CUENTA_COBRAR);
  M.crudo(ws, "pagos", "6201", PAGO);
  M.crudo(ws, "pagos", "6202", PAGO_SUELTO);
  M.crudo(ws, "movimientos_bancos", "6301", MOVIMIENTO_BANCO);
  M.crudo(ws, "contratos", "357", CONTRATO);
  M.crudo(ws, "contratos_detalle", "357", CONTRATO_DETALLE);
  M.crudo(ws, "proyectos", "1010", PROYECTO);
  M.crudo(ws, "proyectos_historial", "1010/h1", HISTORIAL_PROYECTO);
  M.crudo(ws, "proyectos_participantes", "1010/5", PARTICIPANTE);
  M.crudo(ws, "citas", "453", CITA);
  M.crudo(ws, "tareas", "832", TAREA);
}

async function correr(modo: ModoCarga, ws = WS) {
  const informe: Informe = informeVacio();
  const r = await ejecutarMotor({
    repo: M.repo,
    workspaceId: ws,
    modo,
    entidades: CLAVES_CARGA,
    informe,
    progreso: progresoInicial({ hoy: HOY }),
    actor: { userId: 7, label: "Migración desde Alboom" },
    ahora: () => 0,
    limite: 1_000_000,
    guardar: async () => true,
  });
  return { r, informe };
}

const historicos = (clave?: string) => M.datos.historicos.filter((h) => h.workspaceId === WS && (!clave || h.clave === clave));
const destinoDe = (entity: string, alboomId: string) => M.datos.mapa.find((m) => m.workspaceId === WS && m.entity === entity && m.alboomId === alboomId)?.targetId;
const destino = () => {
  const { crudos: _c, cargas: _g, extraccionesActivas: _e, ...resto } = M.datos;
  return JSON.stringify(resto);
};

beforeEach(() => {
  M = crearRepoMemoria();
  sembrarFotoffice(WS);
  sembrarFotoffice(OTRO);
  sembrarCrudos(WS);
});

describe("catálogo de la 8B-2", () => {
  it("cada parte nueva arrastra sus dependencias en orden", () => {
    expect(conDependencias(["cobros"])).toEqual(expect.arrayContaining(["contactos", "consultas", "presupuestos", "pedidos", "cuotas", "cobros"]));
    const orden = conDependencias(["tareas"]);
    expect(orden.indexOf("consultas")).toBeLessThan(orden.indexOf("pedidos"));
    expect(orden.indexOf("pedidos")).toBeLessThan(orden.indexOf("proyectos"));
    expect(orden.indexOf("proyectos")).toBeLessThan(orden.indexOf("tareas"));
  });
});

describe("simulación de la 8B-2", () => {
  it("no escribe nada y cuenta todo, incluidas las abiertas que se cierran por evento pasado", async () => {
    const antes = destino();
    const { r, informe } = await correr("SIMULACION");
    expect(r).toBe("COMPLETA");
    expect(M.datos.escrituras).toBe(0);
    expect(destino()).toBe(antes);
    const e = informe.entidades;
    expect(e.consultas).toMatchObject({ leidos: 3, crear: 3 });
    expect(e.consultas!.motivos.dudas[DUDA_EVENTO_PASADO]).toBe(1);
    expect(e.consultas!.ejemplos[DUDA_EVENTO_PASADO]).toEqual(["3002"]);
    for (const k of ["consultas_historial", "consultas_notas", "consultas_actividades", "consultas_correos", "presupuestos", "pedidos", "contratos", "proyectos", "proyectos_historial", "proyectos_participantes", "citas", "tareas"]) {
      expect(e[k], k).toMatchObject({ crear: 1, omitidos: 0, errores: 0 });
    }
    expect(e.cuotas).toMatchObject({ crear: 2 });
    expect(e.cobros).toMatchObject({ crear: 2 });
    expect(e.cuentas_cobrar).toMatchObject({ omitidos: 1 });
    expect(e.cuentas_cobrar!.motivos.omitidos[MOTIVOS_8B2.cuotaDelPedido]).toBe(1);
    expect(e.pagos).toMatchObject({ crear: 1, omitidos: 1 });
    expect(e.pagos!.motivos.omitidos[MOTIVOS_8B2.cubiertoPorCosto]).toBe(1);
  });
});

describe("carga de la 8B-2", () => {
  it("carga todo como histórico y el informe coincide con la simulación", async () => {
    const sim = await correr("SIMULACION");
    const { informe } = await correr("CARGA");
    for (const k of Object.keys(sim.informe.entidades)) {
      const a = informe.entidades[k]!;
      const b = sim.informe.entidades[k]!;
      expect({ k, crear: a.crear, omitidos: a.omitidos, iguales: a.iguales, errores: a.errores }).toEqual({ k, crear: b.crear, omitidos: b.omitidos, iguales: b.iguales, errores: 0 });
    }

    // Consultas: abierta en su etapa; la del evento pasado, perdida con su motivo; la ganada, cerrada.
    const consulta = (id: string) => historicos("consultas").find((h) => h.id === destinoDe("oportunidades", id))!.datos;
    expect(consulta("3001")).toMatchObject({ clientId: destinoDe("contactos", "7001"), categoryId: `${WS}-c15`, originId: `${WS}-o1`, stageId: `${WS}-s1`, outcome: null, ownerUserId: 7, numero: "3001", eventDate: "2027-03-14" });
    expect(consulta("3002")).toMatchObject({ outcome: "PERDIDA", motivoPerdida: MOTIVO_EVENTO_PASADO, leadStatus: "LOST" });
    expect(String(consulta("3002").nota)).toContain(MOTIVO_EVENTO_PASADO);
    expect(consulta("3003")).toMatchObject({ outcome: "GANADA", leadStatus: "WON", motivoPerdida: null });

    // Pedido con su número de Alboom, su presupuesto aceptado y sus ítems.
    const pedido = historicos("pedidos")[0]!;
    expect(pedido.datos).toMatchObject({ number: "2025093", status: "COMPLETADO", totalArs: "300000.00", presupuestoId: destinoDe("presupuestos", "900"), consultaLeadId: destinoDe("oportunidades", "3001") });
    expect((pedido.extra.items as unknown[]).length).toBe(1);
    expect(historicos("presupuestos")[0]!.datos).toMatchObject({ status: "ACEPTADO" });

    // Cobro imputado a la cuota que dice Alboom; el cobro sin pedido, al libro histórico.
    const cobro = historicos("cobros").find((h) => h.tipo === "COBRO")!;
    expect(cobro.datos).toMatchObject({ receiptNumber: "ALB-6001", amountArs: "100000.00", method: "EFECTIVO", pedidoId: pedido.id });
    expect(cobro.extra.imputaciones).toEqual([{ cuotaId: destinoDe("pedidos_plan_pagos", "2025093/41"), amountArs: "100000.00" }]);
    expect(historicos("cobros").find((h) => h.tipo === "FINANZA_HISTORICA")!.datos).toMatchObject({ source: "COBRO", kind: "INGRESO", amountArs: "5000.00", accountName: "Caja del estudio" });

    // El costo pagado toma fecha y medio del pago de Alboom; ese pago no se carga otra vez.
    expect(historicos("costos_pedido")[0]!.datos).toMatchObject({ amountArs: "40000.00", paidMethod: "TRANSFERENCIA", supplierClientId: destinoDe("contactos", "7004") });
    expect(historicos("pagos")).toHaveLength(1);
    expect(historicos("pagos")[0]!.datos).toMatchObject({ concept: "Alquiler de luces", paidMethod: "EFECTIVO", pedidoId: null });
    expect(historicos("movimientos_bancos")[0]!.datos).toMatchObject({ kind: "INGRESO", amountArs: "80000.00" });

    // Contrato firmado "fuera de FOTOFFICE", con la evidencia sin datos personales.
    const contrato = historicos("contratos")[0]!;
    expect(contrato.datos).toMatchObject({ status: "FIRMADO", number: "357", bodyText: "Entre DNX y la parte contratante…\nCláusula 1" });
    expect(contrato.datos.manualSignedAt).toBe(contrato.datos.signedAt);
    expect(JSON.stringify(contrato.extra.evento)).not.toMatch(/Lucía|190\.0\.0\.1|base64/);

    // Proyecto en su etapa (posición 2 del flujo 77) y la cita y la tarea atadas.
    expect(historicos("proyectos")[0]!.datos).toMatchObject({ number: "1010", circuitId: `${WS}-t1`, stageId: `${WS}-t1e2`, pedidoId: pedido.id, externalId: "alboom:1010" });
    expect(historicos("citas")[0]!.datos).toMatchObject({ pedidoId: pedido.id, typeId: null, status: "AGENDADA", startAt: "2026-11-05T21:00:00.000Z" });
    expect(historicos("tareas")[0]!.datos).toMatchObject({ destino: "TAREA", subjectType: "PROYECTO", subjectId: destinoDe("proyectos", "1010") });
  });

  it("no toca la Caja operativa y deja cuotas y citas como ya avisadas", async () => {
    await correr("CARGA");
    expect(M.datos.movimientosCaja).toHaveLength(0);
    for (const h of historicos()) {
      expect(h.datos).not.toHaveProperty("cashMovementId");
      expect(h.datos).not.toHaveProperty("paidCashMovementId");
    }
    const cuotas = historicos("cuotas").map((h) => h.id).sort();
    expect(M.datos.recordatoriosCuota.map((r) => r.cuotaId).sort()).toEqual(cuotas);
    expect(M.datos.recordatoriosCita.map((r) => r.citaId)).toEqual(historicos("citas").map((h) => h.id));
  });

  it("es idempotente: cargar otra vez no duplica nada", async () => {
    await correr("CARGA");
    const cantidad = M.datos.historicos.length;
    const antes = destino();
    const { informe } = await correr("CARGA");
    expect(M.datos.historicos.length).toBe(cantidad);
    expect(destino()).toBe(antes);
    for (const [k, e] of Object.entries(informe.entidades)) expect({ k, crear: e.crear, errores: e.errores }).toEqual({ k, crear: 0, errores: 0 });
    expect(informe.entidades.pedidos).toMatchObject({ iguales: 1 });
  });

  it("si el crudo cambió en Alboom después de cargarlo, no se actualiza (es histórico)", async () => {
    await correr("CARGA");
    M.crudo(WS, "pedidos", "2025093", { ...PEDIDO, memo: "otro memo" });
    const { informe } = await correr("CARGA");
    expect(informe.entidades.pedidos).toMatchObject({ crear: 0, actualizar: 0, iguales: 1, dudas: 1 });
    expect(historicos("pedidos")).toHaveLength(1);
  });

  it("el informe no lleva datos personales y no toca otro workspace", async () => {
    const otroAntes = JSON.stringify(M.datos.historicos.filter((h) => h.workspaceId === OTRO));
    const { informe } = await correr("CARGA");
    const texto = JSON.stringify(informe).toLowerCase();
    for (const dato of ["lucía", "lucia", "martín", "correo.test", "estancia", "190.0.0.1", "alquiler"]) expect(texto).not.toContain(dato);
    expect(JSON.stringify(M.datos.historicos.filter((h) => h.workspaceId === OTRO))).toBe(otroAntes);
  });
});
