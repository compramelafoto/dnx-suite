import { describe, expect, it } from "vitest";
import { armarEventos, eventosDeCumpleanos, eventosDeCuotas, eventosDeCitas } from "./capas";
import { COLOR_CAPA } from "./constantes";
import { rangoMes, rangoSemana } from "./fechas";

const d = (s: string) => new Date(s);

describe("capas de la agenda", () => {
  it("las citas llevan el color de su tipo, son editables sólo con Gestionar y las anuladas no salen", () => {
    const filas = [
      { id: "1", title: "Reunión", status: "AGENDADA", startAt: d("2026-10-09T13:00:00Z"), endAt: d("2026-10-09T14:00:00Z"), allDay: false, ownerUserId: 1, typeColor: "#2563eb" },
      { id: "2", title: "Cancelada", status: "ANULADA", startAt: d("2026-10-09T13:00:00Z"), endAt: d("2026-10-09T14:00:00Z"), allDay: false, ownerUserId: 1, typeColor: null },
      { id: "3", title: "Sin tipo", status: "CONFIRMADA", startAt: d("2026-10-09T15:00:00Z"), endAt: d("2026-10-09T16:00:00Z"), allDay: false, ownerUserId: 1, typeColor: null },
    ];
    const ver = eventosDeCitas(filas, false);
    expect(ver.map((e) => e.id)).toEqual(["cita:1", "cita:3"]);
    expect(ver.every((e) => !e.editable)).toBe(true);
    expect(eventosDeCitas(filas, true)[0]).toMatchObject({ capa: "CITAS", color: "#2563eb", href: "/agenda?cita=1", editable: true, todoElDia: false });
    expect(ver[1].color).toBe("#6b7280");
  });

  it("las cuotas sin saldo no salen", () => {
    const e = eventosDeCuotas([
      { pedidoId: "p", cuotaId: "c1", pedidoNumero: "10", contacto: "Ana", vencimiento: "2026-10-15", saldo: 100 },
      { pedidoId: "p", cuotaId: "c2", pedidoNumero: "10", contacto: "Ana", vencimiento: "2026-10-20", saldo: 0 },
    ]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ capa: "CUOTAS", todoElDia: true, href: "/pedidos/p", editable: false });
    expect(e[0].inicio.toISOString()).toBe("2026-10-15T03:00:00.000Z");
  });

  it("cumpleaños: uno por año del rango; el 29/02 sólo en bisiesto", () => {
    const filas = [{ id: "e", clientId: "c", nombre: "Ana", mes: 2, dia: 29 }, { id: "f", clientId: "c2", nombre: "Beto", mes: 12, dia: 31 }];
    const r = { desdeDia: "2027-12-27", hastaDia: "2028-03-05" };
    expect(eventosDeCumpleanos(filas, r).map((e) => e.id)).toEqual(["cumple:e:2028", "cumple:f:2027"]);
  });

  it("armarEventos: filtra por capas, responsable y rango; ordena con los de todo el día primero", () => {
    const rango = rangoSemana("2026-10-09"); // 5 al 11 de octubre
    const entrada = {
      citas: [
        { id: "a", title: "B", status: "AGENDADA", startAt: d("2026-10-09T13:00:00Z"), endAt: d("2026-10-09T14:00:00Z"), allDay: false, ownerUserId: 1, typeColor: null },
        { id: "b", title: "Fuera", status: "AGENDADA", startAt: d("2026-11-09T13:00:00Z"), endAt: d("2026-11-09T14:00:00Z"), allDay: false, ownerUserId: 1, typeColor: null },
        { id: "c", title: "De otro", status: "AGENDADA", startAt: d("2026-10-09T13:00:00Z"), endAt: d("2026-10-09T14:00:00Z"), allDay: false, ownerUserId: 2, typeColor: null },
      ],
      entregas: [{ proyectoId: "p", nombre: "Boda", finalDueDate: "2026-10-09", ownerUserId: 1 }],
    };
    const todo = armarEventos(entrada, { rango, puedeGestionar: true, ownerUserId: 1 });
    expect(todo.map((e) => e.id)).toEqual(["entrega:p", "cita:a"]);
    expect(todo[0]).toMatchObject({ titulo: "Entrega: Boda", color: COLOR_CAPA.ENTREGAS, editable: false });
    expect(armarEventos(entrada, { rango, puedeGestionar: true, capasVisibles: ["ENTREGAS"] }).map((e) => e.id)).toEqual(["entrega:p"]);
    expect(armarEventos(entrada, { rango: rangoMes("2026-11-01"), puedeGestionar: true }).map((e) => e.id)).toEqual(["cita:b"]);
  });
});
