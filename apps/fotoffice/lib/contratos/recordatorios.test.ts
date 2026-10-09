import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ modulos: new Set<string>() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async (ws: string) => H.modulos.has(ws) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" },
    contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));

const R = await import("./recordatorios");
const L = await import("./enlace");
const { huellaTexto } = await import("./huella");
const { pngConTrazo } = await import("./png-prueba");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-10-09T13:00:00.000Z");
const hace = (d: number) => new Date(AHORA.getTime() - d * DIA);
const CLAVE = "clave-enlace";
const VENCE = new Date(AHORA.getTime() + 25 * DIA);

type Salida = { to: string; subject: string; text: string };
let enviados: Salida[];
let respuesta: { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string };
const enviar = async (m: Salida) => {
  enviados.push(m);
  return respuesta as never;
};
const guardados = new Map<string, Uint8Array>();
const leer = async (clave: string): Promise<Uint8Array> => {
  if (clave.endsWith(".png")) return pngConTrazo() as Uint8Array;
  const f = guardados.get(clave);
  if (!f) throw new Error("no está");
  return f;
};
const subir = async (clave: string, bytes: Uint8Array) => void guardados.set(clave, bytes);
const deps = (extra: Record<string, unknown> = {}) =>
  ({ ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test", enviar, leer, subir, organizacion: "DNX Estudio", ...extra }) as never;

const firmante = (id: string) => B.datos.fotofficeContratoFirmante.find((f) => f.id === id)!;
const tipos = () => B.datos.fotofficeContratoEvento.map((e) => e.type);
const token = (id: string, vence = VENCE) => L.tokenDeFirmante(id, vence, CLAVE);

function contrato(id: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeContrato", {
    id, workspaceId: "ws-1", pedidoId: `p-${id}`, clientId: "c1", number: `C-${id}`, name: "Contrato", status: "ENVIADO", bodyText: "x",
    currentVersionId: `v-${id}`, sentAt: hace(5), ...extra,
  });
  B.agregar("fotofficeContratoVersion", { id: `v-${id}`, workspaceId: "ws-1", contratoId: id, number: 1, bodyText: "x", contentHash: huellaTexto("x"), sentAt: hace(5) });
}
function firmanteDe(id: string, contratoId: string, extra: Record<string, unknown> = {}, orden = 1) {
  B.agregar("fotofficeContratoFirmante", {
    id, workspaceId: "ws-1", versionId: `v-${contratoId}`, orden, name: "Gómez, Ana", email: `${id}@x.com`,
    tokenHash: L.hashDeToken(token(id)), tokenExpiresAt: VENCE, ...extra,
  });
}

beforeEach(() => {
  B.vaciar();
  H.modulos = new Set(["ws-1"]);
  enviados = [];
  guardados.clear();
  respuesta = { status: "SENT", providerId: "prov-1" };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", reminderEnabled: true, reminderDays: 3, companyName: "DNX SRL" });
  contrato("k1");
  firmanteDe("f1", "k1");
});

async function corrida(extra: Record<string, unknown> = {}) {
  return R.correrContratosDiario(deps(extra));
}

describe("a quién se le recuerda", () => {
  it("al firmante pendiente, con su mismo enlace y sin extender su vencimiento", async () => {
    const hashAntes = firmante("f1").tokenHash;
    const rep = await corrida();
    expect(rep.recordatorios).toMatchObject({ enviados: 1, fallidos: 0, salteados: 0 });
    expect(rep.organizaciones).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.to).toBe("f1@x.com");
    expect(enviados[0]!.subject).toBe("Te falta firmar el contrato C-k1");
    const f = firmante("f1");
    expect(f.tokenHash).toBe(hashAntes);
    expect(f.lastReminderAt).toEqual(AHORA);
    expect(f.tokenExpiresAt).toEqual(VENCE);
    expect(enviados[0]!.text).toContain(`https://app.test/w/dnxestudio/contrato/${token("f1")}`);
    expect(await L.resolverTokenFirmantePorWorkspace("ws-1", token("f1"), AHORA)).toMatchObject({ ok: true });
    expect(tipos()).toEqual(["RECORDATORIO"]);
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ entityType: "CONTRATO", entityId: "k1", status: "SENT", automatic: true });
  });

  it("los recordatorios terminan: corrida tras corrida el vencimiento no se mueve y al vencer no sale más ninguno", async () => {
    let total = 0;
    for (let d = 0; d <= 40; d += 3) {
      const ahora = new Date(AHORA.getTime() + d * DIA);
      total += (await corrida({ ahora: () => ahora })).recordatorios.enviados;
      expect(firmante("f1").tokenExpiresAt).toEqual(VENCE);
    }
    // El enlace vence a los 25 días de AHORA: 9 recordatorios (días 0 a 24) y ninguno después.
    expect(total).toBe(9);
    const despues = new Date(AHORA.getTime() + 60 * DIA);
    expect((await corrida({ ahora: () => despues })).recordatorios.enviados).toBe(0);
  });

  it("segunda guarda: una versión enviada hace 30 días o más no recibe recordatorios aunque el enlace siga vivo", async () => {
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { sentAt: hace(30) });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { sentAt: hace(29) });
    expect((await corrida()).recordatorios.enviados).toBe(1);
  });

  it("no antes de reminderDays desde el envío", async () => {
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { sentAt: hace(2) });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { sentAt: hace(3) });
    expect((await corrida()).recordatorios.enviados).toBe(1);
  });

  it("respeta el intervalo desde el último recordatorio", async () => {
    Object.assign(firmante("f1"), { lastReminderAt: hace(2) });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    Object.assign(firmante("f1"), { lastReminderAt: hace(3) });
    expect((await corrida()).recordatorios.enviados).toBe(1);
    // Y recién recordado: la corrida siguiente no lo repite.
    expect((await corrida()).recordatorios.enviados).toBe(0);
    expect(enviados).toHaveLength(1);
  });

  it("usa los días de la organización", async () => {
    Object.assign(B.datos.fotofficeContratoAjustes[0]!, { reminderDays: 7 });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    Object.assign(B.datos.fotofficeContratoAjustes[0]!, { reminderDays: 5 });
    expect((await corrida()).recordatorios.enviados).toBe(1);
  });

  it("no a quien firmó, rechazó, ni con enlace vencido; sí al que falta en un FIRMADO_PARCIAL", async () => {
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "FIRMADO_PARCIAL" });
    firmanteDe("f2", "k1", { signedAt: hace(1), tokenHash: "h2" }, 2);
    firmanteDe("f3", "k1", { rejectedAt: hace(1), tokenHash: "h3" }, 2);
    firmanteDe("f4", "k1", { tokenExpiresAt: hace(1), tokenHash: "h4" }, 2);
    const rep = await corrida();
    expect(rep.recordatorios.enviados).toBe(1);
    expect(enviados.map((e) => e.to)).toEqual(["f1@x.com"]);
  });

  it("no en contratos borrador, firmados, rechazados ni anulados, ni de versiones reemplazadas", async () => {
    for (const status of ["BORRADOR", "FIRMADO", "RECHAZADO", "ANULADO"]) {
      Object.assign(B.datos.fotofficeContrato[0]!, { status });
      expect((await corrida()).recordatorios.enviados).toBe(0);
    }
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "ENVIADO" });
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { revokedAt: hace(1) });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { revokedAt: null });
    Object.assign(B.datos.fotofficeContrato[0]!, { currentVersionId: "otra" });
    expect((await corrida()).recordatorios.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it("no si la organización los tiene apagados o el módulo apagado", async () => {
    Object.assign(B.datos.fotofficeContratoAjustes[0]!, { reminderEnabled: false });
    expect((await corrida()).organizaciones).toBe(0);
    Object.assign(B.datos.fotofficeContratoAjustes[0]!, { reminderEnabled: true });
    H.modulos.clear();
    expect((await corrida()).recordatorios.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it("no cruza organizaciones: cada una con sus ajustes", async () => {
    B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-2", reminderEnabled: true, reminderDays: 30 });
    H.modulos.add("ws-2");
    const rep = await corrida();
    expect(rep.organizaciones).toBe(2);
    expect(rep.recordatorios.enviados).toBe(1);
  });

  it("un contrato firmado en papel no recibe recordatorios", async () => {
    Object.assign(B.datos.fotofficeContrato[0]!, { manualSignedAt: hace(1) });
    expect((await corrida()).recordatorios.enviados).toBe(0);
  });
});

describe("cuando el correo no sale", () => {
  it("se vuelve atrás la rotación: el enlace que la persona ya tenía sigue andando", async () => {
    respuesta = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    const antes = { ...firmante("f1") };
    const rep = await corrida();
    expect(rep.recordatorios).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(firmante("f1").tokenHash).toBe(antes.tokenHash);
    expect(firmante("f1").tokenExpiresAt).toEqual(VENCE);
    expect(firmante("f1").lastReminderAt ?? null).toBeNull();
    expect(await L.resolverTokenFirmantePorWorkspace("ws-1", token("f1"), AHORA)).toMatchObject({ ok: true });
    expect(tipos()).toEqual([]);
    // Al día siguiente, con el proveedor andando, sale.
    respuesta = { status: "SENT", providerId: "p" };
    expect((await corrida()).recordatorios.enviados).toBe(1);
  });

  it("con la plantilla apagada no manda ni rota", async () => {
    B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", systemKey: "CONTRATO_RECORDATORIO", channel: "EMAIL", entityType: "CONTRATO", name: "Recordatorio", subject: "s", body: "b", enabled: false, order: 1,
    });
    const rep = await corrida();
    expect(rep.recordatorios.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(firmante("f1").tokenExpiresAt).toEqual(VENCE);
    expect(firmante("f1").lastReminderAt ?? null).toBeNull();
  });

  it("con el tope diario de correos automáticos alcanzado no manda y avisa en el reporte", async () => {
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "x", status: "SENT", automatic: true, createdAt: AHORA, templateId: null });
    }
    const rep = await corrida();
    expect(rep.recordatorios).toMatchObject({ enviados: 0, conTopeDiario: 1 });
    expect(firmante("f1").tokenExpiresAt).toEqual(VENCE);
  });

  it("firmante sin correo válido: se saltea y no se toca su enlace", async () => {
    Object.assign(firmante("f1"), { email: "sin-arroba" });
    const rep = await corrida();
    expect(rep.recordatorios).toMatchObject({ enviados: 0, salteados: 1 });
    expect(firmante("f1").tokenExpiresAt).toEqual(VENCE);
  });

  it("después de varios fallos seguidos corta la corrida", async () => {
    respuesta = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    for (let i = 2; i <= 9; i++) {
      contrato(`k${i}`);
      firmanteDe(`f${i}`, `k${i}`);
    }
    const rep = await corrida();
    expect(rep.recordatorios.fallidos).toBe(5);
    expect(enviados).toHaveLength(5);
  });
});

describe("topes y clave", () => {
  it("como mucho `topeRecordatorios` por corrida; el resto queda para mañana", async () => {
    for (let i = 2; i <= 4; i++) {
      contrato(`k${i}`);
      firmanteDe(`f${i}`, `k${i}`);
    }
    const rep = await corrida({ topeRecordatorios: 2 });
    expect(rep.recordatorios.enviados).toBe(2);
    expect(rep.recordatorios.topeCorrida).toBe(true);
    const rep2 = await corrida({ topeRecordatorios: 10 });
    expect(rep2.recordatorios.enviados).toBe(2);
    expect(enviados).toHaveLength(4);
  });

  it("sin clave para los enlaces no manda nada", async () => {
    const rep = await corrida({ clave: null });
    expect(rep.recordatorios.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it("no guarda ni registra el enlace ni la dirección en el log", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...a) => void logs.push(JSON.stringify(a)));
    vi.spyOn(console, "error").mockImplementation((...a) => void logs.push(JSON.stringify(a)));
    respuesta = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    await corrida();
    expect(logs.join("")).not.toContain("f1@x.com");
    expect(logs.join("")).not.toContain("contrato/");
  });
});

describe("reintento del PDF", () => {
  function firmado(id: string, extra: Record<string, unknown> = {}) {
    contrato(id, { status: "FIRMADO", signedAt: hace(1), ...extra });
    firmanteDe(`${id}-f`, id, { signedAt: hace(1), signatureKey: `contratos/ws-1/${id}/${id}-f.png`, typedName: "Ana", verifiedAt: hace(1) });
  }

  it("genera y manda el PDF de un contrato firmado que quedó sin PDF", async () => {
    firmado("k9");
    const rep = await corrida();
    expect(rep.pdfs).toMatchObject({ revisados: 1, generados: 1, enviados: 1, fallidos: 0 });
    const c = B.datos.fotofficeContrato.find((x) => x.id === "k9")!;
    expect(c.pdfKey).toBe("contratos/ws-1/k9/contrato-C-k9-v1.pdf");
    expect(c.pdfSentAt).toEqual(AHORA);
    expect(enviados.some((e) => e.subject === "El contrato C-k9 quedó firmado")).toBe(true);
  });

  it("completa sólo el envío si el PDF ya estaba", async () => {
    firmado("k9");
    await R.reintentarPdfsPendientes({ organizaciones: 0, recordatorios: { enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false }, pdfs: { revisados: 0, generados: 0, enviados: 0, fallidos: 0 } }, deps({ enviar: async () => ({ status: "PROVIDER_REJECTED", detail: "HTTP 500" }) }));
    const c = B.datos.fotofficeContrato.find((x) => x.id === "k9")!;
    expect(c.pdfKey).toBeTruthy();
    expect(c.pdfSentAt ?? null).toBeNull();
    const subidas = guardados.size;
    const rep = await corrida();
    expect(rep.pdfs).toMatchObject({ revisados: 1, generados: 0, enviados: 1 });
    expect(guardados.size).toBe(subidas);
  });

  it("no toca lo ya completo, lo firmado en papel ni lo firmado hace más de 30 días", async () => {
    firmado("k8", { pdfKey: "contratos/ws-1/k8/x.pdf", pdfHash: "h", pdfSentAt: hace(1) });
    firmado("k7", { manualSignedAt: hace(1) });
    firmado("k6", { signedAt: hace(40) });
    const rep = await corrida();
    expect(rep.pdfs.revisados).toBe(0);
    expect(enviados.some((e) => e.subject.includes("quedó firmado"))).toBe(false);
  });

  it("revisa de a `topePdfs`, los más nuevos primero", async () => {
    firmado("k5", { signedAt: hace(3) });
    firmado("k4", { signedAt: hace(1) });
    const rep = await corrida({ topePdfs: 1 });
    expect(rep.pdfs.revisados).toBe(1);
    expect(B.datos.fotofficeContrato.find((x) => x.id === "k4")!.pdfKey).toBeTruthy();
    expect(B.datos.fotofficeContrato.find((x) => x.id === "k5")!.pdfKey ?? null).toBeNull();
  });
});
