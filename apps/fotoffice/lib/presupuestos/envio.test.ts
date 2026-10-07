import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { OutboundEmail, SendOutcome } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  real: vi.fn(),
  notificar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ movido: true })),
  reabrir: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ reabierta: false })),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA-HTML</table>", text: "FIRMA-TEXTO" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: "+54 341 555-1111", website: null, instagram: null, city: null },
  }),
}));
// Red de seguridad: si algo llamara al transporte real, la prueba lo detecta (y no sale nada).
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.real }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar, reabrirComoGanadaPorSistema: H.reabrir }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));
vi.mock("./sitio", () => ({
  sitioDelWorkspace: async (ws: string) =>
    ws === "ws-1"
      ? { workspaceId: "ws-1", slug: "dnx", customDomain: null, nombre: "Estudio DNX", logoUrl: "https://cdn.test/logo.png", whatsapp: "+54 341 555-1111", email: "hola@estudio.test" }
      : ws === "ws-2"
        ? { workspaceId: "ws-2", slug: "otro", customDomain: "otro.com.ar", nombre: "Otro", logoUrl: null, whatsapp: null, email: null }
        : null,
  workspaceDelSlug: async (s: string) => (s === "dnx" ? "ws-1" : s === "otro" ? "ws-2" : null),
}));

const P = await import("./presupuestos");
const V = await import("./versiones");
const EN = await import("./envio");
const L = await import("./enlace");
const PU = await import("./publico");
const AC = await import("./aceptacion");
const HI = await import("./historial");
const VP = await import("./vista-publica");
const PL = await import("./plantillas");
const AV = await import("./avisos");
const { pesos } = await import("./editor");
const { MENSAJES_PRESUPUESTO: M } = await import("./acceso");
const { MENSAJES_ENVIO } = await import("@/lib/plantillas/envio");
const { clavesPermitidas } = await import("@/lib/plantillas/variables");
const { analizar } = await import("@/lib/plantillas/motor");

const AHORA = new Date("2026-10-07T15:00:00.000Z"); // 12:00 en Buenos Aires
const MINUTO = 60_000;
const CLAVE = "clave-de-prueba";
const ORIGEN = "https://fotoffice.test";
const EMAIL_PERSONA = "laura@persona.test";

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
// Sabi: arma y envía presupuestos, sin Consultas ni costos.
const SABI = { workspaceId: "ws-1", userId: 2, userLabel: "Sabi", role: "STAFF", acceptedAt: null, acceso: { role: "STAFF", levels: { quotes: "MANAGE" } } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "VIEW" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };

const deps = { ahora: () => AHORA, tieneGestionar: H.nivel };

function enviador(r: SendOutcome = { status: "SENT", providerId: "re_1" }) {
  return vi.fn(async (_m: OutboundEmail) => r);
}
function depsEnvio(extra: Record<string, unknown> = {}) {
  return { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA, enviar: enviador(), ...extra };
}
const depsPublico = (ahora = AHORA) => ({ clave: CLAVE, appOrigin: ORIGEN, ahora: () => ahora });

function consulta(leadId: string, ws = "ws-1", datos: Record<string, unknown> = {}) {
  B.agregar("serviceSalesLead", {
    id: leadId, workspaceId: ws, name: "Laura Pérez", email: EMAIL_PERSONA, phone: "+54 341 555-0000", eventType: "BODA",
    eventDate: new Date("2026-12-12T00:00:00.000Z"), eventLocation: "Rosario", message: null, ...datos,
  });
  B.agregar("client", { id: `cli-${leadId}`, workspaceId: ws, kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsulta", { workspaceId: ws, leadId, clientId: `cli-${leadId}`, categoryId: "cat" });
}

const itemLista = (id: string, datos: Record<string, unknown> = {}) => ({
  id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});

async function armado(ctx = DUENO, leadId = "lead-1", items: unknown[] = [itemLista("a")]) {
  const r = await P.crearPresupuesto(ctx, { consultaLeadId: leadId }, deps);
  if (!r.ok) throw new Error(r.error);
  const g = await P.guardarBorrador(ctx, r.presupuestoId, { items }, deps);
  if (!g.ok) throw new Error(g.error);
  return r;
}

function plantilla(datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", channel: "EMAIL", entityType: "PRESUPUESTO", name: "Presupuesto",
    subject: "Presupuesto N° [presupuesto_numero]", body: "Hola [nombre]: [presupuesto_enlace] Total [presupuesto_total], vence [presupuesto_vence].\n\n[firma]",
    ...datos,
  }).id as string;
}

const presupuesto = (id: string) => B.datos.fotofficePresupuesto.find((p) => p.id === id)!;
const version = (id: string) => B.datos.fotofficePresupuestoVersion.find((v) => v.id === id)!;
const tareas = (titulo: string) => B.datos.fotofficeTask.filter((t) => t.title === titulo);
const token = (versionId: string) => L.tokenDeVersion(versionId, CLAVE);
/** La vista de una apertura (null si es 404 o una redirección). */
const vistaDe = (r: Awaited<ReturnType<typeof PU.abrirPresupuestoPublico>>) => (r && "vista" in r ? r.vista : null);

async function enviado(ctx = DUENO, leadId = "lead-1", items?: unknown[]) {
  const r = await armado(ctx, leadId, items);
  const id = plantilla();
  const e = await EN.enviarPresupuesto(ctx, r.presupuestoId, { canal: "EMAIL", templateId: id }, depsEnvio());
  if (!e.ok) throw new Error(e.error);
  return { ...r, envio: e, templateId: id };
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.real.mockReset();
  H.notificar.mockClear();
  H.reabrir.mockClear();
  H.nivel.mockResolvedValue(true);
  consulta("lead-1");
  consulta("lead-9", "ws-2");
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER", createdAt: new Date("2025-01-01") });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 2, role: "STAFF", createdAt: new Date("2025-02-01") });
  B.agregar("user", { id: 1, email: "dueno@estudio.test", name: "Dueño" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(H.real).not.toHaveBeenCalled();
  // Los registros nunca llevan datos personales.
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|laura@/);
  errores.mockRestore();
});

// --- El enlace (puro) ------------------------------------------------------------------------------

describe("enlace y token", () => {
  it("un token por versión: 32 bytes en base64url, distinto por versión y por clave; se guarda el hash SHA-256", () => {
    const t = L.tokenDeVersion("v1", CLAVE);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(L.tokenDeVersion("v1", CLAVE)).toBe(t);
    expect(L.tokenDeVersion("v2", CLAVE)).not.toBe(t);
    expect(L.tokenDeVersion("v1", "otra")).not.toBe(t);
    expect(L.hashDeToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(L.tokenConForma(t)).toBe(true);
    for (const malo of ["", "corto", `${t}x`, "a".repeat(42) + "!", null, 5]) expect(L.tokenConForma(malo)).toBe(false);
  });

  it("vence 30 días después del último día de validez (al terminar ese día)", () => {
    expect(L.vencimientoDelToken(new Date("2026-10-22T00:00:00.000Z"))).toEqual(new Date("2026-11-22T00:00:00.000Z"));
  });

  it("la dirección: dominio propio o /w/<slug>", () => {
    expect(L.urlDelPresupuesto({ customDomain: "dnx.com.ar", appOrigin: ORIGEN, slug: "dnx", token: "T" })).toBe("https://dnx.com.ar/presupuesto/T");
    expect(L.urlDelPresupuesto({ customDomain: null, appOrigin: ORIGEN, slug: "dnx", token: "T" })).toBe(`${ORIGEN}/w/dnx/presupuesto/T`);
    expect(L.urlDelPresupuesto({ customDomain: null, appOrigin: "", slug: "dnx", token: "T" })).toBeNull();
  });

  it("la clave: en producción nunca la del cron; la IP sin sal no se guarda", () => {
    expect(L.resolverClaveDeEnlace({ VERCEL_ENV: "production", CRON_SECRET: "c" })).toBeNull();
    expect(L.resolverClaveDeEnlace({ VERCEL_ENV: "production", STORE_ORDER_TOKEN_SECRET: "s" })).toBe("s");
    expect(L.resolverClaveDeEnlace({ VERCEL_ENV: "production", PRESUPUESTO_TOKEN_SECRET: " p ", STORE_ORDER_TOKEN_SECRET: "s" })).toBe("p");
    expect(L.resolverClaveDeEnlace({ CRON_SECRET: "c" })).toBe("c");
    // Un build de producción (también un preview) nunca usa el del cron.
    expect(L.resolverClaveDeEnlace({ NODE_ENV: "production", VERCEL_ENV: "preview", CRON_SECRET: "c" })).toBeNull();
    expect(L.resolverClaveDeEnlace({ NODE_ENV: "development", CRON_SECRET: "c" })).toBe("c");
    expect(L.hashDeIp("1.2.3.4", "")).toBeNull();
    expect(L.hashDeIp(null, "sal")).toBeNull();
    expect(L.hashDeIp("1.2.3.4", "sal")).toMatch(/^[0-9a-f]{64}$/);
    expect(L.hashDeIp("1.2.3.4", "sal")).not.toContain("1.2.3.4");
  });

  it("conEnlace agrega el enlace antes de la firma si el texto no lo trae", () => {
    expect(EN.conEnlace("Hola.\n\n[firma]", "https://x/p")).toBe("Hola.\n\nPodés ver el presupuesto acá: https://x/p\n\n[firma]");
    expect(EN.conEnlace("Hola", "https://x/p")).toBe("Hola\n\nPodés ver el presupuesto acá: https://x/p");
    expect(EN.conEnlace("Mirá https://x/p", "https://x/p")).toBe("Mirá https://x/p");
  });
});

// --- Plantillas ------------------------------------------------------------------------------------

describe("plantillas del presupuesto", () => {
  it("las iniciales sólo usan variables válidas para PRESUPUESTO y llevan el enlace", () => {
    const permitidas = clavesPermitidas("PRESUPUESTO", []);
    for (const k of ["presupuesto_numero", "presupuesto_enlace", "presupuesto_total", "presupuesto_vence", "consulta_fecha", "nombre", "firma"]) {
      expect(permitidas.has(k)).toBe(true);
    }
    expect(clavesPermitidas("CONSULTA", []).has("presupuesto_enlace")).toBe(false);
    for (const p of PL.PLANTILLAS_PRESUPUESTO) {
      expect(p.tipo).toBe("PRESUPUESTO");
      expect(p.cuerpo).toContain("[presupuesto_enlace]");
      expect(analizar(p.cuerpo, permitidas).ok).toBe(true);
      if (p.asunto) expect(analizar(p.asunto, permitidas).ok).toBe(true);
    }
  });

  it("se siembran una sola vez", async () => {
    await PL.asegurarPlantillasPresupuesto("ws-1");
    await PL.asegurarPlantillasPresupuesto("ws-1");
    const delWs = B.datos.fotofficeMessageTemplate.filter((t) => t.workspaceId === "ws-1" && t.entityType === "PRESUPUESTO");
    expect(delWs.map((t) => [t.channel, t.name])).toEqual([["EMAIL", "Te enviamos tu presupuesto"], ["WHATSAPP", "Tu presupuesto"]]);
    // Con el candado por organización antes de contar.
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && q.valores.includes("fotoffice-plantillas-presupuesto:ws-1"))).toBe(true);
  });
});

// --- Enviar ----------------------------------------------------------------------------------------

describe("enviar", () => {
  it("por correo: congela, numera, guarda el hash del token, pasa a ENVIADO con validez renovada, manda y avisa al motor", async () => {
    const { presupuestoId, versionId } = await armado();
    const templateId = plantilla();
    const d = depsEnvio();
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, d);
    const t = token(versionId);
    const enlace = `${ORIGEN}/w/dnx/presupuesto/${t}`;
    expect(r).toEqual({ ok: true, repetido: false, versionId, numero: expect.any(String), enlace, whatsappUrl: null });
    if (!r.ok) return;

    expect(version(versionId)).toMatchObject({
      sentAt: AHORA, tokenHash: L.hashDeToken(t), tokenExpiresAt: new Date("2026-11-22T00:00:00.000Z"), revokedAt: null,
    });
    expect(presupuesto(presupuestoId)).toMatchObject({ status: "ENVIADO", currentVersionId: versionId, validUntil: new Date("2026-10-22T00:00:00.000Z") });
    expect(B.datos.fotofficeRecordNumber.filter((n) => n.entityType === "PRESUPUESTO")).toHaveLength(1);

    expect(d.enviar).toHaveBeenCalledTimes(1);
    const correo = d.enviar.mock.calls[0]![0];
    expect(correo.to).toBe(EMAIL_PERSONA);
    expect(correo.subject).toBe(`Presupuesto N° ${r.numero}`);
    expect(correo.text).toContain(enlace);
    expect(correo.text).toContain(`Total ${pesos(1000)}, vence 22/10/2026.`);
    expect(correo.text).not.toContain("[presupuesto_");
    // El token en claro no queda guardado en ningún lado salvo en el mensaje que se mandó.
    expect(JSON.stringify(B.datos.fotofficePresupuestoVersion)).not.toContain(t);

    expect(B.datos.fotofficeMessage).toEqual([
      expect.objectContaining({ channel: "EMAIL", entityType: "CONSULTA", entityId: "lead-1", templateId, status: "SENT", actorUserId: 1 }),
    ]);
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "PRESUPUESTO_ENVIADO", versionId);
  });

  it("Sabi (sólo Presupuestos, sin Consultas) también envía", async () => {
    const { presupuestoId } = await armado(SABI);
    const r = await EN.enviarPresupuesto(SABI, presupuestoId, { canal: "EMAIL", templateId: plantilla() }, depsEnvio());
    expect(r.ok).toBe(true);
  });

  it("doble clic: el segundo no manda nada ni vuelve a avisar al motor", async () => {
    const { presupuestoId } = await armado();
    const templateId = plantilla();
    const d = depsEnvio();
    const [a, b] = [
      await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, d),
      await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, d),
    ];
    expect(a).toMatchObject({ ok: true, repetido: false });
    expect(b).toMatchObject({ ok: true, repetido: true });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(H.notificar).toHaveBeenCalledTimes(1);
    // Más tarde, "Enviar" sin borrador pide usar Reenviar.
    const tarde = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio({ ahora: () => new Date(AHORA.getTime() + MINUTO) }));
    expect(tarde).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.yaEnviado });
  });

  it("reenviar: mismo enlace, sin tocar estado ni validez; dos reenvíos seguidos mandan uno", async () => {
    const { presupuestoId, versionId, templateId, envio } = await enviado();
    const antes = { ...presupuesto(presupuestoId) };
    const luego = () => new Date(AHORA.getTime() + 5 * MINUTO);
    const d = depsEnvio({ ahora: luego });
    const r1 = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId, reenviar: true }, d);
    const r2 = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId, reenviar: true }, d);
    expect(r1).toMatchObject({ ok: true, repetido: false, versionId, enlace: envio.ok ? envio.enlace : null, numero: envio.ok ? envio.numero : null });
    expect(r2).toMatchObject({ ok: true, repetido: true });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(presupuesto(presupuestoId)).toMatchObject({ status: antes.status, validUntil: antes.validUntil, currentVersionId: versionId });
    expect(H.notificar).toHaveBeenCalledTimes(1);
  });

  it("la V2: token nuevo, la V1 revocada, el número se mantiene, ENVIADO → ENVIADO", async () => {
    const { presupuestoId, versionId: v1, templateId, envio } = await enviado();
    const nueva = await V.crearNuevaVersion(DUENO, presupuestoId);
    if (!nueva.ok) throw new Error(nueva.error);
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("a", { precioUnitario: 2000 })] }, deps);
    const despues = new Date(AHORA.getTime() + 2 * 24 * 60 * MINUTO);
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio({ ahora: () => despues }));
    expect(r).toMatchObject({ ok: true, versionId: nueva.versionId, numero: envio.ok ? envio.numero : "x", enlace: `${ORIGEN}/w/dnx/presupuesto/${token(nueva.versionId)}` });
    expect(version(v1).revokedAt).toEqual(despues);
    expect(presupuesto(presupuestoId)).toMatchObject({ status: "ENVIADO", currentVersionId: nueva.versionId, validUntil: new Date("2026-10-24T00:00:00.000Z") });
    expect(H.notificar).toHaveBeenLastCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "PRESUPUESTO_ENVIADO", nueva.versionId);

    // El enlace viejo NO muestra sus ítems ni precios: redirige a la vigente.
    const viejo = await PU.abrirPresupuestoPublico("ws-1", token(v1), { registrar: true, ipHash: null, userAgent: null }, depsPublico(despues));
    expect(viejo).toEqual({ redirigir: `${ORIGEN}/w/dnx/presupuesto/${token(nueva.versionId)}` });
    expect(JSON.stringify(viejo)).not.toContain("Ítem");
    // La vista para imprimir de la versión vieja: 404.
    expect(await PU.abrirPresupuestoPublico("ws-1", token(v1), { registrar: false, ipHash: null, userAgent: null, permitirReemplazo: false }, depsPublico(despues))).toBeNull();
    // Y si la vigente tampoco sirve (sin enviar), 404.
    presupuesto(presupuestoId).currentVersionId = null;
    expect(await PU.abrirPresupuestoPublico("ws-1", token(v1), { registrar: true, ipHash: null, userAgent: null }, depsPublico(despues))).toBeNull();
    presupuesto(presupuestoId).currentVersionId = nueva.versionId;
    // …y no se puede aceptar.
    expect(await AC.aceptarPresupuesto("ws-1", token(v1), { nombre: "Laura", acepta: true }, { ipHash: null, userAgent: null }, { ahora: () => despues }))
      .toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.reemplazado });
  });

  it("lo que puede fallar sin depender del envío se revisa ANTES de congelar", async () => {
    const { presupuestoId, versionId } = await armado();
    const templateId = plantilla();
    const sinEnviar = () => expect(version(versionId).sentAt).toBeNull();
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio({ clave: null }))).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.sinClave });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio({ appOrigin: "" }))).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.sinSitio });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "FAX" }, depsEnvio())).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.canal });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL" }, depsEnvio())).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.sinTexto });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId: "ajena" }, depsEnvio())).toEqual({ ok: false, error: MENSAJES_ENVIO.plantillaNoEncontrada });
    const conMarcador = plantilla({ body: "Hola [COMPLETÁ ACÁ LA PROPUESTA] [presupuesto_enlace]" });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId: conMarcador }, depsEnvio())).toEqual({ ok: false, error: MENSAJES_ENVIO.marcadorSinCompletar });
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", cuerpo: "Hola [socio_numero]", asunto: "A" }, depsEnvio())).toEqual({ ok: false, error: MENSAJES_ENVIO.plantillaConErrores });
    B.datos.serviceSalesLead.find((l) => l.id === "lead-1")!.email = null;
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio())).toEqual({ ok: false, error: MENSAJES_ENVIO.sinCorreo });
    sinEnviar();
    expect(presupuesto(presupuestoId).status).toBe("BORRADOR");
    expect(H.notificar).not.toHaveBeenCalled();
  });

  it("sin ítems no se envía (y no queda nada a medias)", async () => {
    const { presupuestoId, versionId } = await armado(DUENO, "lead-1", []);
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId: plantilla() }, depsEnvio());
    expect(r).toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.sinItems });
    expect(version(versionId)).toMatchObject({ sentAt: null, tokenHash: null });
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
  });

  it("permisos y aislamiento: sin Gestionar no; de otro workspace, no existe", async () => {
    const { presupuestoId } = await armado();
    const templateId = plantilla();
    expect(await EN.enviarPresupuesto(LECTOR, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio())).toEqual({ ok: false, error: M.sinPermiso });
    expect(await EN.enviarPresupuesto(OTRO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio())).toEqual({ ok: false, error: M.noExiste });
  });

  it("por WhatsApp: devuelve el enlace wa.me con el texto y lo registra", async () => {
    const { presupuestoId, versionId } = await armado();
    const wa = plantilla({ channel: "WHATSAPP", subject: null, body: "Hola [nombre], tu presupuesto: [presupuesto_enlace]" });
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "WHATSAPP", templateId: wa }, depsEnvio());
    expect(r).toMatchObject({ ok: true, whatsappUrl: expect.stringMatching(/^https:\/\/wa\.me\/5493415550000\?text=/) });
    if (!r.ok) return;
    expect(decodeURIComponent(r.whatsappUrl!.split("text=")[1]!)).toContain(`Hola Laura, tu presupuesto: ${ORIGEN}/w/dnx/presupuesto/${token(versionId)}`);
    expect(B.datos.fotofficeMessage).toEqual([expect.objectContaining({ channel: "WHATSAPP", status: "OPENED_WHATSAPP", entityType: "CONSULTA", templateId: wa })]);
  });

  it("si el proveedor falla después de congelar: queda enviado, lo dice, y se puede reenviar", async () => {
    const { presupuestoId } = await armado();
    const templateId = plantilla();
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId }, depsEnvio({ enviar: enviador({ status: "PROVIDER_REJECTED", detail: "HTTP 422" }) }));
    expect(r).toMatchObject({ ok: false, enviado: true, error: expect.stringContaining("quedó enviado") });
    expect(presupuesto(presupuestoId).status).toBe("ENVIADO");
    const otra = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId, reenviar: true }, depsEnvio({ ahora: () => new Date(AHORA.getTime() + MINUTO) }));
    expect(otra).toMatchObject({ ok: true, repetido: false });
  });

  it("vencido: no se reenvía (necesita una versión nueva)", async () => {
    const { presupuestoId, templateId } = await enviado();
    const lejos = () => new Date("2026-11-01T15:00:00.000Z");
    expect(await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId, reenviar: true }, depsEnvio({ ahora: lejos })))
      .toEqual({ ok: false, error: EN.MENSAJES_ENVIO_PRESUPUESTO.noReenviable });
  });

  it("opciones de la pantalla: siembra las plantillas, dice adónde puede ir y da el enlace sólo de una versión enviada", async () => {
    const { presupuestoId } = await armado();
    const antes = await EN.opcionesDeEnvio(DUENO, presupuestoId, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA });
    expect(antes).toMatchObject({ destino: { correo: true, whatsapp: true }, enlace: null, hayBorrador: true, puedeReenviar: false, bloqueo: null });
    expect(antes!.plantillas.map((p) => p.nombre)).toEqual(["Te enviamos tu presupuesto", "Tu presupuesto"]);
    const r = await EN.enviarPresupuesto(DUENO, presupuestoId, { canal: "EMAIL", templateId: antes!.plantillas[0]!.id }, depsEnvio());
    expect(r.ok).toBe(true);
    const despues = await EN.opcionesDeEnvio(DUENO, presupuestoId, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA });
    expect(despues).toMatchObject({ enlace: r.ok ? r.enlace : "x", hayBorrador: false, puedeReenviar: true });
    expect(await EN.opcionesDeEnvio(LECTOR, presupuestoId)).toBeNull();
    expect(await EN.opcionesDeEnvio(DUENO, presupuestoId, { clave: null })).toMatchObject({ bloqueo: EN.MENSAJES_ENVIO_PRESUPUESTO.sinClave, enlace: null });
  });
});

// --- Página pública --------------------------------------------------------------------------------

function entradaMotor() {
  return { perfil: createBaseCompleteProfile(), presupuesto: createBaseCompleteQuote({ chosenPrice: "" }) };
}

describe("enlace público", () => {
  it("nunca hay costos, márgenes, cálculo ni perfil en lo que recibe la página", async () => {
    B.agregar("product", { id: "prod-1", workspaceId: "ws-1", name: "Álbum", priceArs: "50000", costArs: "31234" });
    B.agregar("fotofficeCostoPlantilla", { workspaceId: "ws-1", productId: "prod-1", concept: "Imprenta", amountArs: "27777", perUnit: false });
    const { envio, versionId } = await enviado(DUENO, "lead-1", [
      itemLista("a", { productId: "prod-1", nombre: "Álbum", precioUnitario: 50000 }),
      itemLista("b", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } }),
      itemLista("c", { opcional: true, nombre: "Video", seccion: "Extras" }),
    ]);
    expect(envio.ok).toBe(true);
    // La versión SÍ tiene costos guardados (para el dueño)…
    expect(JSON.stringify(version(versionId).costSnapshot)).toContain("27777");
    const r = await PU.abrirPresupuestoPublico("ws-1", token(versionId), { registrar: false, ipHash: null, userAgent: null }, depsPublico());
    expect(r).not.toBeNull();
    const json = JSON.stringify(r);
    // …pero a la página no le llega nada de eso.
    for (const prohibido of ["costo", "Costo", "margen", "Margen", "calculo", "entrada", "perfil", "costSnapshot", "productId", "prod-1", "modoPrecio", "27777", "31234", "precioMinimo", "valorHora"]) {
      expect(json).not.toContain(prohibido);
    }
    expect(vistaDe(r)).toMatchObject({
      estado: "ACTIVO", version: 1, vence: "22/10/2026",
      organizacion: { nombre: "Estudio DNX", logoUrl: "https://cdn.test/logo.png", whatsappUrl: expect.stringMatching(/^https:\/\/wa\.me\/5493415551111/) },
    });
    expect(vistaDe(r)!.items.map((i) => [i.nombre, i.opcional, i.seccion])).toEqual([["Álbum", false, null], ["Ítem b", false, null], ["Video", true, "Extras"]]);
    expect(Object.keys(vistaDe(r)!.items[0]!).sort()).toEqual(["cantidad", "descripcion", "descuento", "id", "neto", "nombre", "opcional", "precioUnitario", "seccion"]);
  });

  it("la fuente: la página y sus componentes no leen ni muestran costos", () => {
    const raiz = join(__dirname, "..", "..");
    const leer = (r: string) => readFileSync(join(raiz, r), "utf8");
    const publico = leer("lib/presupuestos/publico.ts");
    expect(publico).not.toMatch(/costSnapshot:\s*true/);
    expect(publico).not.toMatch(/SELECT_VERSION\b/);
    const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const r of [
      "app/w/[workspaceSlug]/presupuesto/[token]/page.tsx",
      "app/w/[workspaceSlug]/presupuesto/[token]/imprimir/page.tsx",
      "components/presupuestos/presupuesto-publico.tsx",
      "components/presupuestos/acciones-publicas.tsx",
    ]) {
      const crudo = leer(r);
      // La vista del presupuesto se arma en el servidor: no es un componente del navegador.
      if (r.endsWith("presupuesto-publico.tsx") || r.endsWith("page.tsx")) expect(crudo).not.toMatch(/^\s*["']use client["']/m);
      const src = sinComentarios(crudo);
      expect(src).not.toMatch(/costSnapshot|veCostos|costo|margen|calculo|leerPresupuesto|versionParaVista/i);
    }
  });

  it("token inválido, de otro workspace, revocado sin vigente o vencido (validez + 30 días): 404", async () => {
    const { versionId, presupuestoId } = await enviado();
    const t = token(versionId);
    const abrir = (ws: string, tok: unknown, ahora = AHORA) => PU.abrirPresupuestoPublico(ws, tok, { registrar: true, ipHash: null, userAgent: null }, depsPublico(ahora));
    expect(await abrir("ws-1", "x")).toBeNull();
    expect(await abrir("ws-1", L.tokenDeVersion(versionId, "otra-clave"))).toBeNull();
    expect(await abrir("ws-2", t)).toBeNull();
    expect(await abrir("ws-1", t, new Date("2026-11-22T00:00:00.001Z"))).toBeNull();
    // Vencida la validez pero dentro del margen: se ve, como vencido.
    expect(vistaDe(await abrir("ws-1", t, new Date("2026-11-01T15:00:00.000Z")))?.estado).toBe("VENCIDO");
    // Revocado y sin vigente que sirva: 404.
    version(versionId).revokedAt = AHORA;
    presupuesto(presupuestoId).currentVersionId = null;
    expect(await abrir("ws-1", t)).toBeNull();
    expect(B.datos.fotofficePresupuestoVista).toHaveLength(1); // sólo la del vencido
  });

  it("los robots de vista previa no cuentan como visita", () => {
    expect(VP.esRobot("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(VP.esRobot("facebookexternalhit/1.1")).toBe(true);
    expect(VP.esRobot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(VP.esRobot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
    expect(VP.esRobot(null)).toBe(false);
  });
});

describe("vistas", () => {
  const visita = { registrar: true, ipHash: "hash-ip", userAgent: "Mozilla/5.0 (iPhone)" };

  it("cada apertura queda registrada; la primera pasa a VISTO y crea UNA tarea para el responsable", async () => {
    const { presupuestoId, versionId } = await enviado();
    const t = token(versionId);
    await PU.abrirPresupuestoPublico("ws-1", t, visita, depsPublico());
    expect(presupuesto(presupuestoId).status).toBe("VISTO");
    expect(tareas(AV.TITULO_TAREA_VISTO)).toEqual([expect.objectContaining({ subjectType: "CAPTACION", subjectId: "lead-1", assigneeUserId: 1, workspaceId: "ws-1" })]);
    await PU.abrirPresupuestoPublico("ws-1", t, visita, depsPublico(new Date(AHORA.getTime() + MINUTO)));
    await PU.abrirPresupuestoPublico("ws-1", t, visita, depsPublico(new Date(AHORA.getTime() + 2 * MINUTO)));
    expect(B.datos.fotofficePresupuestoVista).toHaveLength(3);
    expect(B.datos.fotofficePresupuestoVista[0]).toMatchObject({ workspaceId: "ws-1", versionId, ipHash: "hash-ip", userAgent: "Mozilla/5.0 (iPhone)" });
    expect(presupuesto(presupuestoId).status).toBe("VISTO");
    expect(tareas(AV.TITULO_TAREA_VISTO)).toHaveLength(1);
  });

  it("VISTO sólo si la versión vista sigue siendo la vigente", async () => {
    const { presupuestoId, versionId } = await enviado();
    const enlace = await PU.buscarEnlace("ws-1", token(versionId), AHORA);
    expect(enlace?.estado).toBe("ACTIVO");
    // Mientras tanto se envió otra versión: la vista de la vieja no la marca como vista.
    presupuesto(presupuestoId).currentVersionId = "otra-version";
    const { registrarVista } = await import("./vistas");
    expect(await registrarVista(enlace!, { ipHash: null, userAgent: null }, AHORA)).toEqual({ registrada: true, primera: false });
    expect(presupuesto(presupuestoId).status).toBe("ENVIADO");
    expect(tareas(AV.TITULO_TAREA_VISTO)).toHaveLength(0);
  });

  it("la vista para imprimir y los robots no se registran ni marcan visto", async () => {
    const { presupuestoId, versionId } = await enviado();
    const t = token(versionId);
    await PU.abrirPresupuestoPublico("ws-1", t, { ...visita, registrar: false }, depsPublico());
    await PU.abrirPresupuestoPublico("ws-1", t, { ...visita, userAgent: "WhatsApp/2.23" }, depsPublico());
    expect(B.datos.fotofficePresupuestoVista).toHaveLength(0);
    expect(presupuesto(presupuestoId).status).toBe("ENVIADO");
  });

  it("sin responsable en el equipo, la tarea va al dueño", async () => {
    const { presupuestoId, versionId } = await enviado(SABI);
    B.datos.workspaceMembership = B.datos.workspaceMembership.filter((m) => m.userId !== 2);
    expect(presupuesto(presupuestoId).ownerUserId).toBe(2);
    await PU.abrirPresupuestoPublico("ws-1", token(versionId), visita, depsPublico());
    expect(tareas(AV.TITULO_TAREA_VISTO)[0]).toMatchObject({ assigneeUserId: 1 });
  });

  it("historial de la consulta: envío, primera vista (con cuántas) y aceptación; sin IP ni navegador", async () => {
    const { presupuestoId, versionId, envio } = await enviado();
    const t = token(versionId);
    await PU.abrirPresupuestoPublico("ws-1", t, visita, depsPublico(new Date(AHORA.getTime() + MINUTO)));
    await PU.abrirPresupuestoPublico("ws-1", t, visita, depsPublico(new Date(AHORA.getTime() + 2 * MINUTO)));
    await AC.aceptarPresupuesto("ws-1", t, { nombre: "Laura Pérez", acepta: true }, { ipHash: "h", userAgent: "ua" }, { ahora: () => new Date(AHORA.getTime() + 3 * MINUTO), enviar: enviador() });
    const ev = await HI.eventosDePresupuestos(DUENO, "lead-1");
    const n = envio.ok ? envio.numero : "";
    expect(ev.map((e) => e.texto)).toEqual([
      `El cliente aceptó el presupuesto N° ${n} (V1) (Laura Pérez)`,
      `El cliente abrió el presupuesto N° ${n} (V1) (lo abrió 2 veces)`,
      `Se envió el presupuesto N° ${n} (V1)`,
    ]);
    expect(ev[0]!.href).toBe(`/presupuestos/${presupuestoId}`);
    expect(JSON.stringify(ev)).not.toMatch(/hash-ip|iPhone/);
    expect(await HI.eventosDePresupuestos(OTRO, "lead-1")).toEqual([]);
  });
});

// --- Aceptar ---------------------------------------------------------------------------------------

describe("aceptar", () => {
  const evidencia = { ipHash: "hash-ip", userAgent: "Mozilla/5.0" };

  it("guarda la evidencia, pasa a ACEPTADO con pedido por confirmar, avisa al motor, reabre si estaba perdida y avisa al responsable", async () => {
    const { presupuestoId, versionId, envio } = await enviado();
    const avisos = enviador();
    const cuando = new Date(AHORA.getTime() + 10 * MINUTO);
    const r = await AC.aceptarPresupuesto("ws-1", token(versionId), { nombre: "  Laura   Pérez ", acepta: true }, evidencia, { ahora: () => cuando, enviar: avisos, appOrigin: ORIGEN });
    expect(r).toEqual({ ok: true, fecha: cuando });
    expect(version(versionId)).toMatchObject({ acceptedAt: cuando, acceptedName: "Laura Pérez", acceptedIpHash: "hash-ip", acceptedUserAgent: "Mozilla/5.0" });
    expect(presupuesto(presupuestoId)).toMatchObject({ status: "ACEPTADO", acceptedVersionId: versionId, pedidoPorConfirmar: true });
    expect(H.notificar).toHaveBeenLastCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "PRESUPUESTO_ACEPTADO", versionId);
    expect(H.reabrir).toHaveBeenCalledWith("ws-1", "lead-1", expect.stringContaining("Se reabrió como ganada"));
    expect(tareas(AV.TITULO_TAREA_ACEPTADO)).toEqual([expect.objectContaining({ subjectId: "lead-1", assigneeUserId: 1 })]);
    expect(avisos).toHaveBeenCalledTimes(1);
    const correo = avisos.mock.calls[0]![0];
    expect(correo.to).toBe("dueno@estudio.test");
    expect(correo.subject).toBe(`Aceptaron el presupuesto N° ${envio.ok ? envio.numero : ""}`);
    expect(correo.text).toContain(`${ORIGEN}/presupuestos/${presupuestoId}`);

    // La página ahora lo muestra aceptado, con quién y cuándo.
    const vista = await PU.abrirPresupuestoPublico("ws-1", token(versionId), { registrar: false, ipHash: null, userAgent: null }, depsPublico(cuando));
    expect(vistaDe(vista)).toMatchObject({ estado: "ACEPTADO", aceptacion: { nombre: "Laura Pérez", fecha: "07/10/2026 12:10" } });
  });

  it("una sola vez: la segunda ve «Ya fue aceptado» y no avisa de nuevo", async () => {
    const { versionId } = await enviado();
    const t = token(versionId);
    expect((await AC.aceptarPresupuesto("ws-1", t, { nombre: "Laura", acepta: true }, evidencia, { ahora: () => AHORA, enviar: enviador() })).ok).toBe(true);
    const llamadas = H.notificar.mock.calls.length;
    expect(await AC.aceptarPresupuesto("ws-1", t, { nombre: "Otra", acepta: true }, evidencia, { ahora: () => AHORA, enviar: enviador() }))
      .toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.yaAceptado });
    expect(version(versionId).acceptedName).toBe("Laura");
    expect(H.notificar.mock.calls.length).toBe(llamadas);
    expect(tareas(AV.TITULO_TAREA_ACEPTADO)).toHaveLength(1);
  });

  it("carrera: si otra aceptación escribe entre la lectura y la escritura, la escritura condicional no pisa", async () => {
    const { presupuestoId, versionId } = await enviado();
    const original = B.tablas.fotofficePresupuestoVersion.updateMany;
    const condiciones: unknown[] = [];
    B.tablas.fotofficePresupuestoVersion.updateMany = async (a: Parameters<typeof original>[0]) => {
      condiciones.push(a.where);
      // La otra pestaña acepta justo antes (en la base real, su transacción ya confirmó).
      const v = version(versionId);
      if (v.acceptedAt === null) Object.assign(v, { acceptedAt: AHORA, acceptedName: "La otra pestaña" });
      return original(a);
    };
    try {
      const r = await AC.aceptarPresupuesto("ws-1", token(versionId), { nombre: "Laura", acepta: true }, evidencia, { ahora: () => AHORA, enviar: enviador() });
      expect(r).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.yaAceptado });
    } finally {
      B.tablas.fotofficePresupuestoVersion.updateMany = original;
    }
    expect(condiciones).toEqual([expect.objectContaining({ id: versionId, workspaceId: "ws-1", acceptedAt: null, revokedAt: null })]);
    // Esta aceptación no escribió su nombre (la memoria deshace la transacción entera; la de la otra
    // pestaña, en la base real, queda).
    expect(version(versionId).acceptedName).not.toBe("Laura");
    // La transacción de esta no cambió el estado ni avisó a nadie.
    expect(presupuesto(presupuestoId).status).toBe("ENVIADO");
    expect(H.notificar).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), "PRESUPUESTO_ACEPTADO", expect.anything());
    expect(tareas(AV.TITULO_TAREA_ACEPTADO)).toHaveLength(0);
  });

  it("datos, token y estados que no se aceptan, con mensajes claros", async () => {
    const { presupuestoId, versionId } = await enviado();
    const t = token(versionId);
    const aceptar = (datos: { nombre: unknown; acepta: unknown }, ws = "ws-1", tok: unknown = t, ahora = AHORA) =>
      AC.aceptarPresupuesto(ws, tok, datos, evidencia, { ahora: () => ahora, enviar: enviador() });
    expect(await aceptar({ nombre: " ", acepta: true })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.nombre });
    expect(await aceptar({ nombre: "x".repeat(121), acepta: true })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.nombre });
    expect(await aceptar({ nombre: "Laura", acepta: "true" })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.condiciones });
    expect(await aceptar({ nombre: "Laura", acepta: true }, "ws-1", "nada")).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.enlaceInvalido });
    expect(await aceptar({ nombre: "Laura", acepta: true }, "ws-2")).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.enlaceInvalido });
    expect(await aceptar({ nombre: "Laura", acepta: true }, "ws-1", t, new Date("2026-11-01T15:00:00.000Z"))).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.vencido });
    expect(await aceptar({ nombre: "Laura", acepta: true }, "ws-1", t, new Date("2026-11-23T15:00:00.000Z"))).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.enlaceInvalido });
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, deps)).toEqual({ ok: true });
    expect(await aceptar({ nombre: "Laura", acepta: true })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.rechazado });
    expect(version(versionId).acceptedAt).toBeNull();
    expect(presupuesto(presupuestoId).status).toBe("RECHAZADO");
  });

  it("vencido: «Pedir uno nuevo» crea una sola tarea abierta; vigente, no", async () => {
    const { versionId } = await enviado();
    const t = token(versionId);
    expect(await AC.pedirPresupuestoNuevo("ws-1", t, { ahora: () => AHORA })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.noVencido });
    const tarde = () => new Date("2026-11-01T15:00:00.000Z");
    expect(await AC.pedirPresupuestoNuevo("ws-1", t, { ahora: tarde })).toEqual({ ok: true });
    expect(await AC.pedirPresupuestoNuevo("ws-1", t, { ahora: tarde })).toEqual({ ok: true });
    expect(tareas(AV.TITULO_TAREA_PEDIR_NUEVO)).toEqual([expect.objectContaining({ assigneeUserId: 1, subjectId: "lead-1" })]);
    expect(B.sql.some((q) => q.valores.includes(`fotoffice-tarea-presupuesto:ws-1:lead-1:${AV.TITULO_TAREA_PEDIR_NUEVO}`))).toBe(true);
    expect(await AC.pedirPresupuestoNuevo("ws-2", t, { ahora: tarde })).toEqual({ ok: false, error: AC.MENSAJES_ACEPTACION.enlaceInvalido });
  });

  it("el correo interno tiene tope diario (la tarea se crea igual)", async () => {
    const { versionId } = await enviado();
    for (let i = 0; i < AV.TOPE_AVISOS_ACEPTACION_DIA; i++) {
      B.agregar("fotofficePresupuestoVersion", { workspaceId: "ws-1", presupuestoId: `otro-${i}`, number: 1, items: [], totals: {}, sentAt: AHORA, acceptedAt: AHORA });
    }
    const avisos = enviador();
    expect((await AC.aceptarPresupuesto("ws-1", token(versionId), { nombre: "Laura", acepta: true }, evidencia, { ahora: () => AHORA, enviar: avisos })).ok).toBe(true);
    expect(avisos).not.toHaveBeenCalled();
    expect(tareas(AV.TITULO_TAREA_ACEPTADO)).toHaveLength(1);
  });
});
