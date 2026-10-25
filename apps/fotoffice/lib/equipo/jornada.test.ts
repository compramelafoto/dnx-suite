import { describe, expect, it } from "vitest";
import { calcularJornada, type TurnoParaJornada } from "./jornada";
import { horarioDelDia, type FichaHorario } from "./horario";

const FECHA = "2026-10-26"; // lunes
const SABINA = 1;
const CAMILA = 2;

/** Un instante de ese lunes en hora argentina ("08:05" → 11:05 UTC). */
function a(hora: string, fecha = FECHA): Date {
  return new Date(`${fecha}T${hora}:00-03:00`);
}

const fichaSabina: FichaHorario = {
  franjas: [0, 1, 2, 3, 4].map((d) => ({ diaSemana: d, inicioMin: 480, finMin: 780 })),
  sabadosAlternados: false,
  sabadoReferencia: null,
};
const horario = horarioDelDia(fichaSabina, [], FECHA);

function turno(p: Partial<TurnoParaJornada> & Pick<TurnoParaJornada, "openedAt" | "openedByUserId">): TurnoParaJornada {
  return { id: "t", closedAt: null, closedByUserId: null, ...p };
}

describe("calcularJornada", () => {
  it("abrió y cerró ella misma dentro de la tolerancia", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:04"), openedByUserId: SABINA, closedAt: a("13:06"), closedByUserId: SABINA })],
      actividades: [a("09:30"), a("12:50")],
      horario,
      toleranciaMin: 10,
    });
    expect(j).toMatchObject({
      estado: "COMPLETA",
      entradaMin: 484,
      salidaMin: 786,
      llegadaTardeMin: 4,
      extraMin: 6,
      trabajadosMin: 302,
      programadosMin: 300,
      fueraDeTolerancia: { tarde: false, temprano: false, extra: false },
      actividades: 2,
    });
  });

  it("llegó tarde y se fue temprano, fuera de la tolerancia", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:25"), openedByUserId: SABINA, closedAt: a("12:40"), closedByUserId: SABINA })],
      actividades: [],
      horario,
      toleranciaMin: 10,
    });
    expect(j.llegadaTardeMin).toBe(25);
    expect(j.salidaTempranaMin).toBe(20);
    expect(j.fueraDeTolerancia).toEqual({ tarde: true, temprano: true, extra: false });
  });

  it("su turno lo cerró otra persona: sin cierre propio, con su última actividad como referencia", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:00"), openedByUserId: SABINA, closedAt: a("14:05"), closedByUserId: CAMILA })],
      actividades: [a("10:00"), a("12:58")],
      horario,
      toleranciaMin: 10,
    });
    expect(j.estado).toBe("SIN_CIERRE_PROPIO");
    expect(j.salidaMin).toBe(778);
    expect(j.salidaEsReferencia).toBe(true);
  });

  it("la compañera que cerró el turno ajeno queda marcada con el pase", () => {
    const j = calcularJornada({
      userId: CAMILA,
      fecha: FECHA,
      turnos: [
        turno({ id: "a", openedAt: a("08:00"), openedByUserId: SABINA, closedAt: a("14:02"), closedByUserId: CAMILA }),
        turno({ id: "b", openedAt: a("14:03"), openedByUserId: CAMILA, closedAt: a("19:01"), closedByUserId: CAMILA }),
      ],
      actividades: [],
      horario: horarioDelDia({ ...fichaSabina, franjas: fichaSabina.franjas.map((f) => ({ ...f, inicioMin: 840, finMin: 1140 })) }, [], FECHA),
      toleranciaMin: 10,
    });
    expect(j).toMatchObject({ estado: "COMPLETA", entradaMin: 843, salidaMin: 1141, cerroTurnoAjeno: true, turnosPropios: 1 });
  });

  it("tiempo de más: cuánto fue sin ventas ni movimientos", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      // Llegó 7:30, primera venta 7:50; horario 8 a 13; última venta 13:20, cerró 14:00.
      turnos: [turno({ openedAt: a("07:30"), openedByUserId: SABINA, closedAt: a("14:00"), closedByUserId: SABINA })],
      actividades: [a("07:50"), a("13:20")],
      horario,
      toleranciaMin: 10,
    });
    expect(j.extraMin).toBe(30 + 60);
    expect(j.extraSinActividadMin).toBe(20 + 40);
    expect(j.fueraDeTolerancia.extra).toBe(true);
  });

  it("turno todavía abierto: hay entrada y no hay salida", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:00"), openedByUserId: SABINA })],
      actividades: [],
      horario,
      toleranciaMin: 10,
    });
    expect(j).toMatchObject({ estado: "TURNO_ABIERTO", entradaMin: 480, salidaMin: null, trabajadosMin: 0 });
  });

  it("vendió sin abrir turno: entrada y salida salen de su actividad", () => {
    const j = calcularJornada({
      userId: CAMILA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:00"), openedByUserId: SABINA })],
      actividades: [a("14:20"), a("18:40")],
      horario,
      toleranciaMin: 10,
    });
    expect(j).toMatchObject({ estado: "SIN_APERTURA_PROPIA", entradaMin: 860, salidaMin: 1120, salidaEsReferencia: true });
  });

  it("los turnos de otro día no cuentan", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:00", "2026-10-23"), openedByUserId: SABINA, closedAt: a("13:00", "2026-10-23"), closedByUserId: SABINA })],
      actividades: [],
      horario,
      toleranciaMin: 10,
    });
    expect(j.estado).toBe("SIN_DATOS");
  });

  it("la corrección del dueño reemplaza la salida y queda marcada", () => {
    const j = calcularJornada({
      userId: SABINA,
      fecha: FECHA,
      turnos: [turno({ openedAt: a("08:00"), openedByUserId: SABINA, closedAt: a("14:05"), closedByUserId: CAMILA })],
      actividades: [a("10:00")],
      horario,
      toleranciaMin: 10,
      correccion: { entradaMin: null, salidaMin: 780, nota: "Se fue a las 13, me avisó" },
    });
    expect(j).toMatchObject({ salidaMin: 780, salidaEsReferencia: false, corregida: true, nota: "Se fue a las 13, me avisó", trabajadosMin: 300 });
  });

  it("un día sin horario: todo lo trabajado es tiempo de más", () => {
    const domingo = horarioDelDia(fichaSabina, [], "2026-10-25");
    const j = calcularJornada({
      userId: SABINA,
      fecha: "2026-10-25",
      turnos: [turno({ openedAt: a("10:00", "2026-10-25"), openedByUserId: SABINA, closedAt: a("12:00", "2026-10-25"), closedByUserId: SABINA })],
      actividades: [a("10:30", "2026-10-25"), a("11:00", "2026-10-25")],
      horario: domingo,
      toleranciaMin: 10,
    });
    expect(j.extraMin).toBe(120);
    expect(j.extraSinActividadMin).toBe(90);
  });
});
