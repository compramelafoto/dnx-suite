import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { reservarTurno } = await import("./reservar");
const { cancelarTurno, reprogramarTurno } = await import("./gestion");
const { guardarConfigTurnoTipo, guardarAjustesTurnos } = await import("./configurar");
const { validarConfigTurnoTipo } = await import("./configuracion");
const { AJUSTES_TURNOS_DE_FABRICA, MENSAJES_TURNOS: M } = await import("./constantes");
import type { TipoPublicado } from "./publico";

// Viernes 6/11/2026 09:00 de Argentina.
const AHORA = new Date("2026-11-06T12:00:00.000Z");
const ar = (s: string) => new Date(`${s}:00.000-03:00`);
const LUNES_10 = ar("2026-11-09T10:00");

const TIPO: TipoPublicado = {
  id: "tipo-1", name: "Asesoramiento uno a uno", color: "#000000", publicDescription: null, durationMinutes: 60,
  modality: "ONLINE", address: "https://meet.google.com/abc", franjas: [{ weekday: 1, startMinute: 600, endMinute: 780 }],
};
const DATOS = { nombre: "Ana Pérez", correo: "ana@x.com", telefono: "3415551234", mensaje: "Quiero ordenar mis precios" };
const entrada = (over: Partial<Parameters<typeof reservarTurno>[0]> = {}) => ({
  workspaceId: "ws-1", hostUserId: 4, tipo: TIPO, ajustes: AJUSTES_TURNOS_DE_FABRICA, inicio: LUNES_10, datos: DATOS, ocupadoGoogle: [], ahora: AHORA, ...over,
});

const DUENO = { workspaceId: "ws-1", userId: 4, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { agenda: "MANAGE" } } as never };
const STAFF = { workspaceId: "ws-1", userId: 2, userLabel: "Staff", role: "STAFF", acceso: { role: "STAFF", levels: { agenda: "MANAGE" } } as never };

beforeEach(() => B.vaciar());

describe("reservar un turno", () => {
  it("crea el cliente, la cita confirmada en la Agenda y el turno, con el token sólo como hash", async () => {
    const r = await reservarTurno(entrada());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [cita] = B.datos.fotofficeCita;
    expect(cita).toMatchObject({ workspaceId: "ws-1", title: "Asesoramiento uno a uno — Ana Pérez", typeId: "tipo-1", status: "CONFIRMADA", ownerUserId: 4, location: "https://meet.google.com/abc" });
    expect((cita.endAt as Date).toISOString()).toBe(ar("2026-11-09T11:00").toISOString());
    expect(String(cita.notes)).toContain("Quiero ordenar mis precios");
    const [turno] = B.datos.fotofficeTurno;
    expect(turno).toMatchObject({ status: "CONFIRMADO", contactEmail: "ana@x.com", citaId: cita.id, clientId: cita.clientId, answers: { mensaje: DATOS.mensaje } });
    expect(turno.manageTokenHash).not.toBe(r.token);
    expect(B.datos.client).toHaveLength(1);
    expect(B.datos.client[0]).toMatchObject({ firstName: "Ana", lastName: "Pérez", email: "ana@x.com" });
  });

  it("con el bloqueo tomado, vuelve a mirar la Agenda: si otro ganó el horario, dice que se ocupó", async () => {
    // Justo cuando esta reserva toma el bloqueo, otra ya guardó su cita en el mismo horario.
    B.ganchos.alEjecutarSql = (texto, valores) => {
      if (texto.includes("pg_advisory_xact_lock") && String(valores[0]) === "fotoffice-turnos:ws-1") {
        B.datos.fotofficeCita.push({ id: "gano", workspaceId: "ws-1", title: "Beto", status: "CONFIRMADA", allDay: false, ownerUserId: 4, startAt: LUNES_10, endAt: ar("2026-11-09T11:00") });
      }
    };
    expect(await reservarTurno(entrada())).toEqual({ ok: false, error: M.ocupado });
    B.ganchos.alEjecutarSql = null;
    expect(B.datos.fotofficeTurno).toHaveLength(0);
    expect(B.datos.client).toHaveLength(0);
  });

  it("respeta lo ocupado en Google y en la Agenda, la grilla y el tope por correo", async () => {
    expect(await reservarTurno(entrada({ ocupadoGoogle: [{ startAt: ar("2026-11-09T10:30"), endAt: ar("2026-11-09T10:45") }] }))).toEqual({ ok: false, error: M.ocupado });
    expect((await reservarTurno(entrada({ inicio: ar("2026-11-09T10:30") }))).ok).toBe(false);
    B.datos.fotofficeCita.push({ id: "otra", workspaceId: "ws-1", title: "Sesión", status: "AGENDADA", allDay: false, ownerUserId: null, startAt: ar("2026-11-09T11:00"), endAt: ar("2026-11-09T12:00") });
    expect(await reservarTurno(entrada({ inicio: ar("2026-11-09T11:00") }))).toEqual({ ok: false, error: M.ocupado });
    // Una cita anulada o de otra persona del equipo no ocupa.
    B.datos.fotofficeCita.push({ id: "anulada", workspaceId: "ws-1", title: "x", status: "ANULADA", allDay: false, ownerUserId: null, startAt: ar("2026-11-16T10:00"), endAt: ar("2026-11-16T11:00") });
    B.datos.fotofficeCita.push({ id: "de-otro", workspaceId: "ws-1", title: "x", status: "AGENDADA", allDay: false, ownerUserId: 99, startAt: ar("2026-11-23T10:00"), endAt: ar("2026-11-23T11:00") });
    for (const dia of ["2026-11-09T10:00", "2026-11-16T10:00", "2026-11-23T10:00"]) {
      expect((await reservarTurno(entrada({ inicio: ar(dia) }))).ok).toBe(true);
    }
    expect(await reservarTurno(entrada({ inicio: ar("2026-11-30T10:00") }))).toEqual({ ok: false, error: M.demasiados });
  });
});

describe("gestión por enlace", () => {
  async function reservado() {
    const r = await reservarTurno(entrada());
    if (!r.ok) throw new Error("no reservó");
    const t = B.datos.fotofficeTurno[0];
    return { id: t.id as string, workspaceId: "ws-1", typeId: "tipo-1", citaId: t.citaId as string, startAt: LUNES_10, endAt: t.endAt as Date, hostUserId: 4, status: "CONFIRMADO", contactName: "Ana Pérez", contactEmail: "ana@x.com", contactPhone: null, cancelado: false };
  }

  it("cancela hasta 48 h antes y anula la cita; después ya no", async () => {
    const t = await reservado();
    expect(await cancelarTurno(t, AJUSTES_TURNOS_DE_FABRICA, new Date("2026-11-07T14:00:00.000Z"))).toEqual({ ok: false, error: M.fueraDePlazo });
    expect(await cancelarTurno(t, AJUSTES_TURNOS_DE_FABRICA, AHORA)).toEqual({ ok: true });
    expect(B.datos.fotofficeTurno[0]).toMatchObject({ status: "CANCELADO", cancelledBy: "CLIENTE" });
    expect(B.datos.fotofficeCita[0].status).toBe("ANULADA");
    // El horario queda libre otra vez.
    expect((await reservarTurno(entrada({ datos: { ...DATOS, correo: "otro@x.com" } }))).ok).toBe(true);
  });

  it("reprograma a un horario libre, sin ocuparse a sí mismo, y mueve la cita", async () => {
    const t = await reservado();
    const nuevo = ar("2026-11-09T10:00");
    // El mismo horario: su propia cita no lo bloquea.
    expect(await reprogramarTurno(t, TIPO, AJUSTES_TURNOS_DE_FABRICA, nuevo, [], AHORA)).toEqual({ ok: true });
    const mas = ar("2026-11-09T12:00");
    expect(await reprogramarTurno(t, TIPO, AJUSTES_TURNOS_DE_FABRICA, mas, [], AHORA)).toEqual({ ok: true });
    expect((B.datos.fotofficeCita[0].startAt as Date).getTime()).toBe(mas.getTime());
    expect((B.datos.fotofficeTurno[0].endAt as Date).getTime()).toBe(ar("2026-11-09T13:00").getTime());
    expect(await reprogramarTurno(t, TIPO, AJUSTES_TURNOS_DE_FABRICA, mas, [{ startAt: mas, endAt: ar("2026-11-09T12:30") }], AHORA)).toEqual({ ok: false, error: M.ocupado });
  });
});

describe("configuración", () => {
  it("valida lo necesario para publicar", () => {
    const base = { isBookable: true, durationMinutes: 30, modality: "TELEFONO", franjas: [{ weekday: 2, inicio: "10:00", fin: "12:00" }] };
    expect(validarConfigTurnoTipo(base).ok).toBe(true);
    expect(validarConfigTurnoTipo({ ...base, franjas: [] })).toEqual({ ok: false, error: M.sinFranjas });
    expect(validarConfigTurnoTipo({ ...base, durationMinutes: 5 })).toEqual({ ok: false, error: M.duracion });
    expect(validarConfigTurnoTipo({ ...base, modality: "ESTUDIO" })).toEqual({ ok: false, error: M.direccion });
    expect(validarConfigTurnoTipo({ ...base, modality: "X" })).toEqual({ ok: false, error: M.modalidad });
    // Sin publicar se puede guardar a medias.
    expect(validarConfigTurnoTipo({ isBookable: false }).ok).toBe(true);
  });

  it("guarda el tipo y sus franjas (reemplazándolas) y los ajustes; sólo quien configura", async () => {
    B.datos.fotofficeCitaTipo.push({ id: "tipo-1", workspaceId: "ws-1", name: "Llamada", color: "#000000", order: 0, isActive: true, isBookable: false });
    const datos = { isBookable: true, durationMinutes: 30, modality: "TELEFONO", franjas: [{ weekday: 2, inicio: "10:00", fin: "12:00" }, { weekday: 4, inicio: "15:00", fin: "18:00" }] };
    expect(await guardarConfigTurnoTipo(STAFF, "tipo-1", datos)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await guardarConfigTurnoTipo(DUENO, "tipo-1", datos)).toEqual({ ok: true });
    expect(await guardarConfigTurnoTipo(DUENO, "tipo-1", { ...datos, franjas: [{ weekday: 3, inicio: "09:00", fin: "10:00" }] })).toEqual({ ok: true });
    expect(B.datos.fotofficeCitaTipo[0]).toMatchObject({ isBookable: true, durationMinutes: 30, modality: "TELEFONO" });
    expect(B.datos.fotofficeCitaTipoFranja.map((f) => [f.weekday, f.startMinute, f.endMinute])).toEqual([[3, 540, 600]]);
    expect(await guardarConfigTurnoTipo(DUENO, "nada", datos)).toEqual({ ok: false, error: M.tipoNoExiste });

    expect(await guardarAjustesTurnos(DUENO, { cancelWindowHours: 24, bufferMinutes: 15, minAdvanceHours: 12, maxAdvanceDays: 30, notifyEmail: "Yo@X.com" })).toEqual({ ok: true });
    expect(B.datos.fotofficeTurnosAjustes[0]).toMatchObject({ cancelWindowHours: 24, bufferMinutes: 15, notifyEmail: "yo@x.com" });
    expect((await guardarAjustesTurnos(DUENO, { cancelWindowHours: -1, bufferMinutes: 0, minAdvanceHours: 0, maxAdvanceDays: 30 })).ok).toBe(false);
  });
});
