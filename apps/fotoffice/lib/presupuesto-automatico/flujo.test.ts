import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const F = await import("./flujo");
type DepsFlujo = NonNullable<Parameters<typeof F.aprobarYEnviar>[3]>;

const WS = "ws-1";
const AHORA = new Date("2026-10-25T23:10:00.000Z");

function sembrar(lead: { email?: string | null; phone?: string | null } = {}) {
  B.vaciar();
  B.agregar("fotofficeConsultaCategoria", { id: "cat-15", workspaceId: WS, name: "15 años", group: "Social", order: 1, archivedAt: null });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-boda", workspaceId: WS, name: "Casamientos", group: "Social", order: 2, archivedAt: null });
  B.agregar("fotofficePresupuestoAutoCategoria", { workspaceId: WS, categoryId: "cat-15", telegramEnabled: true });
  B.agregar("serviceSalesLead", {
    id: "lead-1", workspaceId: WS, name: "Lucía Gómez", email: "email" in lead ? lead.email : "lucia@example.com",
    phone: "phone" in lead ? lead.phone : "+54 9 341 555-1234", message: "Para marzo", eventDate: null, eventLocation: null,
  });
  B.agregar("fotofficeConsulta", { id: "fc-1", workspaceId: WS, leadId: "lead-1", clientId: "cli-1", categoryId: "cat-15", eventStartsAt: new Date("2027-03-14T00:00:00.000Z"), venue: "Los Álamos", city: "Rosario", guests: 150 });
  B.agregar("fotofficeMessageTemplate", { id: "tpl-1", workspaceId: WS, channel: "EMAIL", entityType: "PRESUPUESTO", name: "Presupuesto", body: "x", systemKey: null, archivedAt: null });
}

/** El borrador que arma la propuesta modelo (fuera de esta prueba: ya tiene las suyas). */
const armar: DepsFlujo["armar"] = async (workspaceId, leadId) => {
  B.agregar("fotofficePresupuesto", { id: "pres-1", workspaceId, consultaLeadId: leadId, status: "BORRADOR", currentVersionId: "ver-1" });
  B.agregar("fotofficePresupuestoVersion", {
    id: "ver-1", workspaceId, presupuestoId: "pres-1", number: 1, sentAt: null, items: [],
    totals: { subtotal: 1_100_000, descuentos: 0, total: 1_100_000, renglones: {}, opcionales: { cantidad: 0, total: 0 } },
    costSnapshot: { porItem: {}, costoTotal: 620_000, itemsSinCosto: 0, margen: 480_000, margenProporcion: 0.4364 },
  });
  return { resultado: "ARMADO", presupuestoId: "pres-1" };
};

function deps(extra: Partial<DepsFlujo> = {}) {
  const avisos: string[] = [];
  const ediciones: string[] = [];
  const envios: { sinCorreo: boolean }[] = [];
  const whatsapps: string[] = [];
  const d: DepsFlujo = {
    ahora: () => AHORA,
    origenApp: "https://fotoffice.com",
    armar,
    avisar: async (_ws, html) => {
      avisos.push(html);
      return { ok: true, chatId: "999", messageId: "42" };
    },
    editar: async (_ws, _chat, _msg, html) => {
      ediciones.push(html);
    },
    enviarPresupuesto: async (_ws, presupuestoId, _tpl, _deps, op) => {
      envios.push({ sinCorreo: op?.sinCorreo === true });
      // Congela la versión, como el envío real.
      await B.tablas.fotofficePresupuestoVersion.updateMany({ where: { presupuestoId }, data: { sentAt: AHORA } });
      return { ok: true, repetido: false, versionId: "ver-1", numero: "P-1", enlace: "https://dnx.com.ar/p/tok", whatsappUrl: null };
    },
    estadoWhatsapp: async () => ({ conectado: false, ventanaAbierta: false }),
    enviarWhatsapp: async (_ws, _wa, texto) => {
      whatsapps.push(texto);
      return "ENVIADO";
    },
    ...extra,
  };
  return { d, avisos, ediciones, envios, whatsapps };
}

const fila = () => B.tablas.fotofficePresupuestoAprobacion.findFirst({ where: { workspaceId: WS, leadId: "lead-1" } }) as Promise<Record<string, unknown> | null>;

beforeEach(() => sembrar());

describe("alLlegarConsulta", () => {
  it("arma, guarda la aprobación y avisa por Telegram UNA sola vez por consulta", async () => {
    const { d, avisos } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("AVISADO");
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("YA_AVISADO");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("Lucía Gómez");
    expect(avisos[0]).toContain("14/03/2027");
    expect(avisos[0]).toMatch(/Precio: \$\s?1\.100\.000/);
    expect(await fila()).toMatchObject({ status: "AVISADO", presupuestoId: "pres-1", telegramChatId: "999", telegramMessageId: "42" });
  });

  it("con el interruptor apagado no hace nada", async () => {
    await B.tablas.fotofficeConsulta.updateMany({ where: { leadId: "lead-1" }, data: { categoryId: "cat-boda" } });
    const { d, avisos } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("APAGADO");
    expect(avisos).toHaveLength(0);
    expect(await fila()).toBeNull();
  });

  it("sin propuesta modelo avisa igual, lo dice y no se puede aprobar", async () => {
    const { d, avisos, envios } = deps({ armar: async () => ({ resultado: "SIN_PROPUESTA", presupuestoId: null }) });
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("SIN_PROPUESTA");
    expect(avisos[0]).toContain("no tiene propuesta modelo");
    const f = await fila();
    expect(f).toMatchObject({ status: "SIN_PROPUESTA" });
    expect(await F.aprobarYEnviar(WS, f!.id as string, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: false, codigo: "SIN_PRESUPUESTO" });
    expect(envios).toHaveLength(0);
  });

  it("presupuesto por horas encendido: una categoría sin interruptor ni propuesta también avisa", async () => {
    await B.tablas.fotofficeConsulta.updateMany({ where: { leadId: "lead-1" }, data: { categoryId: "cat-boda" } });
    B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true } });
    const { d, avisos } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("AVISADO");
    expect(avisos).toHaveLength(1);
  });

  it("presupuesto por horas: con propuesta modelo pero interruptor apagado sigue apagado", async () => {
    await B.tablas.fotofficeConsulta.updateMany({ where: { leadId: "lead-1" }, data: { categoryId: "cat-boda" } });
    B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true } });
    B.agregar("fotofficePropuestaModelo", { workspaceId: WS, categoryId: "cat-boda", items: [] });
    const { d } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("APAGADO");
  });

  it("presupuesto por horas: por WhatsApp, una categoría con propuesta y sin interruptor igual va a Telegram", async () => {
    await B.tablas.fotofficeConsulta.updateMany({ where: { leadId: "lead-1" }, data: { categoryId: "cat-boda" } });
    B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true } });
    B.agregar("fotofficePropuestaModelo", { workspaceId: WS, categoryId: "cat-boda", items: [] });
    const { d } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WHATSAPP", { waId: "5493410000000" }, d)).toBe("AVISADO");
  });

  it("una consulta sin horas no frena una nueva del mismo número (no cuenta como 'en preparación')", async () => {
    const { d } = deps({ armar: async () => ({ resultado: "SIN_HORAS", presupuestoId: null }) });
    await F.alLlegarConsulta(WS, "lead-1", "WHATSAPP", { waId: "5493410000000" }, d);
    expect(await F.enPreparacionParaWhatsapp(WS, "5493410000000")).toBe(false);
  });

  it("sin perfil de precios: lo dice con su propio motivo", async () => {
    const { d, avisos } = deps({ armar: async () => ({ resultado: "SIN_PERFIL", presupuestoId: null }) });
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    expect(avisos[0]).toContain("¿Cuánto cobro?");
    expect(avisos[0]).not.toContain("propuesta modelo");
  });

  it("presupuesto por horas: una categoría excluida queda apagada (web y WhatsApp)", async () => {
    await B.tablas.fotofficeConsulta.updateMany({ where: { leadId: "lead-1" }, data: { categoryId: "cat-boda" } });
    B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true, categoriasExcluidas: ["cat-boda"] } });
    const { d } = deps();
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("APAGADO");
    expect(await F.alLlegarConsulta(WS, "lead-1", "WHATSAPP", { waId: "5493410000000" }, d)).toBe("APAGADO");
  });

  it("sin horas: avisa que falta la cantidad de horas", async () => {
    const { d } = deps({ armar: async () => ({ resultado: "SIN_HORAS", presupuestoId: null }) });
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("SIN_PROPUESTA");
    expect(await fila()).toMatchObject({ status: "SIN_PROPUESTA", errorCode: "SIN_HORAS" });
    const datos = await F.datosDelResumen(WS, (await fila())!.id as string, d);
    expect(datos?.motivoSinPresupuesto).toBe("SIN_HORAS");
  });

  it("si Telegram falla queda AVISO_FALLIDO (se aprueba desde FOTOFFICE)", async () => {
    const { d } = deps({ avisar: async () => ({ ok: false, codigo: "SIN_CHAT" }) });
    expect(await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d)).toBe("AVISO_FALLIDO");
    expect(await fila()).toMatchObject({ status: "AVISO_FALLIDO", errorCode: "TELEGRAM_SIN_CHAT" });
  });
});

describe("aprobarYEnviar: nunca dos envíos del mismo presupuesto", () => {
  it("dos toques juntos: uno envía, el otro no; un tercero dice que ya se envió", async () => {
    const { d, envios, ediciones } = deps();
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    const id = (await fila())!.id as string;
    const [a, b] = await Promise.all([F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d), F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ codigo: expect.stringMatching(/EN_CURSO|YA_ENVIADO/) });
    expect(envios).toHaveLength(1);
    expect(await F.aprobarYEnviar(WS, id, { tipo: "PANEL", userId: 1 }, d)).toMatchObject({ ok: false, codigo: "YA_ENVIADO" });
    expect(envios).toHaveLength(1);
    expect(await fila()).toMatchObject({ status: "ENVIADO", approvedVia: "TELEGRAM", channels: { correo: "ENVIADO", whatsapp: "SIN_CONEXION" } });
    expect(ediciones.at(-1)).toContain("Aprobado.");
  });

  it("una aprobación de otro workspace no existe", async () => {
    const { d, envios } = deps();
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    const id = (await fila())!.id as string;
    expect(await F.aprobarYEnviar("ws-2", id, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: false, codigo: "NO_EXISTE" });
    expect(envios).toHaveLength(0);
  });

  it("con WhatsApp conectado y la ventana abierta sale también por WhatsApp, con el enlace", async () => {
    const { d, whatsapps } = deps({ estadoWhatsapp: async () => ({ conectado: true, ventanaAbierta: true }) });
    await F.alLlegarConsulta(WS, "lead-1", "WHATSAPP", { waId: "5493415551234" }, d);
    const id = (await fila())!.id as string;
    const r = await F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d);
    expect(r).toMatchObject({ ok: true, canales: { correo: "ENVIADO", whatsapp: "ENVIADO" } });
    expect(whatsapps).toHaveLength(1);
    expect(whatsapps[0]).toContain("https://dnx.com.ar/p/tok");
    expect(whatsapps[0]).toContain("¡Hola Lucía!");
  });

  it("sin correo: congela sin mandar correo y sale sólo por WhatsApp", async () => {
    sembrar({ email: null });
    const { d, envios } = deps({ estadoWhatsapp: async () => ({ conectado: true, ventanaAbierta: true }) });
    await F.alLlegarConsulta(WS, "lead-1", "WHATSAPP", { waId: "5493415551234" }, d);
    const r = await F.aprobarYEnviar(WS, (await fila())!.id as string, { tipo: "TELEGRAM" }, d);
    expect(r).toMatchObject({ ok: true, canales: { correo: "SIN_CORREO", whatsapp: "ENVIADO" } });
    expect(envios).toEqual([{ sinCorreo: true }]);
  });

  it("sin correo ni WhatsApp no manda nada y se puede volver a aprobar", async () => {
    sembrar({ email: null, phone: null });
    const { d, envios } = deps();
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    const id = (await fila())!.id as string;
    expect(await F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: false, codigo: "SIN_CANAL" });
    expect(envios).toHaveLength(0);
    expect(await fila()).toMatchObject({ status: "AVISADO", errorCode: "SIN_CANAL" });
  });

  it("si el envío no congeló nada, vuelve a AVISADO y el segundo intento envía una sola vez", async () => {
    let intentos = 0;
    const base = deps();
    const { d } = deps({
      enviarPresupuesto: async (...args) => {
        intentos += 1;
        if (intentos === 1) return { ok: false, error: "tope" };
        return base.d.enviarPresupuesto!(...args);
      },
    });
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    const id = (await fila())!.id as string;
    expect(await F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: false, codigo: "NO_SALIO" });
    expect(await fila()).toMatchObject({ status: "AVISADO" });
    expect(await F.aprobarYEnviar(WS, id, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: true });
    expect(intentos).toBe(2);
  });

  it("si ya lo mandaron a mano desde FOTOFFICE, no se manda de nuevo", async () => {
    const { d, envios } = deps();
    await F.alLlegarConsulta(WS, "lead-1", "WEB", {}, d);
    await B.tablas.fotofficePresupuestoVersion.updateMany({ where: { presupuestoId: "pres-1" }, data: { sentAt: AHORA } });
    expect(await F.aprobarYEnviar(WS, (await fila())!.id as string, { tipo: "TELEGRAM" }, d)).toMatchObject({ ok: false, codigo: "YA_ENVIADO" });
    expect(envios).toHaveLength(0);
    expect(await fila()).toMatchObject({ status: "ENVIADO", errorCode: "ENVIADO_A_MANO" });
  });
});

describe("resumenDeVersion", () => {
  it("sin renglones que sumen no inventa costo ni margen", () => {
    const r = F.resumenDeVersion({
      items: [],
      totals: { total: 500_000, renglones: {} },
      costSnapshot: { costoTotal: 300_000, itemsSinCosto: 0, margen: 200_000, margenProporcion: 0.4 },
    });
    expect(r).toMatchObject({ total: 500_000, costo: null, margen: null, horas: null });
  });
});
