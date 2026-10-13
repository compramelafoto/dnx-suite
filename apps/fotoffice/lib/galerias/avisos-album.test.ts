import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const A = await import("./avisos-album");
const { TOPE_AVISOS_ESTUDIO_DIA } = await import("./avisos");

const AHORA = new Date("2026-10-11T15:00:00.000Z");
type Salida = { to: string; subject: string; html: string; text: string };
let internos: Salida[];
let estadoEnvio: "SENT" | "REJECTED";
const deps = () => ({
  ahora: () => AHORA,
  appOrigin: "https://app.test",
  enviarInterno: async (m: Salida) => {
    internos.push(m);
    return (estadoEnvio === "SENT" ? { status: "SENT", providerId: "i" } : { status: "PROVIDER_REJECTED", detail: "x" }) as never;
  },
});
const DATOS = { workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", rondaNumero: 2, decision: "CAMBIOS" as const, mensaje: "Cambiar <b>la tapa</b>", comentarios: 3 };
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  internos = [];
  estadoEnvio = "SENT";
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("user", { id: 7, email: "duena@estudio.test", name: "Dueña" });
  B.agregar("user", { id: 8, email: "admin@estudio.test", name: "Admin" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "WORKSPACE_OWNER", createdAt: new Date("2026-01-01") });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8, role: "WORKSPACE_ADMIN", createdAt: new Date("2026-02-01") });
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Álbum boda", kind: "ALBUM", status: "PUBLICADA", ownerUserId: 8 });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", name: "Ana Gómez", email: "ana@x.com", tokenHash: "h".repeat(64), tokenIssuedAt: AHORA, status: "EN_REVISION" });
});

describe("aviso al estudio por la decisión del álbum", () => {
  it("avisa al responsable de la galería con la decisión, la ronda, los comentarios, el mensaje (escapado) y el enlace a la revisión del cliente", async () => {
    expect(await A.avisarDecisionAlbum(DATOS, deps())).toBe("ENVIADO");
    expect(internos).toHaveLength(1);
    expect(internos[0]!.to).toBe("admin@estudio.test");
    expect(internos[0]!.subject).toBe("Ana Gómez pidió cambios en el álbum Álbum boda");
    expect(internos[0]!.text).toContain("ronda 2");
    expect(internos[0]!.text).toContain("3 comentarios");
    expect(internos[0]!.text).toContain("https://app.test/galerias/g1/clientes/gc1?ronda=2");
    expect(internos[0]!.html).toContain("&lt;b&gt;la tapa&lt;/b&gt;");
    expect(internos[0]!.html).not.toContain("<b>la tapa</b>");
    expect(eventos()).toEqual(["AVISO_ESTUDIO_ENVIADO"]);
  });
  it("el asunto no lleva saltos de línea aunque el nombre los tenga", async () => {
    B.datos.fotofficeGaleriaCliente[0]!.name = "Ana\r\nBcc: x@y.com";
    await A.avisarDecisionAlbum(DATOS, deps());
    expect(internos[0]!.subject).not.toMatch(/[\r\n]/);
  });
  it("si aprobó lo dice, y sin responsable va al dueño del estudio", async () => {
    B.datos.fotofficeGaleria[0]!.ownerUserId = null;
    expect(await A.avisarDecisionAlbum({ ...DATOS, decision: "APROBADO", mensaje: null, comentarios: 0 }, deps())).toBe("ENVIADO");
    expect(internos[0]!.to).toBe("duena@estudio.test");
    expect(internos[0]!.subject).toBe("Ana Gómez aprobó el álbum Álbum boda");
    expect(internos[0]!.text).not.toContain("Su mensaje");
  });
  it("respeta el tope diario de avisos y lo deja en el historial", async () => {
    for (let i = 0; i < TOPE_AVISOS_ESTUDIO_DIA; i++) B.agregar("fotofficeGaleriaEvento", { workspaceId: "ws-1", galeriaId: "g1", type: "AVISO_ESTUDIO_ENVIADO", createdAt: AHORA });
    expect(await A.avisarDecisionAlbum(DATOS, deps())).toBe("TOPE");
    expect(internos).toHaveLength(0);
    expect(B.datos.fotofficeGaleriaEvento.at(-1)).toMatchObject({ type: "AVISO_ESTUDIO_NO_ENVIADO", data: { motivo: "TOPE" } });
  });
  it("si el proveedor lo rechaza o no hay destinatario, queda anotado y no lanza", async () => {
    estadoEnvio = "REJECTED";
    expect(await A.avisarDecisionAlbum(DATOS, deps())).toBe("NO_ENVIADO");
    B.datos.workspaceMembership.length = 0;
    expect(await A.avisarDecisionAlbum(DATOS, deps())).toBe("SIN_DESTINATARIO");
    expect(eventos()).toEqual(["AVISO_ESTUDIO_NO_ENVIADO", "AVISO_ESTUDIO_NO_ENVIADO"]);
  });
  it("una galería o cliente que no existen (o de otro workspace) no mandan nada", async () => {
    expect(await A.avisarDecisionAlbum({ ...DATOS, workspaceId: "ws-2" }, deps())).toBe("ERROR");
    expect(await A.avisarDecisionAlbum({ ...DATOS, galeriaClienteId: "nadie" }, deps())).toBe("ERROR");
    expect(internos).toHaveLength(0);
  });
});
