import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Nunca sale un correo real: el transporte está reemplazado y cada prueba mira qué le llegó.
const H = vi.hoisted(() => ({
  real: vi.fn(),
  modulo: vi.fn(async (_ws: string, _m: string) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA-HTML</table>", text: "FIRMA-TEXTO" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.real }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("./sitio", () => ({
  sitioDelWorkspace: async (ws: string) =>
    ws === "ws-1" || ws === "ws-2"
      ? { workspaceId: ws, slug: ws === "ws-1" ? "dnx" : "otro", customDomain: null, nombre: "Estudio", logoUrl: null, whatsapp: null, email: null }
      : null,
}));

const S = await import("./seguimiento");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

// 07/10/2026 12:00 en Buenos Aires.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const EMAIL = "laura@persona.test";
const CLAVE = "clave-de-prueba";

function enviador() {
  return vi.fn(async (_m: OutboundEmail) => ({ status: "SENT" as const, providerId: "re_1" }));
}
/** `ahora` sigue al reloj (falso) de la prueba: los registros de la base en memoria usan el mismo. */
const deps = (extra: Record<string, unknown> = {}) => ({ clave: CLAVE, appOrigin: "https://fotoffice.test", ahora: () => new Date(), enviar: enviador(), ...extra });

let n = 0;
/** Un presupuesto enviado hace `dias` días (calendario de Buenos Aires), con su consulta. */
function enviado(dias: number, datos: { ws?: string; status?: string; email?: string; validUntil?: Date | null; aceptada?: boolean } = {}) {
  n++;
  const ws = datos.ws ?? "ws-1";
  const leadId = `lead-${n}`;
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: ws, name: "Laura Pérez", email: datos.email ?? EMAIL, eventType: "BODA" });
  B.agregar("client", { id: `cli-${n}`, workspaceId: ws, kind: "PERSONA", firstName: "Laura", lastName: "Pérez" });
  B.agregar("fotofficeConsulta", { workspaceId: ws, leadId, clientId: `cli-${n}`, categoryId: "cat" });
  const p = B.agregar("fotofficePresupuesto", {
    workspaceId: ws, consultaLeadId: leadId, clientId: `cli-${n}`, status: datos.status ?? "ENVIADO",
    validUntil: datos.validUntil === undefined ? new Date("2026-12-31T00:00:00.000Z") : datos.validUntil,
  });
  const v = B.agregar("fotofficePresupuestoVersion", {
    workspaceId: ws, presupuestoId: p.id, number: 1, items: [], totals: { total: 250000 },
    sentAt: new Date(AHORA.getTime() - dias * DIA), acceptedAt: datos.aceptada ? AHORA : null,
  });
  p.currentVersionId = v.id;
  return { presupuestoId: p.id as string, versionId: v.id as string, leadId };
}

const mensajes = () => B.datos.fotofficeMessage;

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.real.mockReset();
  H.modulo.mockReset();
  H.modulo.mockResolvedValue(true);
  B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-1", followUpEnabled: true, followUpDays: 3 });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("puras", () => {
  it("días de calendario de Buenos Aires", () => {
    // 06/10 23:30 en Buenos Aires = 07/10 02:30 UTC: es el día anterior.
    expect(S.diasDesdeElEnvio(new Date("2026-10-07T02:30:00.000Z"), AHORA)).toBe(1);
    expect(S.diasDesdeElEnvio(new Date("2026-10-07T03:30:00.000Z"), AHORA)).toBe(0);
    expect(S.diasDesdeElEnvio(new Date("2026-10-04T14:00:00.000Z"), AHORA)).toBe(3);
  });

  it("sólo enviado o visto, sin vencer ni aceptar, con los días cumplidos", () => {
    const base = { status: "ENVIADO" as const, validUntil: null, sentAt: new Date(AHORA.getTime() - 3 * DIA), aceptada: false, dias: 3, ahora: AHORA };
    expect(S.correspondeSeguimiento(base)).toBe(true);
    expect(S.correspondeSeguimiento({ ...base, status: "VISTO" })).toBe(true);
    expect(S.correspondeSeguimiento({ ...base, dias: 4 })).toBe(false);
    for (const status of ["ACEPTADO", "RECHAZADO", "VENCIDO", "BORRADOR"] as const) expect(S.correspondeSeguimiento({ ...base, status })).toBe(false);
    expect(S.correspondeSeguimiento({ ...base, validUntil: new Date("2026-10-06T00:00:00.000Z") })).toBe(false);
    expect(S.correspondeSeguimiento({ ...base, aceptada: true })).toBe(false);
    expect(S.correspondeSeguimiento({ ...base, sentAt: null })).toBe(false);
  });
});

describe("enviarSeguimientos", () => {
  it("manda el seguimiento con su plantilla, el enlace y el registro automático", async () => {
    const { leadId } = enviado(3);
    const d = deps();
    const r = await S.enviarSeguimientos(d);
    expect(r).toMatchObject({ organizaciones: 1, enviados: 1, fallidos: 0, topeCorrida: false });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    const correo = d.enviar.mock.calls[0]![0];
    expect(correo.to).toBe(EMAIL);
    expect(correo.subject).toContain("¿Pudiste ver el presupuesto");
    expect(correo.text).toContain("https://fotoffice.test/");
    expect(correo.text).toContain("31/12/2026");
    const plantilla = B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "PRESUPUESTO_SEGUIMIENTO")!;
    expect(plantilla).toMatchObject({ entityType: "PRESUPUESTO", channel: "EMAIL", enabled: true });
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ entityType: "CONSULTA", entityId: leadId, templateId: plantilla.id, automatic: true, status: "SENT", actorUserId: null });
    expect(H.real).not.toHaveBeenCalled();
  });

  it("una vez por versión: la segunda corrida no lo repite; una versión nueva vuelve a contar", async () => {
    const { versionId } = enviado(3);
    await S.enviarSeguimientos(deps());
    // Al día siguiente (y pasadas las 24 h): ya tiene su seguimiento.
    vi.setSystemTime(new Date(AHORA.getTime() + 2 * DIA));
    const d2 = deps();
    expect(await S.enviarSeguimientos(d2)).toMatchObject({ enviados: 0, salteados: 1 });
    expect(d2.enviar).not.toHaveBeenCalled();
    // Una versión nueva enviada después del seguimiento: se cuenta desde su envío.
    const v = B.datos.fotofficePresupuestoVersion.find((x) => x.id === versionId)!;
    v.sentAt = new Date(AHORA.getTime() + 60_000);
    vi.setSystemTime(new Date(AHORA.getTime() + 3 * DIA + 120_000));
    const d3 = deps();
    expect((await S.enviarSeguimientos(d3)).enviados).toBe(1);
  });

  it("no antes de los días, ni aceptado, rechazado, vencido o borrador", async () => {
    enviado(2);
    enviado(5, { status: "ACEPTADO", email: "a@x.test" });
    enviado(5, { status: "RECHAZADO", email: "b@x.test" });
    enviado(5, { status: "VENCIDO", email: "c@x.test" });
    enviado(5, { validUntil: new Date("2026-10-01T00:00:00.000Z"), email: "d@x.test" });
    enviado(5, { aceptada: true, email: "e@x.test" });
    const d = deps();
    expect((await S.enviarSeguimientos(d)).enviados).toBe(0);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("sólo organizaciones con el seguimiento encendido y el módulo Presupuestos encendido", async () => {
    enviado(5, { ws: "ws-2" });
    B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-2", followUpEnabled: false, followUpDays: 3 });
    const d = deps();
    expect((await S.enviarSeguimientos(d)).enviados).toBe(0);
    enviado(5);
    H.modulo.mockResolvedValue(false);
    expect(await S.enviarSeguimientos(d)).toMatchObject({ organizaciones: 1, enviados: 0 });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("con la plantilla del seguimiento apagada no manda", async () => {
    enviado(5);
    B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", systemKey: "PRESUPUESTO_SEGUIMIENTO", channel: "EMAIL", entityType: "PRESUPUESTO", name: "S", subject: "S", body: "B", enabled: false,
    });
    const d = deps();
    expect((await S.enviarSeguimientos(d)).enviados).toBe(0);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("una respuesta automática por dirección cada 24 h: si le tocó otra, mañana", async () => {
    enviado(5);
    B.agregar("fotofficeMessage", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "otra", toAddress: EMAIL.toUpperCase(), body: "b",
      status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60 * 60 * 1000),
    });
    const d = deps();
    expect(await S.enviarSeguimientos(d)).toMatchObject({ enviados: 0, salteados: 1 });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("respeta el tope diario de automáticos (no registra nada) y el tope por corrida", async () => {
    for (let i = 0; i < 3; i++) enviado(5, { email: `p${i}@x.test` });
    const d = deps({ tope: 2 });
    expect(await S.enviarSeguimientos(d)).toMatchObject({ enviados: 2, topeCorrida: true });
    expect(d.enviar).toHaveBeenCalledTimes(2);

    B.vaciar();
    B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-1", followUpEnabled: true, followUpDays: 3 });
    enviado(5);
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", {
        workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: `x${i}`, toAddress: `q${i}@x.test`, body: "b",
        status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
      });
    }
    const d2 = deps();
    expect(await S.enviarSeguimientos(d2)).toMatchObject({ enviados: 0, conTopeDiario: 1 });
    expect(d2.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(TOPE_AUTOMATICOS_DIA);
  });

  it("sin clave de enlaces no hace nada; una organización que explota no frena a las demás", async () => {
    enviado(5);
    expect((await S.enviarSeguimientos(deps({ clave: null }))).enviados).toBe(0);
    B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-0", followUpEnabled: true, followUpDays: 3 });
    H.modulo.mockImplementation(async (ws: string) => {
      if (ws === "ws-0") throw Object.assign(new Error("caída"), { code: "P1001" });
      return true;
    });
    const d = deps();
    expect(await S.enviarSeguimientos(d)).toMatchObject({ organizaciones: 2, enviados: 1 });
    expect(JSON.stringify(errores.mock.calls)).toContain("P1001");
  });

  it("si el proveedor falla queda registrado como fallido y no se reintenta", async () => {
    enviado(5);
    const d = deps({ enviar: vi.fn(async () => ({ status: "PROVIDER_REJECTED" as const, detail: "HTTP 422" })) });
    expect(await S.enviarSeguimientos(d)).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(mensajes()[0]).toMatchObject({ status: "FAILED", automatic: true });
    vi.setSystemTime(new Date(AHORA.getTime() + 2 * DIA));
    expect((await S.enviarSeguimientos(deps())).enviados).toBe(0);
  });
});

describe("historial", () => {
  it("el seguimiento aparece en el historial de presupuestos de la consulta", async () => {
    const { leadId } = enviado(3);
    await S.enviarSeguimientos(deps());
    const { eventosDePresupuestos } = await import("./historial");
    const ctx = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { quotes: "MANAGE" } } as never };
    const eventos = await eventosDePresupuestos(ctx, leadId);
    expect(eventos.map((e) => e.texto)).toContain("Se envió el seguimiento automático del presupuesto sin número (V1)");
  });
});

describe("la plantilla del seguimiento se edita como los otros automáticos", () => {
  it("acepta las variables de PRESUPUESTO (y [lista_precios]) y rechaza las de socio", async () => {
    const { guardarAutomatico } = await import("@/lib/plantillas/definiciones");
    const ctx = { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER" } as never;
    const ok = await guardarAutomatico(ctx, "PRESUPUESTO_SEGUIMIENTO", {
      enabled: true, subject: "Tu presupuesto [presupuesto_numero]", body: "Hola [nombre]: [presupuesto_enlace]\n\n[lista_precios]\n\n[firma]",
    });
    expect(ok).toEqual({ ok: true });
    expect(B.datos.fotofficeMessageTemplate[0]).toMatchObject({ systemKey: "PRESUPUESTO_SEGUIMIENTO", entityType: "PRESUPUESTO", channel: "EMAIL" });
    const mal = await guardarAutomatico(ctx, "PRESUPUESTO_SEGUIMIENTO", { enabled: true, subject: "S", body: "[socio_numero]" });
    expect(mal.ok).toBe(false);
  });
});
