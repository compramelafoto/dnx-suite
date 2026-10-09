import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({ organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" }, contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null } }),
}));

const C = await import("./correos");
const E = await import("./envio");
const L = await import("./enlace");
const { clavesPermitidas } = await import("@/lib/plantillas/variables");
const { analizar } = await import("@/lib/plantillas/motor");
const { CLAVES_AUTOMATICO_CONTRATO } = await import("./constantes");
const { AUTOMATICOS } = await import("@/lib/plantillas/definiciones");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const DEPS = { ahora: () => AHORA };

type Salida = { to: string; subject: string; html: string; text: string };
let enviados: Salida[];
let resultado: { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string };
const enviar = async (m: Salida) => {
  enviados.push(m);
  return resultado as never;
};
const mensajes = () => B.datos.fotofficeMessage;

const base = { workspaceId: "ws-1", contratoId: "k1", para: "ana@x.com", nombre: "Gómez, Ana", numero: "C-1" };

beforeEach(() => {
  B.vaciar();
  enviados = [];
  resultado = { status: "SENT", providerId: "prov-1" };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("plantillas iniciales", () => {
  it("usan sólo variables del tipo CONTRATO, no dicen firma digital y no dejan textos por completar", () => {
    const permitidas = clavesPermitidas("CONTRATO", []);
    for (const clave of CLAVES_AUTOMATICO_CONTRATO) {
      const t = C.TEXTOS_CONTRATO_INICIALES[clave];
      expect(analizar(t.asunto, permitidas).ok).toBe(true);
      expect(analizar(t.cuerpo, permitidas).ok).toBe(true);
      expect(`${t.asunto} ${t.cuerpo}`.toLowerCase()).not.toContain("firma digital");
      expect(AUTOMATICOS[clave].tipo).toBe("CONTRATO");
    }
    expect(C.TEXTOS_CONTRATO_INICIALES.CONTRATO_ENVIO.cuerpo).toContain("[contrato_enlace]");
    expect(C.TEXTOS_CONTRATO_INICIALES.CONTRATO_CODIGO.cuerpo).toContain("[contrato_codigo]");
    expect(C.TEXTOS_CONTRATO_INICIALES.CONTRATO_ENVIO.cuerpo).not.toContain("[contrato_codigo]");
  });

  it("se crean una sola vez, encendidas", async () => {
    await C.asegurarPlantillasContrato("ws-1");
    await C.asegurarPlantillasContrato("ws-1");
    const filas = B.datos.fotofficeMessageTemplate;
    expect(filas.map((f) => f.systemKey).sort()).toEqual([...CLAVES_AUTOMATICO_CONTRATO].sort());
    expect(filas.every((f) => f.enabled === true && f.entityType === "CONTRATO" && f.channel === "EMAIL")).toBe(true);
  });
});

describe("correo con el enlace", () => {
  it("sale al firmante, con su nombre y su enlace, y queda registrado", async () => {
    const r = await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://app.test/w/dnxestudio/contrato/TOKEN" }, { ...DEPS, enviar });
    expect(r).toBe("ENVIADO");
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.to).toBe("ana@x.com");
    expect(enviados[0]!.subject).toBe("Contrato C-1 para firmar");
    expect(enviados[0]!.text).toContain("https://app.test/w/dnxestudio/contrato/TOKEN");
    expect(enviados[0]!.text).toContain("Gómez, Ana");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ workspaceId: "ws-1", entityType: "CONTRATO", entityId: "k1", toAddress: "ana@x.com", status: "SENT", automatic: true, providerId: "prov-1" });
  });

  it("no tiene el freno de 24 h por dirección: dos al mismo correo salen los dos", async () => {
    await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://x/1" }, { ...DEPS, enviar });
    await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_RECORDATORIO", enlace: "https://x/1" }, { ...DEPS, enviar });
    expect(enviados).toHaveLength(2);
  });

  it("respeta el tope diario de automáticos y no envía ni registra al llegar", async () => {
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "x", toAddress: `a${i}@x.com`, body: "", status: "SENT", automatic: true, createdAt: AHORA });
    }
    const antes = mensajes().length;
    expect(await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://x/1" }, { ...DEPS, enviar })).toBe("TOPE");
    expect(enviados).toHaveLength(0);
    expect(mensajes()).toHaveLength(antes);
  });

  it("apagada la plantilla, no sale; con dirección inválida, tampoco", async () => {
    await C.asegurarPlantillasContrato("ws-1");
    B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "CONTRATO_ENVIO")!.enabled = false;
    expect(await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://x/1" }, { ...DEPS, enviar })).toBe("APAGADA");
    expect(await C.enviarCorreoContrato({ ...base, para: "no-es-correo", clave: "CONTRATO_RECORDATORIO", enlace: "https://x/1" }, { ...DEPS, enviar })).toBe("SIN_CORREO");
    expect(enviados).toHaveLength(0);
  });

  it("una plantilla rota por el administrador no sale, y una falla del proveedor se registra sin lanzar", async () => {
    await C.asegurarPlantillasContrato("ws-1");
    const t = B.datos.fotofficeMessageTemplate.find((x) => x.systemKey === "CONTRATO_RECORDATORIO")!;
    t.body = "Hola [variable_que_no_existe]";
    expect(await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_RECORDATORIO", enlace: "https://x/1" }, { ...DEPS, enviar })).toBe("PLANTILLA_CON_ERRORES");
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 422 · validation_error" };
    expect(await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://x/1" }, { ...DEPS, enviar })).toBe("NO_ENVIADO");
    expect(mensajes().at(-1)).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_REJECTED:422:validation_error" });
    const lanza = async () => { throw new Error("se cayó"); };
    expect(await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_ENVIO", enlace: "https://x/1" }, { ...DEPS, enviar: lanza as never })).toBe("ERROR");
  });
});

describe("correo con el código", () => {
  it("el firmante recibe el código, pero el registro NO lo guarda", async () => {
    const r = await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_CODIGO", codigo: "482915" }, { ...DEPS, enviar });
    expect(r).toBe("ENVIADO");
    expect(enviados[0]!.text).toContain("482915");
    expect(enviados[0]!.html).toContain("482915");
    expect(mensajes()).toHaveLength(1);
    expect(JSON.stringify(mensajes())).not.toContain("482915");
    expect(mensajes()[0]!.body).toContain("******");
    expect(mensajes()[0]).toMatchObject({ entityType: "CONTRATO", status: "SENT" });
  });

  it("aunque el administrador ponga el código en el asunto, el registro tampoco lo guarda", async () => {
    await C.asegurarPlantillasContrato("ws-1");
    B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "CONTRATO_CODIGO")!.subject = "Código [contrato_codigo]";
    await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_CODIGO", codigo: "482915" }, { ...DEPS, enviar });
    expect(enviados[0]!.subject).toBe("Código 482915");
    expect(JSON.stringify(mensajes())).not.toContain("482915");
  });

  it("si el envío falla, el registro tampoco tiene el código ni lo deja en los logs", async () => {
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    await C.enviarCorreoContrato({ ...base, clave: "CONTRATO_CODIGO", codigo: "482915" }, { ...DEPS, enviar });
    expect(JSON.stringify(mensajes())).not.toContain("482915");
    expect(JSON.stringify([(console.warn as ReturnType<typeof vi.fn>).mock.calls, (console.error as ReturnType<typeof vi.fn>).mock.calls])).not.toMatch(/482915|ana@x\.com|Gómez/);
  });
});

describe("correos de una versión enviada", () => {
  const TEXTO = "# Contrato\n\nTexto.";
  const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { contracts: "MANAGE" } } as never };
  beforeEach(() => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "ana@x.com" });
    B.agregar("client", { id: "c2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Luis", lastName: "Pérez", email: "luis@x.com" });
    B.agregar("fotofficePedido", { id: "p1", workspaceId: "ws-1", number: "P-7", clientId: "c1", status: "CONFIRMADO", totalArs: "1.00", items: [], totals: {} });
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", companyName: "Estudio Luz" });
    B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "Contrato", status: "BORRADOR", bodyText: TEXTO });
  });
  const deps = { ...DEPS, clave: CLAVE, appOrigin: "https://app.test", enviar };

  it("manda el enlace personal a cada firmante", async () => {
    const r = await E.enviar(CTX, "k1", {}, { ...deps, ahora: DEPS.ahora });
    if (!r.ok) throw new Error(r.error);
    expect(await E.enviarCorreosDeVersion("ws-1", "k1", r.versionId, deps)).toBe(2);
    expect(enviados.map((m) => m.to)).toEqual(["ana@x.com", "luis@x.com"]);
    const fs = B.datos.fotofficeContratoFirmante;
    for (const [i, f] of fs.entries()) {
      const token = L.tokenDeFirmante(f.id as string, f.tokenExpiresAt as Date, CLAVE);
      expect(enviados[i]!.text).toContain(`https://app.test/w/dnxestudio/contrato/${token}`);
    }
    expect(mensajes()).toHaveLength(2);
  });

  it("una versión reemplazada no manda nada; un firmante que ya firmó, tampoco", async () => {
    const a = await E.enviar(CTX, "k1", {}, deps);
    const b = await E.enviar(CTX, "k1", { textoCorregido: "Otro" }, deps);
    if (!a.ok || !b.ok) throw new Error("no se envió");
    expect(await E.enviarCorreosDeVersion("ws-1", "k1", a.versionId, deps)).toBe(0);
    B.datos.fotofficeContratoFirmante.find((f) => f.versionId === b.versionId && f.orden === 1)!.signedAt = AHORA;
    expect(await E.enviarCorreosDeVersion("ws-1", "k1", b.versionId, deps)).toBe(1);
    expect(enviados.map((m) => m.to)).toEqual(["luis@x.com"]);
  });

  it("no lanza aunque todo falle", async () => {
    const lanza = async () => { throw new Error("se cayó"); };
    const r = await E.enviar(CTX, "k1", {}, deps);
    if (!r.ok) throw new Error(r.error);
    expect(await E.enviarCorreosDeVersion("ws-1", "k1", r.versionId, { ...deps, enviar: lanza as never })).toBe(0);
    expect(await E.enviarCorreosDeVersion("ws-1", "nada", "nada", deps)).toBe(0);
  });

  it("reenviar: el correo sale con el enlace nuevo", async () => {
    const r = await E.enviar(CTX, "k1", {}, deps);
    if (!r.ok) throw new Error(r.error);
    const f = B.datos.fotofficeContratoFirmante[0]!;
    const mas = { ...deps, ahora: () => new Date(AHORA.getTime() + 24 * 60 * 60 * 1000) };
    await E.reenviarEnlace(CTX, f.id, mas);
    expect(await E.enviarCorreoAlFirmante("ws-1", f.id as string, deps)).toBe(true);
    const token = L.tokenDeFirmante(f.id as string, f.tokenExpiresAt as Date, CLAVE);
    expect(enviados[0]!.text).toContain(token);
  });
});

describe("texto del recordatorio", () => {
  it("avisa que el enlace de este correo reemplaza a los anteriores", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync(new URL("./correos.ts", import.meta.url), "utf8");
    const i = fuente.indexOf("CONTRATO_RECORDATORIO: {");
    expect(fuente.slice(i, fuente.indexOf("CONTRATO_FIRMADO: {"))).toContain("reemplaza a los que te hayamos mandado antes");
  });
});
