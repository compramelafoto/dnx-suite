import { describe, expect, it } from "vitest";
import { MOTIVOS } from "../campos";
import { ACTIVIDAD, CORREO, HISTORIAL, NOTA, OPORTUNIDAD, crudo, mapaDe } from "../ejemplos-alboom";
import {
  DUDA_EVENTO_PASADO,
  MOTIVO_EVENTO_PASADO,
  TIPO_CONSULTA,
  traducirActividadConsulta,
  traducirConsulta,
  traducirCorreoConsulta,
  traducirNotaConsulta,
  traducirPasoConsulta,
  type CtxConsultas,
  type CtxHijosConsulta,
} from "./consultas";
import { DUDAS_8B2, MOTIVOS_8B2 } from "./historia";

const ctx = (over: Partial<CtxConsultas> = {}): CtxConsultas => ({
  contactoDe: new Map([["7001", "cli1"], ["7004", "cli4"]]),
  categoriaDe: new Map([["lead_type/12", "cat15"]]),
  origenPorNombre: new Map([["instagram", "o1"]]),
  circuitoDe: new Map([["1611", "v1"]]),
  etapaDe: new Map([["1611/1", "s1"], ["1611/2", "s2"]]),
  usuarioDe: new Map([["1", "7"]]),
  hoy: "2026-10-25",
  existentes: new Set(),
  mapa: new Map(),
  ...over,
});
const op = (over: Record<string, unknown> = {}) => crudo("oportunidades", String(over.id ?? "3001"), { ...OPORTUNIDAD, ...over });

describe("oportunidad → consulta", () => {
  it("abierta con evento futuro: queda abierta en su etapa, con contacto, categoría, origen, evento y responsable", () => {
    const d = traducirConsulta(op(), ctx());
    expect(d).toMatchObject({
      accion: "CREAR",
      datos: {
        clientId: "cli1",
        categoryId: "cat15",
        originId: "o1",
        estimatedValue: "350000.00",
        eventDate: "2027-03-14",
        eventStartsAt: "2027-03-14T21:30:00.000Z",
        eventTimeKnown: true,
        venue: "Estancia La Paz",
        city: "Funes",
        guests: 150,
        partnerOneName: "Lucía",
        partnerTwoName: "Martín",
        leadStatus: "NEW",
        circuitId: "v1",
        stageId: "s1",
        outcome: null,
        motivoPerdida: null,
        closedAt: null,
        ownerUserId: 7,
        numero: "3001",
        createdAt: "2026-09-01T13:15:00.000Z",
      },
    });
    expect(String(d.datos!.nota)).toContain("Título: Boda Lucía y Martín");
    expect(String(d.datos!.nota)).toContain("Prioridad: Alta");
    expect(d.dudas).toBeUndefined();
  });

  it("abierta SIN fecha de evento sigue abierta en su etapa", () => {
    expect(traducirConsulta(op({ event_date: "" }), ctx()).datos).toMatchObject({ outcome: null, stageId: "s1", leadStatus: "NEW" });
  });

  it("abierta con el evento YA PASADO (antes de hoy): se carga perdida con el motivo, la nota y la duda que cuenta el informe", () => {
    const d = traducirConsulta(op({ event_date: "2026-10-24 20:00:00" }), ctx());
    expect(d.datos).toMatchObject({ outcome: "PERDIDA", leadStatus: "LOST", motivoPerdida: MOTIVO_EVENTO_PASADO, closedAt: "2026-10-25T15:00:00.000Z" });
    expect(d.dudas).toContain(DUDA_EVENTO_PASADO);
    expect(String(d.datos!.nota)).toContain(MOTIVO_EVENTO_PASADO);
    // El evento HOY no cuenta como pasado.
    expect(traducirConsulta(op({ event_date: "2026-10-25" }), ctx()).datos).toMatchObject({ outcome: null });
  });

  it("las cerradas en Alboom: ganada / perdida con el estado como motivo", () => {
    expect(traducirConsulta(op({ status_id: "422", completed_date: "2026-09-09 10:00:00" }), ctx()).datos).toMatchObject({ outcome: "GANADA", leadStatus: "WON", motivoPerdida: null, closedAt: "2026-09-09T13:00:00.000Z" });
    expect(traducirConsulta(op({ status_id: "424" }), ctx()).datos).toMatchObject({ outcome: "PERDIDA", motivoPerdida: "Abandonado (Alboom)" });
    expect(traducirConsulta(op({ status_id: "426" }), ctx()).datos).toMatchObject({ motivoPerdida: "Fecha no disponible (Alboom)" });
  });

  it("etapa sin emparejar → primera del circuito (duda); embudo sin emparejar → sin recorrido (duda)", () => {
    expect(traducirConsulta(op({ stage_id: "9" }), ctx())).toMatchObject({ datos: { stageId: null, primeraEtapa: true }, dudas: [DUDAS_8B2.sinEtapa] });
    expect(traducirConsulta(op({ pipeline_id: "77" }), ctx())).toMatchObject({ datos: { circuitId: null }, dudas: [DUDAS_8B2.sinCircuito] });
  });

  it("sin contacto o categoría cargados → OMITIR; ya cargada → IGUAL; borrada en FOTOFFICE → no se recrea", () => {
    expect(traducirConsulta(op({ customer_id: "999" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar });
    expect(traducirConsulta(op({ category_id: "99" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.categoriaSinCargar });
    const c = op();
    expect(traducirConsulta(c, ctx({ mapa: new Map([["3001", mapaDe(c, TIPO_CONSULTA, "lead1")]]), existentes: new Set(["lead1"]) }))).toEqual({ accion: "IGUAL", targetId: "lead1", escribirMapa: false });
    expect(traducirConsulta(c, ctx({ mapa: new Map([["3001", mapaDe(c, TIPO_CONSULTA, "lead1")]]) }))).toEqual({ accion: "OMITIR", motivo: MOTIVOS.borradoEnFotoffice });
    // Cambió en Alboom después: queda igual, con la duda.
    const cambiada = op({ amount: "1" });
    expect(traducirConsulta(cambiada, ctx({ mapa: new Map([["3001", mapaDe(c, TIPO_CONSULTA, "lead1")]]), existentes: new Set(["lead1"]) }))).toMatchObject({ accion: "IGUAL", dudas: [DUDAS_8B2.cambioEnAlboom] });
  });
});

describe("hijos de la oportunidad", () => {
  const hijos = (over: Partial<CtxHijosConsulta> = {}): CtxHijosConsulta => ({
    leadDe: new Map([["3001", "lead1"]]),
    clienteDeLead: new Map([["3001", "cli1"]]),
    embudoDeLead: new Map([["3001", "1611"]]),
    etapaDe: new Map([["1611/1", "s1"]]),
    contactoDe: new Map([["7001", "cli1"]]),
    usuarioDe: new Map([["1", "7"]]),
    categoriasNota: new Map([["presupuesto", "nc1"]]),
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("historial → paso del recorrido con la etapa por posición", () => {
    expect(traducirPasoConsulta(crudo("oportunidades_historial", "3001/h1", HISTORIAL), hijos())).toMatchObject({
      accion: "CREAR",
      datos: { subjectType: "CAPTACION", subjectId: "lead1", toStageId: "s1", actorUserId: 7, actorLabel: "Ana (Alboom)", createdAt: "2026-09-01T13:15:00.000Z" },
    });
    expect(traducirPasoConsulta(crudo("oportunidades_historial", "3002/h1", HISTORIAL), hijos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.consultaSinCargar });
    expect(traducirPasoConsulta(crudo("oportunidades_historial", "3001/h1", HISTORIAL), hijos({ embudoDeLead: new Map() })).accion).toBe("OMITIR");
  });

  it("nota → nota del contacto con su categoría; actividad → hecho de la línea de tiempo; correo → mensaje ya enviado", () => {
    expect(traducirNotaConsulta(crudo("oportunidades_notas", "3001/501", NOTA), hijos())).toMatchObject({
      datos: { clientId: "cli1", categoryId: "nc1", body: "Nota de la consulta 3001 (Alboom) · Presupuesto\nLe mandé el presupuesto", authorUserId: 7 },
    });
    expect(traducirNotaConsulta(crudo("oportunidades_notas", "3001/502", { ...NOTA, text: " " }), hijos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.sinTexto });
    expect(traducirActividadConsulta(crudo("oportunidades_actividades", "3001/h2", ACTIVIDAD), hijos())).toMatchObject({ datos: { clientId: "cli1", kind: "ALBOOM_ACTIVIDAD", texto: "Ana cambió la etapa", consulta: "3001" } });
    expect(traducirCorreoConsulta(crudo("oportunidades_correos", "3001/801", CORREO), hijos())).toMatchObject({ datos: { channel: "EMAIL", status: "SENT", subject: "Presupuesto", body: "Hola Lucía", toAddress: "lucia@correo.test" } });
    expect(traducirCorreoConsulta(crudo("oportunidades_correos", "3001/802", { ...CORREO, message_type: "whatsapp" }), hijos())).toMatchObject({ datos: { channel: "WHATSAPP", status: "OPENED_WHATSAPP", subject: null } });
  });
});
