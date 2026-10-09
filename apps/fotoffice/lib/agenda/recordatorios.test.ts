import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  enviar: vi.fn(async (_m: unknown): Promise<unknown> => ({ status: "SENT", providerId: "re_1" })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA</table>", text: "FIRMA" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));

const RC = await import("./recordatorios");
const PL = await import("./plantillas");

/** 14 de octubre de 2026, 10:00 de Buenos Aires. */
const AHORA = new Date("2026-10-14T13:00:00.000Z");
const EMAIL = "laura@persona.test";
const deps = (ahora = AHORA) => ({ ahora: () => ahora });
const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 3_600_000);

function cita(id: string, startAt: Date, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeCita", {
    id, workspaceId: "ws-1", title: "Reunión con cliente", startAt, endAt: new Date(startAt.getTime() + 3_600_000), ...extra,
  });
}
function participa(citaId: string, extra: Record<string, unknown>) {
  B.agregar("fotofficeCitaParticipante", { citaId, ...extra });
}

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: EMAIL });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "agenda", enabled: true });
  B.agregar("fotofficeAgendaAjustes", { id: "aj-1", workspaceId: "ws-1", reminderEnabled: true, reminderHours: 24 });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("funciones puras", () => {
  it("ventana: después de ahora y hasta ahora + horas", () => {
    const v = RC.ventanaDeRecordatorio(AHORA, 24);
    expect(v.desde).toEqual(AHORA);
    expect(v.hasta).toEqual(new Date("2026-10-15T13:00:00.000Z"));
  });

  it("la hora es la de Argentina; las de todo el día no tienen hora", () => {
    expect(RC.horaDeCita(new Date("2026-10-15T19:30:00.000Z"), false)).toBe("16:30");
    expect(RC.horaDeCita(new Date("2026-10-15T02:05:00.000Z"), false)).toBe("23:05");
    expect(RC.horaDeCita(new Date("2026-10-15T03:00:00.000Z"), true)).toBeNull();
  });
});

describe("recordatorio de citas", () => {
  it("avisa al contacto con correo de una cita que empieza en el plazo; queda registrado en la cita", async () => {
    cita("c1", new Date("2026-10-15T10:30:00.000Z"), { location: "Estudio, Corrientes 1234" });
    participa("c1", { clientId: "cli-1" });
    const r = await RC.enviarRecordatoriosDeCitas(deps());
    expect(r).toEqual({ organizaciones: 1, enviados: 1, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false });
    const m = correo();
    expect(m.to).toBe(EMAIL);
    expect(m.subject).toBe("Recordatorio: Reunión con cliente");
    expect(m.text).toContain("Hola, Laura:");
    expect(m.text).toContain("«Reunión con cliente» del 15/10/2026 a las 07:30, en Estudio, Corrientes 1234.");
    expect(B.datos.fotofficeMessage).toHaveLength(1);
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ entityType: "CITA", entityId: "c1", status: "SENT", automatic: true, errorCode: null });
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(1);
    expect(B.datos.fotofficeCitaRecordatorio[0]).toMatchObject({ citaId: "c1", startAt: new Date("2026-10-15T10:30:00.000Z") });
    const plantilla = B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "RECORDATORIO_CITA")!;
    expect(plantilla).toMatchObject({ enabled: true, entityType: "CITA", channel: "EMAIL" });
  });

  it("una cita de todo el día no dice hora, y sin lugar no dice lugar", async () => {
    cita("c1", new Date("2026-10-15T03:00:00.000Z"), { allDay: true });
    participa("c1", { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
    expect(correo().text).toContain("«Reunión con cliente» del 15/10/2026.");
  });

  it("sólo las citas dentro del plazo: ni las pasadas ni las que empiezan después", async () => {
    cita("pasada", enHoras(-1));
    cita("justo", enHoras(24));
    cita("pronto", enHoras(2));
    cita("lejos", enHoras(25));
    for (const id of ["pasada", "justo", "pronto", "lejos"]) participa(id, { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(2);
    expect(B.datos.fotofficeCitaRecordatorio.map((x) => x.citaId).sort()).toEqual(["justo", "pronto"]);
    B.datos.fotofficeAgendaAjustes[0]!.reminderHours = 48;
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
    expect(B.datos.fotofficeCitaRecordatorio.map((x) => x.citaId).sort()).toEqual(["justo", "lejos", "pronto"]);
  });

  it("sólo citas AGENDADA o CONFIRMADA", async () => {
    cita("a", enHoras(3), { status: "AGENDADA" });
    cita("b", enHoras(3), { status: "CONFIRMADA" });
    cita("c", enHoras(3), { status: "ANULADA" });
    cita("d", enHoras(3), { status: "REALIZADA" });
    for (const id of ["a", "b", "c", "d"]) participa(id, { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(2);
    expect(B.datos.fotofficeCitaRecordatorio.map((x) => x.citaId).sort()).toEqual(["a", "b"]);
  });

  it("una vez por (cita, inicio); si se mueve la cita, vuelve a avisar", async () => {
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(0);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    B.datos.fotofficeCita[0]!.startAt = enHoras(5);
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
    expect(H.enviar).toHaveBeenCalledTimes(2);
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(2);
  });

  it("otra corrida que ya reservó la cita la frena (el único de cita e inicio)", async () => {
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    const original = B.tablas.fotofficeCitaRecordatorio!.findMany;
    B.tablas.fotofficeCitaRecordatorio!.findMany = async (a) => {
      const r = await original(a);
      B.agregar("fotofficeCitaRecordatorio", { id: "otra", citaId: "c1", startAt: B.datos.fotofficeCita[0]!.startAt });
      return r;
    };
    const r = await RC.enviarRecordatoriosDeCitas(deps());
    B.tablas.fotofficeCitaRecordatorio!.findMany = original;
    expect(r).toMatchObject({ enviados: 0, salteados: 1 });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeMessage).toHaveLength(0);
  });

  it("nunca al equipo: un participante usuario no recibe nada y la cita no se marca", async () => {
    cita("c1", enHoras(3));
    participa("c1", { userId: 7 });
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ enviados: 0, salteados: 1 });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
  });

  it("sin correo se saltea y no marca la cita", async () => {
    B.datos.client[0]!.email = null;
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ enviados: 0, salteados: 1 });
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
  });

  it("varios contactos: uno por dirección, sin repetir una dirección compartida", async () => {
    B.agregar("client", { id: "cli-2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", businessName: null, email: "ana@persona.test" });
    B.agregar("client", { id: "cli-3", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mamá", lastName: "Pérez", businessName: null, email: EMAIL.toUpperCase() });
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    participa("c1", { clientId: "cli-2" });
    participa("c1", { clientId: "cli-3" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(2);
    expect(H.enviar.mock.calls.map((c) => (c[0] as OutboundEmail).to).sort()).toEqual(["ana@persona.test", EMAIL]);
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(1);
  });

  it("no avisa con el recordatorio apagado, el módulo apagado o la plantilla apagada; ni crea ajustes", async () => {
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    B.datos.fotofficeAgendaAjustes[0]!.reminderEnabled = false;
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ organizaciones: 0, enviados: 0 });
    B.datos.fotofficeAgendaAjustes[0]!.reminderEnabled = true;

    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(0);
    B.datos.workspaceFeatureModule[0]!.enabled = true;

    await PL.asegurarPlantillaRecordatorioCita("ws-1");
    B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "RECORDATORIO_CITA")!.enabled = false;
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(0);
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);

    B.datos.fotofficeAgendaAjustes = [];
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ organizaciones: 0, enviados: 0 });
    expect(B.datos.fotofficeAgendaAjustes).toHaveLength(0);
  });

  it("no lo frena la regla de 24 h por dirección: es transaccional", async () => {
    B.agregar("fotofficeMessage", {
      id: "m-previo", workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "cli-1", toAddress: EMAIL, body: "x",
      status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
    });
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
  });

  it("tope por corrida: como mucho `tope` intentos y avisa que quedaron", async () => {
    cita("c1", enHoras(2));
    cita("c2", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    participa("c2", { clientId: "cli-1" });
    const r = await RC.enviarRecordatoriosDeCitas({ ...deps(), tope: 1 });
    expect(r).toMatchObject({ enviados: 1, topeCorrida: true });
    expect(RC.TOPE_RECORDATORIOS_CORRIDA).toBe(200);
    // En la próxima hora sale la que quedó.
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
  });

  it("tope diario de automáticos: corta la organización y libera la cita", async () => {
    for (let i = 0; i < 50; i++) {
      B.agregar("fotofficeMessage", {
        id: `auto-${i}`, workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "x", toAddress: `p${i}@x.test`, body: "x",
        status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
      });
    }
    cita("c1", enHoras(3));
    cita("c2", enHoras(4));
    participa("c1", { clientId: "cli-1" });
    participa("c2", { clientId: "cli-1" });
    const r = await RC.enviarRecordatoriosDeCitas(deps());
    expect(r).toMatchObject({ enviados: 0, conTopeDiario: 1 });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
    expect(B.datos.fotofficeMessage.filter((m) => m.errorCode === "EN_CURSO")).toHaveLength(0);
  });

  it("si el proveedor falla, queda registrado y la cita se vuelve a intentar en la próxima hora", async () => {
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    H.enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" });
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ status: "FAILED", entityType: "CITA" });
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
    H.enviar.mockRejectedValue(new Error("caído"));
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ enviados: 0 });
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
    expect(B.datos.fotofficeMessage.filter((m) => m.errorCode === "EN_CURSO")).toHaveLength(0);
    H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_2" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(1);
  });

  it("con la plantilla rota corta la organización sin marcar nada", async () => {
    await PL.asegurarPlantillaRecordatorioCita("ws-1");
    B.datos.fotofficeMessageTemplate[0]!.body = "Hola [variable_que_no_existe]";
    cita("c1", enHoras(3));
    participa("c1", { clientId: "cli-1" });
    expect(await RC.enviarRecordatoriosDeCitas(deps())).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(B.datos.fotofficeCitaRecordatorio).toHaveLength(0);
  });

  it("citas de otra organización no se tocan", async () => {
    cita("ajena", enHoras(3), { workspaceId: "ws-2" });
    participa("ajena", { clientId: "cli-1" });
    expect((await RC.enviarRecordatoriosDeCitas(deps())).enviados).toBe(0);
  });
});
