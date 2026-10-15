import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const A = await import("./ajustes");
const { MENSAJES_AGENDA: M } = await import("./acceso");

const ctx = (role: string) => ({ workspaceId: "ws-1", userId: 1, userLabel: "Ana", role, acceso: { role, levels: {} } as never });

beforeEach(() => B.vaciar());

describe("ajustes del recordatorio de citas", () => {
  it("sin fila valen los de fábrica: apagado, 24 horas", async () => {
    expect(await A.leerAjustesRecordatorio("ws-1")).toEqual({ activo: false, horas: 24 });
  });

  it("el dueño guarda encendido y horas; no pisa lo de Google", async () => {
    B.agregar("fotofficeAgendaAjustes", { id: "aj", workspaceId: "ws-1", googleCalendarId: "cal-1" });
    expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_OWNER"), { activo: true, horas: "48" })).toEqual({ ok: true });
    expect(B.datos.fotofficeAgendaAjustes[0]).toMatchObject({ reminderEnabled: true, reminderHours: 48, googleCalendarId: "cal-1" });
    expect(await A.leerAjustesRecordatorio("ws-1")).toEqual({ activo: true, horas: 48 });
  });

  it("crea la fila la primera vez", async () => {
    expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_ADMIN"), { activo: false, horas: 1 })).toEqual({ ok: true });
    expect(B.datos.fotofficeAgendaAjustes).toHaveLength(1);
  });

  it("las horas van de 1 a 168, enteras", async () => {
    for (const horas of [0, 169, 1.5, "x", "", null, undefined, -3]) {
      expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_OWNER"), { activo: true, horas })).toEqual({ ok: false, error: A.MENSAJES_AJUSTES_AGENDA.horas });
    }
    expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_OWNER"), { activo: true, horas: 168 })).toEqual({ ok: true });
    expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_OWNER"), { activo: "si", horas: 24 })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await A.guardarAjustesRecordatorio(ctx("WORKSPACE_OWNER"), null)).toEqual({ ok: false, error: M.datosInvalidos });
  });

  it("sólo `configurar`: un integrante común no puede", async () => {
    expect(await A.guardarAjustesRecordatorio(ctx("STAFF"), { activo: true, horas: 24 })).toEqual({ ok: false, error: M.sinPermiso });
    expect(B.datos.fotofficeAgendaAjustes).toHaveLength(0);
  });
});
