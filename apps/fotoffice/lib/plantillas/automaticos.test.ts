import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendOutcome } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Nunca sale un correo real: el transporte está reemplazado y cada prueba mira qué le llegó.
const H = vi.hoisted(() => ({
  enviar: vi.fn(async (_m: unknown): Promise<unknown> => ({ status: "SENT", providerId: "re_auto_1" })),
  notificar: vi.fn(async () => ({ movido: true })),
  modulo: vi.fn(async (_ws: string, _m: string) => true),
}));

vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA-HTML</table>", text: "FIRMA-TEXTO" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));

const A = await import("./automaticos");
const { createServiceLead } = await import("@/app/actions/service-lead");

const AHORA = new Date("2026-10-01T15:00:00.000Z");
const EMAIL = "laura@persona.test";
const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: EMAIL, eventType: "BODA" };

function autorespuesta(datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", systemKey: "CONSULTA_AUTORESPUESTA", channel: "EMAIL", entityType: "CONSULTA",
    name: "Respuesta automática a una consulta nueva", enabled: true,
    subject: "Recibimos tu consulta [consulta_numero]", body: "Hola [nombre], tu consulta es la [consulta_numero].\n\n[firma]",
    ...datos,
  }).id as string;
}

function consulta(datos: Record<string, unknown> = {}) {
  return B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Laura Pérez", email: EMAIL, eventType: "BODA", ...datos });
}

const mensajes = () => B.datos.fotofficeMessage;
const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_auto_1" });
  H.notificar.mockClear();
  H.modulo.mockReset();
  H.modulo.mockResolvedValue(true);
  // La base en memoria no tiene findUnique: el alta busca el branding por su slug público.
  (B.tablas.fotofficeWorkspaceBranding as unknown as Record<string, unknown>).findUnique = (a: never) => B.tablas.fotofficeWorkspaceBranding.findFirst(a);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  // Nunca se loguea un dato de la persona.
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("responderConsultaNueva", () => {
  it("apagada: no envía ni registra", async () => {
    autorespuesta({ enabled: false });
    consulta();
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("APAGADA");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("sin plantilla automática (workspace sin sembrar): no hace nada", async () => {
    consulta();
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("APAGADA");
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("la automática de otro workspace no cuenta", async () => {
    autorespuesta({ workspaceId: "ws-2" });
    consulta();
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("APAGADA");
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("encendida: envía a la persona y registra como automático, sin usuario", async () => {
    const id = autorespuesta({ body: "Hola [nombre], recibimos tu consulta.\n\n[firma]", subject: "Recibimos tu consulta" });
    consulta();
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ENVIADO");
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo()).toMatchObject({ to: EMAIL, subject: "Recibimos tu consulta", fromName: "Estudio DNX", replyTo: "hola@estudio.test" });
    expect(correo().text).toContain("Hola Laura, recibimos tu consulta.");
    expect(correo().html).toContain("FIRMA-HTML");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "l1", templateId: id, toAddress: EMAIL,
      status: "SENT", automatic: true, providerId: "re_auto_1", actorUserId: null, actorLabel: "Automático",
    });
  });

  it("consulta sin correo (o con uno inválido): nada", async () => {
    autorespuesta();
    consulta({ email: null });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("SIN_CORREO");
    B.vaciar();
    autorespuesta();
    consulta({ email: "no-es-un-correo" });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("SIN_CORREO");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("consulta de otro workspace o inexistente: nada", async () => {
    autorespuesta();
    consulta({ workspaceId: "ws-2" });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("NO_ENCONTRADA");
    expect(await A.responderConsultaNueva("ws-1", "nada")).toBe("NO_ENCONTRADA");
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("con Captación apagada: no envía ni registra, aunque esté encendida", async () => {
    autorespuesta();
    consulta();
    H.modulo.mockResolvedValue(false);
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("APAGADA");
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "service-leads");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  /** `n` correos ya enviados hoy en ws-1, a otras direcciones. */
  function enviadosHoy(n: number, datos: Record<string, unknown> = {}) {
    for (let i = 0; i < n; i++) {
      B.agregar("fotofficeMessage", {
        workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "otra", toAddress: `otra${i}@x.test`, body: "x",
        status: "SENT", createdAt: new Date("2026-10-01T10:00:00.000Z"), ...datos,
      });
    }
  }

  it("tope de automáticos (50 por día): al llegar no envía ni registra", async () => {
    autorespuesta();
    consulta();
    enviadosHoy(50, { automatic: true });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("NO_ENVIADO");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(50);
  });

  it("con 49 automáticos hoy todavía responde", async () => {
    autorespuesta();
    consulta();
    enviadosHoy(49, { automatic: true });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ENVIADO");
  });

  it("los 200 manuales del día no frenan a los automáticos", async () => {
    autorespuesta();
    consulta();
    enviadosHoy(200);
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ENVIADO");
    expect(mensajes()).toHaveLength(201);
  });

  it("una sola respuesta por dirección cada 24 h (sin importar mayúsculas)", async () => {
    autorespuesta();
    consulta();
    B.agregar("fotofficeMessage", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "l0", toAddress: EMAIL.toUpperCase(), body: "x",
      status: "FAILED", automatic: true, createdAt: new Date("2026-09-30T15:30:00.000Z"),
    });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("YA_RESPONDIDO");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(1);
  });

  it("pasadas 24 h, o si el previo fue manual o de otra organización, responde", async () => {
    autorespuesta();
    consulta();
    const previo = { channel: "EMAIL", entityType: "CONSULTA", entityId: "l0", toAddress: EMAIL, body: "x", status: "SENT" };
    B.agregar("fotofficeMessage", { ...previo, workspaceId: "ws-1", automatic: true, createdAt: new Date("2026-09-30T14:59:00.000Z") });
    B.agregar("fotofficeMessage", { ...previo, workspaceId: "ws-1", automatic: false, createdAt: new Date("2026-10-01T14:00:00.000Z") });
    B.agregar("fotofficeMessage", { ...previo, workspaceId: "ws-2", automatic: true, createdAt: new Date("2026-10-01T14:00:00.000Z") });
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ENVIADO");
    expect(H.enviar).toHaveBeenCalledTimes(1);
  });

  it("si el proveedor falla: no lanza y queda registrado como fallido", async () => {
    autorespuesta();
    consulta();
    H.enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422 · validation_error" } satisfies SendOutcome);
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("NO_ENVIADO");
    expect(mensajes()[0]).toMatchObject({ status: "FAILED", automatic: true, errorCode: "PROVIDER_REJECTED:422:validation_error" });
  });

  it("si el transporte o la base explotan: no lanza", async () => {
    autorespuesta();
    consulta();
    H.enviar.mockRejectedValue(Object.assign(new Error(`caído ${EMAIL}`), { code: "ECONNRESET" }));
    expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ERROR");
    const original = B.tablas.fotofficeMessageTemplate.findFirst;
    B.tablas.fotofficeMessageTemplate.findFirst = (async () => {
      throw Object.assign(new Error("base caída"), { code: "P1001" });
    }) as never;
    try {
      expect(await A.responderConsultaNueva("ws-1", "l1")).toBe("ERROR");
    } finally {
      B.tablas.fotofficeMessageTemplate.findFirst = original;
    }
    expect(JSON.stringify(errores.mock.calls)).toContain("P1001");
  });
});

describe("alta por el formulario público", () => {
  it("encendida: la consulta nueva recibe el correo con su número ya asignado", async () => {
    autorespuesta();
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta 2026-0001");
    expect(correo().text).toContain("tu consulta es la 2026-0001.");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ automatic: true, status: "SENT", actorLabel: "Automático" });
    expect(H.notificar).toHaveBeenCalled();
  });

  it("dos consultas seguidas desde la misma dirección: una sola respuesta", async () => {
    autorespuesta();
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(await createServiceLead({ ...ENTRADA, email: EMAIL.toUpperCase() })).toEqual({ success: true });
    expect(B.datos.serviceSalesLead).toHaveLength(2);
    expect(H.enviar).toHaveBeenCalledTimes(1);
  });

  it("apagada: crea la consulta y no manda nada", async () => {
    autorespuesta({ enabled: false });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(B.datos.serviceSalesLead).toHaveLength(1);
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("si el correo falla, la consulta queda creada igual", async () => {
    autorespuesta();
    H.enviar.mockRejectedValue(new Error("Resend caído"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(B.datos.serviceSalesLead).toHaveLength(1);
    expect(H.notificar).toHaveBeenCalled();
  });

  it("un budgetType de 500 caracteres no frena la consulta: se recorta", async () => {
    autorespuesta({ enabled: false });
    expect(await createServiceLead({ ...ENTRADA, meta: { budgetType: "x".repeat(500) } })).toEqual({ success: true });
    expect(B.datos.fotofficeConsulta).toHaveLength(1);
    expect(B.datos.serviceSalesLead[0]!.eventSubtype).toBe("x".repeat(200));
  });

  it("sin correo: crea la consulta y no manda nada", async () => {
    autorespuesta();
    expect(await createServiceLead({ ...ENTRADA, email: "" })).toEqual({ success: true });
    expect(B.datos.serviceSalesLead).toHaveLength(1);
    expect(H.enviar).not.toHaveBeenCalled();
  });
});

describe("sólo el formulario público responde", () => {
  /** Todos los .ts/.tsx de app, lib y components (sin pruebas) que mencionan la autorespuesta. */
  /** Los .ts/.tsx de app, lib y components (sin pruebas) cuyo texto cumple `patron`. */
  function quienesContienen(patron: RegExp): string[] {
    const raiz = path.resolve(__dirname, "../..");
    const hallados: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
          if (nombre !== "node_modules" && !nombre.startsWith(".")) recorrer(ruta);
        } else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
          if (patron.test(readFileSync(ruta, "utf8"))) hallados.push(path.relative(raiz, ruta));
        }
      }
    };
    for (const d of ["app", "lib", "components"]) recorrer(path.join(raiz, d));
    return hallados.sort();
  }

  function quienesLlaman(): string[] {
    const raiz = path.resolve(__dirname, "../..");
    const hallados: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
          if (nombre !== "node_modules" && !nombre.startsWith(".")) recorrer(ruta);
        } else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
          if (readFileSync(ruta, "utf8").includes("responderConsultaNueva")) hallados.push(path.relative(raiz, ruta));
        }
      }
    };
    for (const d of ["app", "lib", "components"]) recorrer(path.join(raiz, d));
    return hallados.sort();
  }

  it("la llama sólo el alta única, y sólo el formulario público le pide el origen WEB", () => {
    // Etapa 1: el formulario pasa por `altaDeConsulta(..., "WEB")`, que es la única que la llama
    // (y sólo con ese origen: lo prueban lib/consultas/alta.test.ts).
    expect(quienesLlaman()).toEqual(["lib/consultas/alta.ts", "lib/plantillas/automaticos.ts"]);
    const alta = readFileSync(path.resolve(__dirname, "../consultas/alta.ts"), "utf8");
    // Entrega B: dentro de la rama WEB, primero la propuesta modelo y la común sólo si corresponde.
    expect(alta).toMatch(
      /if \(origenDelAlta === "WEB"\) \{\s*await despuesDeResponder\(async \(\) => \{\s*let comun = true;[\s\S]*?enviarPropuestaModelo\([\s\S]*?if \(comun\) \{\s*try \{\s*await responderConsultaNueva\(/,
    );
    const formulario = readFileSync(path.resolve(__dirname, "../../app/actions/service-lead.ts"), "utf8");
    expect(formulario).toContain('{ origenDelAlta: "WEB" }');
    // Y nadie más pide el origen WEB: ni las altas manuales ni la importación.
    expect(quienesContienen(/origenDelAlta\s*:\s*["'`]WEB["'`]|["'`]WEB["'`]\s+as\s+const/)).toEqual(["app/actions/service-lead.ts"]);
    const presencial = readFileSync(path.resolve(__dirname, "../presential-courses/enrollment-workflow.ts"), "utf8");
    expect(presencial).not.toContain("plantillas/automaticos");
  });
});
