import { describe, expect, it } from "vitest";
import {
  cuerpoDeCita, decideEntrega, decideLocal, decideRemote, idEventoCita, idEventoEntrega, tiempoDeEventoGoogle, type CitaLocal, type EventoGoogle,
} from "./sync-decisiones";

const evento = (extra: Partial<EventoGoogle> = {}): EventoGoogle => ({
  id: "g1", status: "confirmed", updated: "2026-10-09T12:00:00.000Z", summary: "Reunión",
  start: { dateTime: "2026-10-10T13:00:00-03:00" }, end: { dateTime: "2026-10-10T14:00:00-03:00" }, ...extra,
});
const cita = (extra: Partial<CitaLocal> = {}): CitaLocal => ({
  id: "c1", status: "AGENDADA", title: "Reunión", startAt: new Date("2026-10-10T16:00:00Z"), endAt: new Date("2026-10-10T17:00:00Z"),
  allDay: false, location: null, googleEventId: "g1", googleUpdatedAt: new Date("2026-10-09T11:00:00Z"), ...extra,
});

describe("tiempoDeEventoGoogle", () => {
  it("todo el día: end.date exclusivo, a medianoche de Argentina", () => {
    expect(tiempoDeEventoGoogle({ start: { date: "2026-10-10" }, end: { date: "2026-10-12" } })).toEqual({
      allDay: true, startAt: new Date("2026-10-10T03:00:00Z"), endAt: new Date("2026-10-12T03:00:00Z"),
    });
    expect(tiempoDeEventoGoogle({ start: { date: "2026-10-10" }, end: null })?.endAt.toISOString()).toBe("2026-10-11T03:00:00.000Z");
  });
  it("con hora; sin fin o fin anterior dura una hora; sin inicio, null", () => {
    expect(tiempoDeEventoGoogle({ start: { dateTime: "2026-10-10T13:00:00-03:00" }, end: undefined })?.endAt.toISOString()).toBe("2026-10-10T17:00:00.000Z");
    expect(tiempoDeEventoGoogle({ start: null, end: null })).toBeNull();
  });
});

describe("decideRemote", () => {
  it("evento nuevo en Google: crear (título vacío con valor por omisión)", () => {
    const r = decideRemote(evento({ summary: "  " }), null);
    expect(r.accion).toBe("crear");
    if (r.accion === "crear") expect(r.datos).toMatchObject({ title: "(sin título)", googleEventId: "g1", allDay: false });
  });
  it("la descripción de Google viaja como notas, y un cambio sólo de notas actualiza", () => {
    const c = decideRemote(evento({ description: " Llevar contrato " }), null);
    if (c.accion === "crear") expect(c.datos.notes).toBe("Llevar contrato");
    const r = decideRemote(evento({ description: "Otra nota" }), cita({ notes: "Llevar contrato" }));
    expect(r.accion).toBe("actualizar");
    expect(decideRemote(evento({ description: "Llevar contrato" }), cita({ notes: "Llevar contrato " })).accion).toBe("ignorar");
  });
  it("evento borrado que no teníamos: ignorar", () => {
    expect(decideRemote(evento({ status: "cancelled" }), null).accion).toBe("ignorar");
  });
  it("borrado en Google: anular la cita (si ya estaba anulada, ignorar)", () => {
    expect(decideRemote(evento({ status: "cancelled" }), cita()).accion).toBe("anular");
    expect(decideRemote(evento({ status: "cancelled" }), cita({ status: "ANULADA" })).accion).toBe("ignorar");
  });
  it("gana el último: Google más nuevo con cambios actualiza; igual o más viejo, no", () => {
    expect(decideRemote(evento({ summary: "Otro" }), cita()).accion).toBe("actualizar");
    expect(decideRemote(evento({ summary: "Otro" }), cita({ googleUpdatedAt: new Date("2026-10-09T12:00:00Z") })).accion).toBe("ignorar");
    expect(decideRemote(evento({ summary: "Otro" }), cita({ googleUpdatedAt: new Date("2026-10-09T13:00:00Z") })).accion).toBe("ignorar");
  });
  it("más nuevo pero sin cambios de contenido: ignorar", () => {
    expect(decideRemote(evento(), cita()).accion).toBe("ignorar");
  });
  it("cita sin googleUpdatedAt: lo de Google se aplica", () => {
    expect(decideRemote(evento({ summary: "Otro" }), cita({ googleUpdatedAt: null })).accion).toBe("actualizar");
  });
  it("las entregas de proyectos (marca foKind) se ignoran siempre", () => {
    const e = evento({ extendedProperties: { private: { foKind: "entrega" } } });
    expect(decideRemote(e, null).accion).toBe("ignorar");
    expect(decideRemote({ ...e, status: "cancelled" }, cita()).accion).toBe("ignorar");
  });
  it("cita local anulada no se revive; evento sin fecha se ignora", () => {
    expect(decideRemote(evento({ summary: "Otro" }), cita({ status: "ANULADA" })).accion).toBe("ignorar");
    expect(decideRemote(evento({ start: null }), null).accion).toBe("ignorar");
  });
});

describe("decideLocal", () => {
  it("crear/editar sin evento: insert; con evento: patch", () => {
    expect(decideLocal(cita({ googleEventId: null }), "crear").accion).toBe("insert");
    expect(decideLocal(cita(), "mover")).toMatchObject({ accion: "patch", googleEventId: "g1" });
  });
  it("anular o borrar: delete si estaba en Google, si no nada", () => {
    expect(decideLocal(cita(), "anular")).toEqual({ accion: "delete", googleEventId: "g1" });
    expect(decideLocal(cita({ googleEventId: null }), "borrar").accion).toBe("nada");
    expect(decideLocal(cita({ status: "ANULADA" }), "editar").accion).toBe("delete");
  });
  it("el patch siempre manda status confirmed (revive un evento borrado: cita anulada y reactivada)", () => {
    const r = decideLocal(cita({ status: "AGENDADA", googleEventId: "g1" }), "editar");
    expect(r.accion).toBe("patch");
    if (r.accion === "patch") expect(r.cuerpo.status).toBe("confirmed");
    const i = decideLocal(cita({ googleEventId: null }), "crear");
    if (i.accion === "insert") expect(i.cuerpo.status).toBe("confirmed");
  });
  it("el patch VACÍA lugar y notas (texto vacío); el insert los omite", () => {
    const p = decideLocal(cita({ location: null, notes: "  " }), "editar");
    if (p.accion !== "patch") throw new Error("se esperaba patch");
    expect(p.cuerpo.location).toBe("");
    expect(p.cuerpo.description).toBe("");
    const i = decideLocal(cita({ googleEventId: null, location: null, notes: null }), "crear");
    if (i.accion !== "insert") throw new Error("se esperaba insert");
    expect("location" in i.cuerpo).toBe(false);
    expect("description" in i.cuerpo).toBe(false);
  });
  it("el id de la cita sirve para Google y es estable", () => {
    expect(idEventoCita("ckabc123xyz")).toBe(idEventoCita("ckabc123xyz"));
    expect(idEventoCita("ckabc123xyz")).toMatch(/^[a-v0-9]{5,1024}$/);
  });
  it("el cuerpo: con hora usa dateTime y huso; todo el día usa date (fin exclusivo)", () => {
    const c = cuerpoDeCita(cita({ location: " Salón ", notes: "x" }));
    expect(c).toMatchObject({ summary: "Reunión", location: "Salón", description: "x", start: { dateTime: "2026-10-10T16:00:00.000Z", timeZone: "America/Argentina/Buenos_Aires" } });
    expect(c.extendedProperties.private).toEqual({ foKind: "cita", foCitaId: "c1" });
    const t = cuerpoDeCita(cita({ allDay: true, startAt: new Date("2026-10-10T03:00:00Z"), endAt: new Date("2026-10-11T03:00:00Z") }));
    expect(t.start).toEqual({ date: "2026-10-10" });
    expect(t.end).toEqual({ date: "2026-10-11" });
  });
});

describe("decideEntrega", () => {
  const p = { id: "pry1", name: "Boda Ana", finalDueDate: "2026-11-20", suspendedAt: null, abierto: true };
  it("proyecto abierto con fecha: evento de todo el día «Entrega: …» marcado como entrega", () => {
    const r = decideEntrega(p);
    expect(r).toMatchObject({ accion: "upsert", eventId: idEventoEntrega("pry1") });
    if (r.accion === "upsert") {
      expect(r.cuerpo.summary).toBe("Entrega: Boda Ana");
      expect(r.cuerpo.start).toEqual({ date: "2026-11-20" });
      expect(r.cuerpo.end).toEqual({ date: "2026-11-21" });
      expect(r.cuerpo.extendedProperties.private.foKind).toBe("entrega");
      expect(r.cuerpo.status).toBe("confirmed");
    }
  });
  it("suspendido, cerrado o sin fecha: se borra el evento", () => {
    expect(decideEntrega({ ...p, suspendedAt: new Date() }).accion).toBe("delete");
    expect(decideEntrega({ ...p, abierto: false }).accion).toBe("delete");
    expect(decideEntrega({ ...p, finalDueDate: null }).accion).toBe("delete");
  });
  it("el id sirve para Google (a–v y dígitos, 5 a 1024)", () => {
    expect(idEventoEntrega("clx9abcZ")).toMatch(/^[a-v0-9]{5,1024}$/);
  });
});
