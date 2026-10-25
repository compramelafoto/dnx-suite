import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@repo/db";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const P = await import("./perfil");
const M = P.MENSAJES_PERFIL;

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const CON_NIVELES = (levels: Record<string, string>) => ({
  ...CTX,
  role: "STAFF",
  acceso: { role: "STAFF", levels } as unknown as NonNullable<Parameters<typeof P.guardarPerfil>[0]["acceso"]>,
});

type Tx = Prisma.TransactionClient;
const enTx = <T>(fn: (tx: Tx) => Promise<T>) =>
  (B.prisma.$transaction as (f: (tx: unknown) => Promise<T>) => Promise<T>)((tx) => fn(tx as Tx));

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1 });
  B.agregar("client", { id: "c2", workspaceId: "ws-1", clientNumber: 2 });
  B.agregar("client", { id: "cx", workspaceId: "ws-2", clientNumber: 1 });
  B.agregar("fotofficeContactoPerfil", {
    workspaceId: "ws-1", clientId: "c2", category: "CONTACTO", mobile: "3415550000",
    birthday: new Date("1990-04-20T00:00:00.000Z"),
  });
  B.agregar("fotofficeContactoPerfil", { workspaceId: "ws-2", clientId: "cx", category: "PROVEEDOR", about: "secreto" });
});

describe("perfilDe", () => {
  it("lee en lote: sin perfil cuenta como CLIENTE; con perfil, sus datos", async () => {
    const m = await P.perfilDe("ws-1", ["c1", "c2", "c1"]);
    expect(m.get("c1")).toMatchObject({ category: "CLIENTE", mobile: null, tienePerfil: false });
    expect(m.get("c2")).toMatchObject({ category: "CONTACTO", mobile: "3415550000", birthday: "1990-04-20", tienePerfil: true });
    expect(m.size).toBe(2);
  });

  it("no devuelve clientes de otro workspace ni ids inválidos", async () => {
    const m = await P.perfilDe("ws-1", ["cx", 3, "", null, "nadie"]);
    expect(m.size).toBe(0);
    expect((await P.perfilDe("ws-1", [])).size).toBe(0);
  });
});

describe("validarPerfil", () => {
  it("normaliza celular, correo, web y fecha", () => {
    const r = P.validarPerfil({
      mobile: "+54 (341) 555-1234", email2: " Otro@Mail.com ", website: "dnx.com.ar", birthday: "1990-02-28",
      province: " Santa Fe ", country: "", category: "PROVEEDOR",
    });
    expect(r).toEqual({
      ok: true,
      valores: {
        mobile: "543415551234", email2: "otro@mail.com", website: "https://dnx.com.ar", birthday: "1990-02-28",
        province: "Santa Fe", country: null, category: "PROVEEDOR",
      },
    });
  });

  it("marca cada campo inválido", () => {
    const r = P.validarPerfil({
      mobile: "12", email2: "no-es-correo", website: "no es web", birthday: "1990-02-30", category: "JEFE",
      about: "x".repeat(4001), postalCode: 5 as unknown as string,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual({
      mobile: M.celular, email2: M.correo, website: M.web, birthday: M.fecha, category: M.categoria, about: M.largo,
      postalCode: M.revisar,
    });
  });

  it("no acepta cumpleaños en el futuro ni la categoría vacía", () => {
    const r = P.validarPerfil({ birthday: "2999-01-01", category: "" });
    expect(r.ok).toBe(false);
  });
});

describe("guardarPerfil", () => {
  it("crea el perfil y anota sólo lo que cambió en ClientAudit", async () => {
    const r = await P.guardarPerfil(CTX, "c1", { mobile: "341 555 1234", birthday: "1985-07-09", about: "" });
    expect(r).toEqual({ ok: true });
    const perfil = B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c1")!;
    expect(perfil).toMatchObject({ workspaceId: "ws-1", category: "CLIENTE", mobile: "3415551234" });
    expect((perfil.birthday as Date).toISOString()).toBe("1985-07-09T00:00:00.000Z");
    expect(B.datos.clientAudit).toEqual([
      expect.objectContaining({
        workspaceId: "ws-1", clientId: "c1", action: "UPDATED", actorUserId: 7, actorLabel: "Ana",
        changesJson: {
          mobile: { before: null, after: "3415551234" },
          birthday: { before: null, after: "1985-07-09" },
        },
      }),
    ]);
  });

  it("actualiza el perfil existente sin tocar lo que no llega", async () => {
    const r = await P.guardarPerfil(CTX, "c2", { category: "COLABORADOR", website: "https://dnx.com.ar" });
    expect(r).toEqual({ ok: true });
    const perfil = B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c2")!;
    expect(perfil).toMatchObject({ category: "COLABORADOR", website: "https://dnx.com.ar", mobile: "3415550000" });
    expect(B.datos.fotofficeContactoPerfil.filter((p) => p.clientId === "c2")).toHaveLength(1);
    expect(B.datos.clientAudit[0]!.changesJson).toEqual({
      category: { before: "CONTACTO", after: "COLABORADOR" },
      website: { before: null, after: "https://dnx.com.ar" },
    });
  });

  it("sin cambios no escribe nada", async () => {
    expect(await P.guardarPerfil(CTX, "c2", { mobile: "341-555-0000", birthday: "1990-04-20" })).toEqual({ ok: true });
    expect(B.datos.clientAudit).toHaveLength(0);
    expect(await P.guardarPerfil(CTX, "c1", { category: "CLIENTE" })).toEqual({ ok: true });
    expect(B.datos.fotofficeContactoPerfil.some((p) => p.clientId === "c1")).toBe(false);
  });

  it("con datos inválidos no escribe y devuelve los errores", async () => {
    const r = await P.guardarPerfil(CTX, "c1", { email2: "mal", mobile: "3415551234" });
    expect(r).toEqual({ ok: false, error: M.revisar, errores: { email2: M.correo } });
    expect(B.datos.fotofficeContactoPerfil.some((p) => p.clientId === "c1")).toBe(false);
    expect(B.datos.clientAudit).toHaveLength(0);
  });

  it("aislamiento: un cliente de otro workspace no se encuentra ni se toca", async () => {
    expect(await P.guardarPerfil(CTX, "cx", { about: "pisado" })).toEqual({ ok: false, error: M.noEncontrado });
    expect(await P.guardarPerfil(CTX, 42, { about: "x" })).toEqual({ ok: false, error: M.noEncontrado });
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "cx")?.about).toBe("secreto");
    expect(B.datos.clientAudit).toHaveLength(0);
  });

  it("exige Gestionar en Clientes", async () => {
    expect(await P.guardarPerfil(CON_NIVELES({ clients: "VIEW" }), "c1", { about: "x" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await P.guardarPerfil(CON_NIVELES({ "service-leads": "MANAGE" }), "c1", { about: "x" })).toEqual({
      ok: false,
      error: M.sinPermiso,
    });
    expect(await P.guardarPerfil({ ...CTX, role: null }, "c1", { about: "x" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await P.guardarPerfil(CON_NIVELES({ clients: "MANAGE" }), "c1", { about: "Le gusta el blanco y negro" })).toEqual({ ok: true });
  });
});

describe("marcarClienteSiGana", () => {
  it("pasa de CONTACTO a CLIENTE y lo anota", async () => {
    expect(await enTx((tx) => P.marcarClienteSiGana(tx, "ws-1", "c2"))).toBe(true);
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c2")?.category).toBe("CLIENTE");
    expect(B.datos.clientAudit).toEqual([
      expect.objectContaining({
        workspaceId: "ws-1", clientId: "c2", actorLabel: "Sistema",
        changesJson: { category: { before: "CONTACTO", after: "CLIENTE" } },
      }),
    ]);
    // La segunda vez ya es CLIENTE: no hace nada.
    expect(await enTx((tx) => P.marcarClienteSiGana(tx, "ws-1", "c2"))).toBe(false);
    expect(B.datos.clientAudit).toHaveLength(1);
  });

  it("no toca un contacto de otro workspace", async () => {
    expect(await enTx((tx) => P.marcarClienteSiGana(tx, "ws-2", "c2"))).toBe(false);
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c2")?.category).toBe("CONTACTO");
    expect(B.datos.clientAudit).toHaveLength(0);
  });

  it("no toca las otras categorías ni a los clientes sin perfil", async () => {
    expect(await enTx((tx) => P.marcarClienteSiGana(tx, "ws-2", "cx"))).toBe(false);
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "cx")?.category).toBe("PROVEEDOR");
    expect(await enTx((tx) => P.marcarClienteSiGana(tx, "ws-1", "c1"))).toBe(false);
    expect(B.datos.fotofficeContactoPerfil.some((p) => p.clientId === "c1")).toBe(false);
    expect(B.datos.clientAudit).toHaveLength(0);
  });
});

describe("marcarClienteDeConsultaGanada", () => {
  it("con la consulta del workspace, su contacto pasa a CLIENTE en una transacción", async () => {
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l1", clientId: "c2" });
    const antes = B.transacciones.length;
    expect(await P.marcarClienteDeConsultaGanada("ws-1", "l1")).toBe(true);
    expect(B.transacciones.length).toBe(antes + 1);
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c2")?.category).toBe("CLIENTE");
    // Idempotente.
    expect(await P.marcarClienteDeConsultaGanada("ws-1", "l1")).toBe(false);
  });

  it("una consulta de otro workspace o inexistente no toca nada; una falla no lanza", async () => {
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l1", clientId: "c2" });
    expect(await P.marcarClienteDeConsultaGanada("ws-2", "l1")).toBe(false);
    expect(await P.marcarClienteDeConsultaGanada("ws-1", "nada")).toBe(false);
    expect(B.datos.fotofficeContactoPerfil.find((p) => p.clientId === "c2")?.category).toBe("CONTACTO");
    const original = B.tablas.fotofficeConsulta.findFirst;
    B.tablas.fotofficeConsulta.findFirst = async () => {
      throw Object.assign(new Error("x"), { code: "P1001" });
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await P.marcarClienteDeConsultaGanada("ws-1", "l1")).toBe(false);
    err.mockRestore();
    B.tablas.fotofficeConsulta.findFirst = original;
  });
});
