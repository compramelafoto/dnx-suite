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

const { enlaceDeFirmante } = await import("./copiar-enlace");
const { hashDeToken, tokenDeFirmante } = await import("./enlace");
const { MENSAJES_CONTRATO: M } = await import("./acceso");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (contracts: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { contracts } } as never });
const AHORA = new Date("2026-10-09T15:00:00.000Z");
const VENCE = new Date("2026-11-08T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const deps = { ahora: AHORA, clave: CLAVE, appOrigin: "https://app.test" };

function sembrar(extra: { firmante?: Record<string, unknown>; contrato?: Record<string, unknown>; version?: Record<string, unknown> } = {}) {
  B.agregar("fotofficeContrato", { id: "ct1", workspaceId: "ws-1", status: "ENVIADO", currentVersionId: "v1", ...extra.contrato });
  B.agregar("fotofficeContratoVersion", { id: "v1", workspaceId: "ws-1", contratoId: "ct1", number: 1, revokedAt: null, ...extra.version });
  B.agregar("fotofficeContratoFirmante", {
    id: "f1", workspaceId: "ws-1", versionId: "v1", orden: 1, tokenHash: hashDeToken(tokenDeFirmante("f1", VENCE, CLAVE)), tokenExpiresAt: VENCE,
    signedAt: null, rejectedAt: null, ...extra.firmante,
  });
}

beforeEach(() => B.vaciar());

describe("Copiar enlace de un firmante", () => {
  it("con Gestionar devuelve el enlace vigente, el mismo que se mandó por correo", async () => {
    sembrar();
    const r = await enlaceDeFirmante(ctx("MANAGE"), "f1", deps);
    expect(r).toEqual({ ok: true, url: `https://app.test/w/dnxestudio/contrato/${encodeURIComponent(tokenDeFirmante("f1", VENCE, CLAVE))}` });
  });

  it("sin Gestionar no entrega nada (el enlace permite firmar)", async () => {
    sembrar();
    for (const nivel of ["VIEW", "NONE"] as const) {
      expect(await enlaceDeFirmante(ctx(nivel), "f1", deps)).toEqual({ ok: false, error: M.sinPermiso });
    }
  });

  it("no sirve para otro workspace, un firmante inexistente ni ids raros", async () => {
    sembrar();
    expect(await enlaceDeFirmante(ctx("MANAGE", "ws-2"), "f1", deps)).toEqual({ ok: false, error: M.firmanteNoExiste });
    expect(await enlaceDeFirmante(ctx("MANAGE"), "nada", deps)).toEqual({ ok: false, error: M.firmanteNoExiste });
    for (const malo of ["", 5, null, "x".repeat(65)]) expect(await enlaceDeFirmante(ctx("MANAGE"), malo, deps)).toEqual({ ok: false, error: M.datosInvalidos });
  });

  it("no hay enlace si ya firmó, rechazó, venció, la versión se reemplazó o el contrato no está abierto", async () => {
    const casos: Parameters<typeof sembrar>[0][] = [
      { firmante: { signedAt: AHORA } },
      { firmante: { rejectedAt: AHORA } },
      { firmante: { tokenExpiresAt: new Date("2026-10-01T00:00:00Z"), tokenHash: hashDeToken(tokenDeFirmante("f1", new Date("2026-10-01T00:00:00Z"), CLAVE)) } },
      { version: { revokedAt: AHORA } },
      { contrato: { currentVersionId: "v2" } },
      { contrato: { status: "BORRADOR" } },
      { contrato: { status: "FIRMADO" } },
      { contrato: { status: "ANULADO" } },
      { contrato: { status: "RECHAZADO" } },
    ];
    for (const c of casos) {
      B.vaciar();
      sembrar(c);
      expect(await enlaceDeFirmante(ctx("MANAGE"), "f1", deps), JSON.stringify(c)).toEqual({ ok: false, error: M.noSeReenvia });
    }
  });

  it("un enlace que ya no coincide con el guardado (reenviado desde otra parte) no se entrega", async () => {
    sembrar({ firmante: { tokenHash: hashDeToken("otro-token") } });
    expect(await enlaceDeFirmante(ctx("MANAGE"), "f1", deps)).toEqual({ ok: false, error: M.noSeReenvia });
  });

  it("sin la clave de enlaces del servidor, no se arma", async () => {
    sembrar();
    expect(await enlaceDeFirmante(ctx("MANAGE"), "f1", { ...deps, clave: null })).toEqual({ ok: false, error: M.sinClaveEnlace });
  });
});
