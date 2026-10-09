import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const R2 = vi.hoisted(() => ({ subirObjetoContrato: vi.fn(), borrarObjetoContrato: vi.fn(), urlDeLecturaContrato: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", () => R2);

const A = await import("./ajustes");
const { MENSAJES_CONTRATO: M } = await import("./acceso");
const { CLAUSULA_CONSENTIMIENTO_INICIAL } = await import("./clausula");

const ctx = (role: string) => ({ workspaceId: "ws-1", userId: 1, userLabel: "Ana", role, acceso: { role, levels: { contracts: "MANAGE" } } as never });
const DUENO = ctx("WORKSPACE_OWNER");
const BUENOS = { reminderEnabled: true, reminderDays: 5, companyName: "Estudio Luz", companyTaxId: "20-1-3", companyAddress: "Mitre 1", consentClause: "" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  R2.subirObjetoContrato.mockResolvedValue(undefined);
  R2.borrarObjetoContrato.mockResolvedValue(undefined);
});

describe("ajustes de contratos", () => {
  it("sin fila valen los de fábrica: recordatorio apagado a los 3 días, cláusula por omisión", async () => {
    const a = await A.leerAjustesContratos("ws-1");
    expect(a).toMatchObject({ reminderEnabled: false, reminderDays: 3, companySignatureKey: null, consentClause: null });
    expect(A.clausulaVigente(a)).toBe(CLAUSULA_CONSENTIMIENTO_INICIAL);
  });

  it("la cláusula por omisión habla de firma electrónica (Ley 25.506 art. 5, CCyC 286 y 288) y no de firma digital", () => {
    expect(CLAUSULA_CONSENTIMIENTO_INICIAL).toMatch(/firma electrónica/);
    expect(CLAUSULA_CONSENTIMIENTO_INICIAL).toMatch(/artículo 5 de la Ley 25\.506/);
    expect(CLAUSULA_CONSENTIMIENTO_INICIAL).toMatch(/286 y 288/);
    expect(CLAUSULA_CONSENTIMIENTO_INICIAL.toLowerCase()).not.toContain("firma digital");
  });

  it("el dueño guarda empresa, recordatorio y cláusula propia; una vacía vuelve a la de fábrica", async () => {
    expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, consentClause: "Acepto." })).toEqual({ ok: true });
    expect(B.datos.fotofficeContratoAjustes[0]).toMatchObject({ companyName: "Estudio Luz", reminderEnabled: true, reminderDays: 5, consentClause: "Acepto." });
    expect(A.clausulaVigente(await A.leerAjustesContratos("ws-1"))).toBe("Acepto.");
    expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, reminderDays: "30" })).toEqual({ ok: true });
    expect(B.datos.fotofficeContratoAjustes).toHaveLength(1);
    expect(B.datos.fotofficeContratoAjustes[0]).toMatchObject({ consentClause: null, reminderDays: 30 });
  });

  it("no pisa la firma de la empresa", async () => {
    B.agregar("fotofficeContratoAjustes", { id: "aj", workspaceId: "ws-1", companySignatureKey: "contratos/ws-1/empresa/firma-x.png" });
    await A.guardarAjustesContratos(DUENO, BUENOS);
    expect(B.datos.fotofficeContratoAjustes[0]).toMatchObject({ companySignatureKey: "contratos/ws-1/empresa/firma-x.png", reminderDays: 5 });
  });

  it("los días van de 1 a 30, enteros; el interruptor es booleano", async () => {
    for (const reminderDays of [0, 31, 1.5, "x", "", null, undefined]) {
      expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, reminderDays })).toEqual({ ok: false, error: M.recordatorioDias });
    }
    expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, reminderEnabled: "si" })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await A.guardarAjustesContratos(DUENO, null)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, companyName: "x".repeat(121) })).toEqual({ ok: false, error: M.empresaNombre });
    expect(await A.guardarAjustesContratos(DUENO, { ...BUENOS, consentClause: "x".repeat(3001) })).toEqual({ ok: false, error: M.clausula });
  });

  it("sólo `configurar`: un integrante con Gestionar no puede", async () => {
    expect(await A.guardarAjustesContratos(ctx("STAFF"), BUENOS)).toEqual({ ok: false, error: M.sinPermiso });
    expect(B.datos.fotofficeContratoAjustes).toHaveLength(0);
  });
});

describe("firma de la empresa", () => {
  it("reconoce PNG y JPG por los bytes, no por el nombre", () => {
    expect(A.tipoDeImagenFirma(PNG)).toEqual({ tipo: "image/png", extension: "png" });
    expect(A.tipoDeImagenFirma(JPG)).toEqual({ tipo: "image/jpeg", extension: "jpg" });
    expect(A.tipoDeImagenFirma(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(A.tipoDeImagenFirma(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("sube al prefijo del workspace, guarda la clave y borra la anterior", async () => {
    expect(await A.guardarFirmaEmpresa(DUENO, PNG)).toEqual({ ok: true });
    const clave1 = B.datos.fotofficeContratoAjustes[0].companySignatureKey as string;
    expect(clave1).toMatch(/^contratos\/ws-1\/empresa\/firma-[0-9a-f-]{36}\.png$/);
    expect(R2.subirObjetoContrato).toHaveBeenCalledWith(clave1, PNG, "image/png");
    expect(R2.borrarObjetoContrato).not.toHaveBeenCalled();
    expect(await A.guardarFirmaEmpresa(DUENO, JPG)).toEqual({ ok: true });
    const clave2 = B.datos.fotofficeContratoAjustes[0].companySignatureKey as string;
    expect(clave2).toMatch(/\.jpg$/);
    expect(R2.borrarObjetoContrato).toHaveBeenCalledWith(clave1);
  });

  it("rechaza vacío, más de 1 MB, otro tipo y a quien no puede configurar; si el almacén falla no guarda nada", async () => {
    expect(await A.guardarFirmaEmpresa(DUENO, new Uint8Array())).toEqual({ ok: false, error: M.firmaVacia });
    expect(await A.guardarFirmaEmpresa(DUENO, new Uint8Array(1024 * 1024 + 1))).toEqual({ ok: false, error: M.firmaTamano });
    expect(await A.guardarFirmaEmpresa(DUENO, new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false, error: M.firmaTipo });
    expect(await A.guardarFirmaEmpresa(ctx("STAFF"), PNG)).toEqual({ ok: false, error: M.sinPermiso });
    R2.subirObjetoContrato.mockRejectedValueOnce(new Error("r2"));
    expect(await A.guardarFirmaEmpresa(DUENO, PNG)).toEqual({ ok: false, error: M.firmaSinAlmacen });
    expect(B.datos.fotofficeContratoAjustes).toHaveLength(0);
  });

  it("quitar borra la clave y el objeto; sin firma no hace nada", async () => {
    expect(await A.quitarFirmaEmpresa(DUENO)).toEqual({ ok: true });
    expect(R2.borrarObjetoContrato).not.toHaveBeenCalled();
    B.agregar("fotofficeContratoAjustes", { id: "aj", workspaceId: "ws-1", companySignatureKey: "contratos/ws-1/empresa/firma-x.png" });
    expect(await A.quitarFirmaEmpresa(ctx("STAFF"))).toEqual({ ok: false, error: M.sinPermiso });
    expect(await A.quitarFirmaEmpresa(DUENO)).toEqual({ ok: true });
    expect(B.datos.fotofficeContratoAjustes[0].companySignatureKey).toBeNull();
    expect(R2.borrarObjetoContrato).toHaveBeenCalledWith("contratos/ws-1/empresa/firma-x.png");
  });

  it("la URL de vista previa es null sin firma o si el almacén falla", async () => {
    expect(await A.urlFirmaEmpresa(null)).toBeNull();
    R2.urlDeLecturaContrato.mockRejectedValueOnce(new Error("r2"));
    expect(await A.urlFirmaEmpresa("contratos/ws-1/empresa/firma-x.png")).toBeNull();
    R2.urlDeLecturaContrato.mockResolvedValueOnce("https://firmado");
    expect(await A.urlFirmaEmpresa("contratos/ws-1/empresa/firma-x.png")).toBe("https://firmado");
  });
});
