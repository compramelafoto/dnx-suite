import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const A = await import("./avisos-de-correo");
const { seguimientoDe } = await import("@/lib/plantillas/vista-mensaje");

const AHORA = new Date("2026-11-19T12:00:00.000Z");
const evento = (field: "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt", at = AHORA) => ({
  field, emailId: "re_1", at, optOut: field === "bouncedAt" || field === "complainedAt",
});

const mensaje = (p: Record<string, unknown> = {}) =>
  B.agregar("fotofficeMessage", {
    id: "m1", workspaceId: "w1", channel: "EMAIL", entityType: "CONSULTA", entityId: "l1", toAddress: "x@y.com", body: "hola", status: "SENT", providerId: "re_1", ...p,
  });

beforeEach(() => {
  B.vaciar();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("avisos de Resend en los correos registrados", () => {
  it("anota la primera vez de cada aviso; los siguientes no mueven la fecha", async () => {
    mensaje();
    expect(await A.aplicarAvisoDeCorreo(evento("openedAt"))).toBe("APLICADO");
    expect(await A.aplicarAvisoDeCorreo(evento("openedAt", new Date("2026-11-20T00:00:00.000Z")))).toBe("REPETIDO");
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ openedAt: AHORA, clickedAt: null });
  });

  it("un correo que no es de FOTOFFICE se deja pasar", async () => {
    expect(await A.aplicarAvisoDeCorreo(evento("deliveredAt"))).toBe("DESCONOCIDO");
  });

  it("si rebota el de una consulta, el responsable recibe la tarea (una sola)", async () => {
    mensaje();
    B.agregar("workspaceMembership", { workspaceId: "w1", userId: 7, role: "STAFF" });
    B.agregar("fotofficeJourney", { id: "j1", workspaceId: "w1", circuitId: "c", kind: "VENTA", subjectType: "CAPTACION", subjectId: "l1", stageId: "s", outcome: null, ownerUserId: 7 });
    expect(await A.aplicarAvisoDeCorreo(evento("bouncedAt"))).toBe("APLICADO");
    const tareas = B.datos.fotofficeTask.filter((t: { title: string }) => t.title === A.TITULO_TAREA_REBOTE);
    expect(tareas).toHaveLength(1);
    expect(tareas[0]).toMatchObject({ subjectId: "l1", assigneeUserId: 7 });
  });
});

describe("cómo se ve", () => {
  const base = { channel: "EMAIL", deliveredAt: null, openedAt: null, clickedAt: null, bouncedAt: null, complainedAt: null };
  it("entregado, abierto y clic en hora argentina; los problemas primero", () => {
    expect(seguimientoDe({ ...base, deliveredAt: new Date("2026-11-16T00:39:00.000Z"), openedAt: new Date("2026-11-16T00:40:00.000Z"), clickedAt: new Date("2026-11-16T00:41:00.000Z") }).map((s) => s.texto)).toEqual([
      "Entregado 15/11 21:39", "Abierto 15/11 21:40", "Hizo clic 15/11 21:41",
    ]);
    expect(seguimientoDe({ ...base, deliveredAt: AHORA, bouncedAt: AHORA })).toEqual([{ texto: "Rebotó 19/11 09:00: la dirección no recibe correos", tipo: "problema" }]);
    expect(seguimientoDe({ ...base, channel: "WHATSAPP", openedAt: AHORA })).toEqual([]);
    expect(seguimientoDe(base)).toEqual([]);
  });
});
