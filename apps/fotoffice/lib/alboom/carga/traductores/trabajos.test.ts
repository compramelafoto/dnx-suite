import { describe, expect, it } from "vitest";
import { CITA, CONTRATO, CONTRATO_DETALLE, HISTORIAL_PROYECTO, PARTICIPANTE, PROYECTO, TAREA, crudo } from "../ejemplos-alboom";
import { DUDAS_8B2, MOTIVOS_8B2 } from "./historia";
import {
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
} from "./trabajos";

const contactoDe = new Map([["7001", "cli1"], ["7004", "cli4"]]);
const usuarioDe = new Map([["1", "7"]]);

describe("contratos", () => {
  const ctx = (over: Partial<CtxContratos> = {}): CtxContratos => ({
    pedidoDe: new Map([["2025093", "ped1"]]),
    clienteDePedido: new Map([["2025093", "cli1"]]),
    contactoDe,
    usuarioDe,
    detalle: new Map([["357", CONTRATO_DETALLE]]),
    numeros: new Set(),
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("firmado: FIRMADO fuera de FOTOFFICE, con el texto plano y la evidencia en huellas (sin nombres, IP ni imagen)", () => {
    const d = traducirContrato(crudo("contratos", "357", CONTRATO), ctx());
    expect(d).toMatchObject({ accion: "CREAR", datos: { pedidoId: "ped1", clientId: "cli1", number: "357", status: "FIRMADO", signedAt: "2026-09-12T23:15:00.000Z", manualSignedAt: "2026-09-12T23:15:00.000Z", bodyText: "Entre DNX y la parte contratante…\nCláusula 1" } });
    const ev = d.extra!.evento as Record<string, unknown>;
    expect(ev).toMatchObject({ enviado: "2026-09-11T13:05:00.000Z", visto: "2026-09-11T21:00:00.000Z", acepto: true, firmante1Fecha: "2026-09-12T23:15:00.000Z" });
    expect(String(ev.firmante1Ip)).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(ev)).not.toMatch(/Lucía|190\.0|base64/);
  });

  it("enviado sin firmar → BORRADOR (sin enlace) con duda; firma como texto JSON; sin pedido → OMITIR", () => {
    const sinFirma = traducirContrato(crudo("contratos", "358", { ...CONTRATO, id: "358" }), ctx({ detalle: new Map() }));
    expect(sinFirma).toMatchObject({ datos: { status: "BORRADOR", signedAt: null, manualSignedAt: null, bodyText: "(Contrato de Alboom sin texto)" }, dudas: [DUDAS_8B2.enviadoSinFirmar] });
    const json = traducirContrato(crudo("contratos", "359", { ...CONTRATO, signature: JSON.stringify({ signed2: "2026-09-13 10:00:00" }) }), ctx({ detalle: new Map() }));
    expect(json.datos).toMatchObject({ status: "FIRMADO", signedAt: "2026-09-13T13:00:00.000Z" });
    expect(traducirContrato(crudo("contratos", "360", { ...CONTRATO, order_id: "" }), ctx({ detalle: new Map() }))).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.sinPedido });
  });
});

describe("proyectos", () => {
  const ctx = (over: Partial<CtxProyectos> = {}): CtxProyectos => ({
    contactoDe,
    pedidoDe: new Map([["2025093", "ped1"]]),
    clienteDePedido: new Map(),
    circuitoDe: new Map([["77", "t1"]]),
    etapaDe: new Map([["77/1", "e1"], ["77/2", "e2"]]),
    usuarioDe,
    numeros: new Set(),
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("en proceso: abierto en su etapa, con número, fechas y externalId", () => {
    expect(traducirProyecto(crudo("proyectos", "1010", PROYECTO), ctx())).toMatchObject({
      accion: "CREAR",
      datos: { number: "1010", clientId: "cli1", pedidoId: "ped1", circuitId: "t1", stageId: "e2", outcome: null, eventDate: "2025-03-14", baseDate: "2025-03-14", finalDueDate: "2025-05-01", ownerUserId: 7, externalId: "alboom:1010", stageDueAt: "2025-04-01T15:00:00.000Z" },
    });
  });

  it("listo → TERMINADO; cancelado → CANCELADO; suspendido → abierto y suspendido; sin flujo → OMITIR", () => {
    expect(traducirProyecto(crudo("proyectos", "1", { ...PROYECTO, status_id: "204" }), ctx()).datos).toMatchObject({ outcome: "TERMINADO", stageId: null });
    expect(traducirProyecto(crudo("proyectos", "2", { ...PROYECTO, status_id: "202" }), ctx()).datos).toMatchObject({ outcome: "CANCELADO" });
    expect(traducirProyecto(crudo("proyectos", "3", { ...PROYECTO, status_id: "203" }), ctx()).datos).toMatchObject({ outcome: null, suspendReason: "Suspendido en Alboom" });
    expect(traducirProyecto(crudo("proyectos", "4", { ...PROYECTO, pipeline_id: "99" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.flujoSinCargar });
  });

  it("historial y participantes del proyecto", () => {
    const hijos: CtxHijosProyecto = { proyectoDe: new Map([["1010", "pr1"]]), flujoDeProyecto: new Map([["1010", "77"]]), etapaDe: new Map([["77/2", "e2"]]), contactoDe, usuarioDe, rolPorNombre: new Map([["fotografo secundario", "r1"]]), existentes: new Set(), mapa: new Map() };
    expect(traducirPasoProyecto(crudo("proyectos_historial", "1010/h1", HISTORIAL_PROYECTO), hijos)).toMatchObject({ datos: { subjectType: "PROYECTO", subjectId: "pr1", toStageId: "e2" } });
    expect(traducirParticipante(crudo("proyectos_participantes", "1010/5", PARTICIPANTE), hijos)).toMatchObject({ datos: { proyectoId: "pr1", clientId: "cli4", roleId: "r1", note: "Llega 17 h" } });
    expect(traducirParticipante(crudo("proyectos_participantes", "1010/6", { ...PARTICIPANTE, category_name: "Mago" }), hijos)).toMatchObject({ datos: { roleId: null, note: "Mago · Llega 17 h" }, dudas: [DUDAS_8B2.rolSinCargar] });
  });
});

describe("citas y tareas", () => {
  const citas: CtxCitas = {
    contactoDe,
    pedidoDe: new Map([["2025093", "ped1"]]),
    proyectoDe: new Map([["1010", "pr1"]]),
    leadDe: new Map([["3001", "lead1"]]),
    usuarioDe,
    tipoNombreDe: new Map([["4", "Reunión"]]),
    tipoPorNombre: new Map([["reunion", "tc1"]]),
    existentes: new Set(),
    mapa: new Map(),
  };
  it("cita con hora argentina, estado, tipo por nombre, origen y participantes del equipo", () => {
    expect(traducirCita(crudo("citas", "453", CITA), citas)).toMatchObject({
      accion: "CREAR",
      datos: { title: "Reunión con los novios", typeId: "tc1", status: "AGENDADA", startAt: "2026-11-05T21:00:00.000Z", endAt: "2026-11-05T22:00:00.000Z", pedidoId: "ped1", clientId: "cli1", ownerUserId: 7 },
      extra: { participantes: [7] },
    });
    expect(traducirCita(crudo("citas", "454", { ...CITA, status: "Cancelled", end: "2026-11-05 17:00:00" }), citas)).toMatchObject({ datos: { status: "ANULADA", endAt: "2026-11-05T22:00:00.000Z" }, dudas: [DUDAS_8B2.fechaFin] });
    expect(traducirCita(crudo("citas", "455", { ...CITA, title: "" }), citas)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.sinTitulo });
  });

  it("tarea según su origen: recorrido del proyecto o de la consulta, checklist del pedido, nota del contacto o sin destino", () => {
    const t: CtxTareas = { leadDe: citas.leadDe, proyectoDe: citas.proyectoDe, pedidoDe: citas.pedidoDe, contactoDe, usuarioDe, existentes: new Set(), mapa: new Map() };
    expect(traducirTarea(crudo("tareas", "832", TAREA), t)).toMatchObject({ datos: { destino: "TAREA", subjectType: "PROYECTO", subjectId: "pr1", assigneeUserId: 7, doneAt: null } });
    expect(traducirTarea(crudo("tareas", "833", { ...TAREA, type: "leads", target_id: "3001", completed: "1", modified: "2026-10-02 10:00:00" }), t)).toMatchObject({ datos: { subjectType: "CAPTACION", subjectId: "lead1", doneAt: "2026-10-02T13:00:00.000Z" } });
    expect(traducirTarea(crudo("tareas", "834", { ...TAREA, type: "orders", target_id: "2025093" }), t)).toMatchObject({ datos: { destino: "PEDIDO_TAREA", pedidoId: "ped1" } });
    expect(traducirTarea(crudo("tareas", "835", { ...TAREA, type: "contacts", target_id: "7001" }), t)).toMatchObject({ datos: { destino: "NOTA", clientId: "cli1" } });
    expect(traducirTarea(crudo("tareas", "836", { ...TAREA, type: "", target_id: "" }), t)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.sinDestino });
  });
});
