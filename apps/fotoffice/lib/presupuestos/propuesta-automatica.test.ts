import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

/**
 * La consulta web recibe su propuesta modelo sola (Entrega B, Task 2). De punta a punta por el
 * formulario público (`createServiceLead` → `altaDeConsulta` WEB), con la base en memoria, el
 * envío de presupuestos y los automáticos reales. Nunca sale un correo real: el transporte está
 * reemplazado y cada prueba mira qué le llegó.
 */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  enviar: vi.fn(async (_m: unknown): Promise<unknown> => ({ status: "SENT", providerId: "re_1" })),
  notificar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ movido: true })),
  modulo: vi.fn(async (_ws: string, _m: string) => true),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
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
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));
vi.mock("./sitio", () => ({
  sitioDelWorkspace: async (ws: string) =>
    ws === "ws-1"
      ? { workspaceId: "ws-1", slug: "dnx-estudio", customDomain: null, nombre: "Estudio DNX", logoUrl: null, whatsapp: null, email: "hola@estudio.test" }
      : null,
  workspaceDelSlug: async (s: string) => (s === "dnx-estudio" ? "ws-1" : null),
}));

const PA = await import("./propuesta-automatica");
const { armarVistaPublica } = await import("./vista-publica");
const { createServiceLead } = await import("@/app/actions/service-lead");
const { asegurarCatalogosDelWorkspace } = await import("@/lib/consultas/semillas");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const EMAIL = "laura@persona.test";
const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: EMAIL, eventType: "BODA" };

let categoriaBoda = "";
let plantillaPresupuesto = "";

function autorespuesta(datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", systemKey: "CONSULTA_AUTORESPUESTA", channel: "EMAIL", entityType: "CONSULTA",
    name: "Respuesta automática", enabled: true, subject: "Recibimos tu consulta", body: "Hola [nombre], ya te respondemos.\n\n[firma]",
    ...datos,
  }).id as string;
}

function propuesta(datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficePropuestaModelo", {
    workspaceId: "ws-1", categoryId: categoriaBoda, autoSendOnWeb: true, templateId: plantillaPresupuesto, terms: "Seña del 30 %.",
    items: [
      { id: "r1", productId: "prod-cob", nombre: "Viejo nombre", descripcion: null, cantidad: 1, precioUnitario: 1, descuento: null, modoPrecio: "LISTA", calculo: null, seccion: "Cobertura", opcional: false },
      { id: "r2", productId: "prod-alb", nombre: "Álbum", descripcion: null, cantidad: 2, precioUnitario: 1, descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false },
    ],
    ...datos,
  });
}

const mensajes = () => B.datos.fotofficeMessage;
const presupuestos = () => B.datos.fotofficePresupuesto;
const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  H.notificar.mockClear();
  H.modulo.mockReset();
  H.modulo.mockResolvedValue(true);
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  vi.stubEnv("PRESUPUESTO_TOKEN_SECRET", "clave-de-prueba");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.test");
  (B.tablas.fotofficeWorkspaceBranding as unknown as Record<string, unknown>).findUnique = (a: never) => B.tablas.fotofficeWorkspaceBranding.findFirst(a);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER", createdAt: new Date("2025-01-01") });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 5, role: "STAFF", createdAt: new Date("2025-02-01") });
  B.agregar("product", { id: "prod-cob", workspaceId: "ws-1", name: "Cobertura completa", description: "8 horas", priceArs: "600000.00" });
  B.agregar("product", { id: "prod-alb", workspaceId: "ws-1", name: "Álbum 30x30", priceArs: "150000.50" });
  plantillaPresupuesto = B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", channel: "EMAIL", entityType: "PRESUPUESTO", name: "Te enviamos tu presupuesto",
    subject: "Tu presupuesto N° [presupuesto_numero]", body: "Hola [nombre]: [presupuesto_enlace] Total [presupuesto_total].\n\n[firma]",
  }).id as string;
  await asegurarCatalogosDelWorkspace("ws-1");
  categoriaBoda = B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-1" && c.legacyEventType === "BODA")!.id as string;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  // Nunca se loguea un dato de la persona.
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("encendida contra apagada", () => {
  it("encendida: crea el presupuesto como el sistema, a precio de lista de hoy, y lo envía en lugar de la común", async () => {
    autorespuesta();
    propuesta();
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "ws-1", defaultOwnerUserId: 5 });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });

    // Un solo correo: el del presupuesto (no salen las dos).
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().to).toBe(EMAIL);
    expect(correo().subject).toMatch(/^Tu presupuesto N° /);
    expect(correo().text).toContain("https://");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({
      automatic: true, status: "SENT", templateId: plantillaPresupuesto, entityType: "CONSULTA", actorUserId: null, actorLabel: "Automático",
    });

    expect(presupuestos()).toHaveLength(1);
    const p = presupuestos()[0]!;
    expect(p).toMatchObject({ status: "ENVIADO", ownerUserId: 5, consultaLeadId: B.datos.serviceSalesLead[0]!.id });
    const v = B.datos.fotofficePresupuestoVersion.find((x) => x.id === p.currentVersionId)!;
    expect(v.createdByUserId).toBeNull();
    expect(v.sentAt).toBeInstanceOf(Date);
    expect(v.terms).toBe("Seña del 30 %.");
    const items = v.items as { nombre: string; descripcion: string | null; precioUnitario: number; modoPrecio: string; cantidad: number }[];
    expect(items.map((i) => [i.nombre, i.descripcion, i.precioUnitario, i.cantidad, i.modoPrecio])).toEqual([
      ["Cobertura completa", "8 horas", 600000, 1, "LISTA"],
      ["Álbum 30x30", null, 150000.5, 2, "LISTA"],
    ]);
    expect((v.totals as { total: number }).total).toBe(900001);
  });

  it("sin responsable en los ajustes de Consultas, el dueño", async () => {
    autorespuesta();
    propuesta();
    await createServiceLead(ENTRADA);
    expect(presupuestos()[0]!.ownerUserId).toBe(1);
  });

  it("apagada en la categoría: sale la común y no se crea ningún presupuesto", async () => {
    autorespuesta();
    propuesta({ autoSendOnWeb: false });
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
  });

  it("sin propuesta para la categoría o con Presupuestos apagado: la común", async () => {
    autorespuesta();
    await createServiceLead(ENTRADA);
    expect(correo().subject).toBe("Recibimos tu consulta");
    propuesta();
    H.modulo.mockImplementation(async (_ws: string, m: string) => m !== "quotes");
    await createServiceLead({ ...ENTRADA, email: "otra@persona.test" });
    expect(H.enviar).toHaveBeenCalledTimes(2);
    expect(correo(1).subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
  });

  it("con la respuesta automática apagada no sale nada, ni la propuesta", async () => {
    autorespuesta({ enabled: false });
    propuesta();
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(presupuestos()).toHaveLength(0);
    expect(B.datos.serviceSalesLead).toHaveLength(1);
  });
});

describe("conceptos calculados en la propuesta", () => {
  const conceptoCalculado = {
    id: "r3", productId: null, nombre: "Cobertura boda", descripcion: null, cantidad: 1, precioUnitario: 0, descuento: null,
    modoPrecio: "CALCULO", seccion: "Fotos", opcional: false,
    calculo: { entrada: { presupuesto: { client: { jobType: "Boda" }, concepts: [{ name: "Cobertura", itemType: "own-service", quantity: "1", coverageHours: "6", editingHours: "4" }] } } },
  };
  const conCalculo = () => propuesta({ items: [conceptoCalculado] });

  it("con perfil: sale ENVIADA, el ítem queda CALCULO con el precio del motor y la vista pública no ve el cálculo", async () => {
    autorespuesta();
    B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
    conCalculo();
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toMatch(/^Tu presupuesto N° /);
    const p = presupuestos()[0]!;
    expect(p.status).toBe("ENVIADO");
    const v = B.datos.fotofficePresupuestoVersion.find((x) => x.id === p.currentVersionId)!;
    const items = v.items as { modoPrecio: string; precioUnitario: number; calculo: unknown; id: string }[];
    expect(items).toHaveLength(1);
    expect(items[0]!.modoPrecio).toBe("CALCULO");
    expect(items[0]!.precioUnitario).toBeGreaterThan(0);
    expect(items[0]!.calculo).not.toBeNull();
    expect(items[0]!.id).not.toBe("r3");

    const vista = armarVistaPublica({
      estado: "ACTIVO",
      organizacion: { nombre: "Estudio DNX", logoUrl: null, whatsappUrl: null, email: null },
      numero: null,
      version: { number: 1, items: v.items as never, totals: v.totals as never, terms: v.terms as never, paymentProposal: null, acceptedAt: null, acceptedName: null },
      validUntil: null,
    });
    const json = JSON.stringify(vista);
    for (const prohibido of ["calculo", "entrada", "perfil"]) expect(json).not.toContain(prohibido);
    expect(vista.items[0]!.precioUnitario).toBe(items[0]!.precioUnitario);
  });

  it("sin perfil: FALLO, no se crea presupuesto y va la común", async () => {
    autorespuesta();
    conCalculo();
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
    expect(JSON.stringify(avisos.mock.calls)).toContain("SIN_PERFIL");
  });
});

describe("topes", () => {
  it("con el tope de automáticos alcanzado no crea el presupuesto ni manda nada", async () => {
    autorespuesta();
    propuesta();
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", {
        workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: `x${i}`, toAddress: `p${i}@x.test`,
        body: "b", status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
      });
    }
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(presupuestos()).toHaveLength(0);
    expect(JSON.stringify(avisos.mock.calls)).toContain("TOPE_AUTOMATICOS");
  });

  it("una vez por dirección cada 24 h: la segunda consulta no recibe nada (ni otro presupuesto)", async () => {
    autorespuesta();
    propuesta();
    await createServiceLead(ENTRADA);
    await createServiceLead({ ...ENTRADA, email: EMAIL.toUpperCase() });
    expect(B.datos.serviceSalesLead).toHaveLength(2);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(presupuestos()).toHaveLength(1);
    // Una autorespuesta común previa también cuenta para la propuesta.
    vi.setSystemTime(new Date(AHORA.getTime() + 25 * 60 * 60 * 1000));
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(2);
    expect(presupuestos()).toHaveLength(2);
  });
});

describe("las fallas caen a la autorespuesta común, sin duplicar", () => {
  it("plantilla archivada: la común, sin presupuesto", async () => {
    autorespuesta();
    propuesta();
    B.datos.fotofficeMessageTemplate.find((t) => t.id === plantillaPresupuesto)!.archivedAt = new Date();
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
  });

  it("un producto que salió del catálogo: no se manda a medias, va la común", async () => {
    autorespuesta();
    propuesta();
    B.datos.product.find((p) => p.id === "prod-alb")!.isActive = false;
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
    expect(JSON.stringify(avisos.mock.calls)).toContain("PRODUCTO_FUERA_DEL_CATALOGO");
  });

  it("sin clave de enlaces (no se pudo congelar): borra el borrador que creó y va la común", async () => {
    vi.stubEnv("PRESUPUESTO_TOKEN_SECRET", "");
    vi.stubEnv("STORE_ORDER_TOKEN_SECRET", "");
    vi.stubEnv("FOTOFFICE_CRON_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    autorespuesta();
    propuesta();
    await createServiceLead(ENTRADA);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(presupuestos()).toHaveLength(0);
    expect(B.datos.fotofficePresupuestoVersion).toHaveLength(0);
  });

  it("si el proveedor rechaza la propuesta, no se insiste con la común (una por dirección) y el responsable tiene una tarea", async () => {
    autorespuesta();
    propuesta();
    H.enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ status: "FAILED", templateId: plantillaPresupuesto, automatic: true });
    // El presupuesto quedó enviado: se puede reenviar desde la ficha, y hay una tarea para revisarlo.
    expect(presupuestos()[0]!.status).toBe("ENVIADO");
    const tareas = B.datos.fotofficeTask.filter((t) => String(t.title).startsWith("Revisar envío del presupuesto"));
    expect(tareas).toHaveLength(1);
    expect(tareas[0]).toMatchObject({ assigneeUserId: 1, subjectType: "CAPTACION" });
  });

  it("si la base explota en el medio, no frena el alta y va la común", async () => {
    autorespuesta();
    propuesta();
    const original = B.tablas.fotofficePresupuesto.create;
    B.tablas.fotofficePresupuesto.create = async () => {
      throw Object.assign(new Error("caída con Laura"), { code: "P1001" });
    };
    try {
      expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    } finally {
      B.tablas.fotofficePresupuesto.create = original;
    }
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(correo().subject).toBe("Recibimos tu consulta");
    expect(JSON.stringify(errores.mock.calls)).toContain("P1001");
  });
});

describe("enviarPropuestaModelo (directo)", () => {
  it("sin ficha, sin propuesta o sin correo, no crea nada", async () => {
    autorespuesta();
    expect(await PA.enviarPropuestaModelo("ws-1", "no-existe")).toBe("NO_APLICA");
    propuesta();
    B.agregar("serviceSalesLead", { id: "l-sin", workspaceId: "ws-1", name: "X", email: "", eventType: "BODA" });
    B.agregar("client", { id: "c-sin", workspaceId: "ws-1", kind: "PERSONA", firstName: "X" });
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l-sin", clientId: "c-sin", categoryId: categoriaBoda });
    expect(await PA.enviarPropuestaModelo("ws-1", "l-sin")).toBe("SIN_CORREO");
    expect(presupuestos()).toHaveLength(0);
  });

  it("correspondeAutorespuestaComun: sólo sin propuesta enviada y con motivo para responder", () => {
    expect(PA.correspondeAutorespuestaComun("ENVIADA")).toBe(false);
    expect(PA.correspondeAutorespuestaComun("APAGADA")).toBe(false);
    expect(PA.correspondeAutorespuestaComun("YA_RESPONDIDO")).toBe(false);
    for (const r of ["NO_APLICA", "SIN_CORREO", "TOPE", "FALLO", "ERROR"] as const) expect(PA.correspondeAutorespuestaComun(r)).toBe(true);
  });
});

describe("revisión: carreras y fallas después de enviar", () => {
  it("toma el candado por organización y dirección (en minúsculas) antes de crear el presupuesto", async () => {
    autorespuesta();
    propuesta();
    await createServiceLead({ ...ENTRADA, email: "Laura@Persona.TEST" });
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && q.valores.includes(`fotoffice-respuesta-web:ws-1:${EMAIL}`))).toBe(true);
    // La reserva quedó completa (ninguna EN_CURSO) y es la única respuesta.
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ status: "SENT", errorCode: null });
  });

  it("dos envíos simultáneos con la misma dirección: el segundo ve la respuesta del primero dentro del candado", async () => {
    autorespuesta();
    propuesta();
    // Mientras éste espera el candado, el otro envío ya reservó su respuesta a la misma dirección.
    B.ganchos.alEjecutarSql = (texto, valores) => {
      if (!texto.includes("pg_advisory_xact_lock") || !String(valores[0]).startsWith("fotoffice-respuesta-web:")) return;
      B.agregar("fotofficeMessage", {
        workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "otra", toAddress: EMAIL, body: "",
        status: "FAILED", automatic: true, errorCode: "EN_CURSO",
      });
    };
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(presupuestos()).toHaveLength(0);
    // Ni la propuesta ni la común.
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("si algo falla después de congelar el presupuesto, no va la común (el correo pudo haber salido)", async () => {
    autorespuesta();
    propuesta();
    H.notificar.mockImplementation(async (...a: unknown[]) => {
      if (a[2] === "PRESUPUESTO_ENVIADO") throw Object.assign(new Error("motor caído"), { code: "P2024" });
      return { movido: true };
    });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(presupuestos()[0]!.status).toBe("ENVIADO");
    // Ni el correo de la propuesta (cortó antes) ni la común.
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeTask.filter((t) => String(t.title).startsWith("Revisar envío del presupuesto"))).toHaveLength(1);
    // Directo: el resultado es ERROR_TRAS_ENVIO (con otra dirección, para que la regla de 24 h no lo tape).
    B.datos.serviceSalesLead.at(-1)!.email = "otra@persona.test";
    expect(await PA.enviarPropuestaModelo("ws-1", B.datos.serviceSalesLead.at(-1)!.id as string)).toBe("ERROR_TRAS_ENVIO");
    expect(PA.correspondeAutorespuestaComun("ERROR_TRAS_ENVIO")).toBe(false);
  });
});

