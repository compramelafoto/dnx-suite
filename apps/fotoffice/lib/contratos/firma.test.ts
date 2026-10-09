import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async (slug: string) => (slug === "dnxestudio" ? "ws-1" : slug === "otro" ? "ws-2" : null),
}));

const F = await import("./firma");
const L = await import("./enlace");
const P = await import("./publico");
const { hashCodigo } = await import("./codigo");
const { aDataUrl, pngConTrazo, pngVacio } = await import("./png-prueba");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const SECRETO = "secreto-de-prueba";
const VENCE = new Date("2026-11-08T15:00:00.000Z");
const FIRMA_OK = aDataUrl(pngConTrazo());

const enviarInterno = vi.fn(async () => ({ status: "SENT" as const, providerId: "p" }));
const subir = vi.fn(async (_clave: string, _bytes: Uint8Array, _tipo: string): Promise<void> => undefined);
let codigos: string[] = [];
type SalidaCorreo = "ENVIADO" | "NO_ENVIADO";
let enviarCodigo = vi.fn(async (d: { codigo?: string | null }): Promise<SalidaCorreo> => {
  codigos.push(d.codigo ?? "");
  return "ENVIADO";
});

function deps(extra: Record<string, unknown> = {}, ahora: Date = AHORA) {
  return { ahora: () => ahora, secreto: SECRETO, enviarCodigo, subir, enviar: enviarInterno, appOrigin: "https://app.test", ...extra } as never;
}
const claveToken = (id: string) => L.tokenDeFirmante(id, VENCE, "clave-enlace");
const TOKEN1 = claveToken("f1");
const TOKEN2 = claveToken("f2");
const EVID = { ipHash: "iphash-1", userAgent: "Navegador/1" };

const firmante = (id = "f1") => B.datos.fotofficeContratoFirmante.find((f) => f.id === id)!;
const contrato = () => B.datos.fotofficeContrato[0]!;
const eventos = () => B.datos.fotofficeContratoEvento.map((e) => e.type);

function sembrarFirmante(id: string, orden: number, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeContratoFirmante", {
    id, workspaceId: "ws-1", versionId: "v1", orden, clientId: null, name: orden === 1 ? "Gómez, Ana" : "Pérez, Luis",
    docNumber: orden === 1 ? "DNI 30.111.222" : "DNI 99.888.777", email: orden === 1 ? "ana@x.com" : "luis@x.com",
    tokenHash: L.hashDeToken(claveToken(id)), tokenExpiresAt: VENCE, ...extra,
  });
}

beforeEach(() => {
  B.vaciar();
  B.ganchos.alEjecutarSql = null;
  codigos = [];
  enviarInterno.mockClear();
  subir.mockReset();
  subir.mockResolvedValue(undefined);
  enviarCodigo = vi.fn(async (d: { codigo?: string | null }): Promise<SalidaCorreo> => {
    codigos.push(d.codigo ?? "");
    return "ENVIADO";
  });
  B.agregar("fotofficePedido", { id: "p1", workspaceId: "ws-1", number: "P-7", clientId: "c1", status: "CONFIRMADO", totalArs: "1.00", items: [], totals: {} });
  B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "Contrato", status: "ENVIADO", bodyText: "x", currentVersionId: "v1", ownerUserId: 7 });
  B.agregar("fotofficeContratoVersion", { id: "v1", workspaceId: "ws-1", contratoId: "k1", number: 1, bodyText: "# Contrato C-1\n\nCláusula **primera**.", contentHash: "h", sentAt: AHORA });
  sembrarFirmante("f1", 1);
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "WORKSPACE_OWNER", createdAt: AHORA });
  B.agregar("user", { id: 7, email: "duena@dnx.test" });
});

/** Pide el código y lo verifica; devuelve el token para seguir. */
async function llegarAVerificado(token = TOKEN1, nombre = "Ana Gómez") {
  expect(await F.solicitarCodigo("ws-1", token, { nombre, acepto: true }, deps())).toMatchObject({ ok: true });
  const r = await F.verificarCodigo("ws-1", token, codigos.at(-1), deps());
  expect(r).toEqual({ ok: true });
}

describe("el token: cruzado, revocado y vencido", () => {
  it("un token de otra organización o inventado no abre nada", async () => {
    for (const t of [TOKEN1, "x".repeat(43), "corto", null, 5]) {
      expect(await F.solicitarCodigo("ws-2", t, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.enlaceInvalido });
    }
    expect(enviarCodigo).not.toHaveBeenCalled();
    expect(firmante().codeHash ?? null).toBeNull();
  });

  it("el token del firmante 2 no firma por el 1 ni al revés", async () => {
    sembrarFirmante("f2", 2);
    await llegarAVerificado(TOKEN1);
    // Con el token 2 todavía no verificó nada: no puede firmar con la verificación del 1.
    const r = await F.firmar("ws-1", TOKEN2, { nombre: "Ana Gómez", png: FIRMA_OK }, EVID, deps());
    expect(r).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noVerificado });
    expect(firmante("f2").signedAt ?? null).toBeNull();
  });

  it("un token de otro contrato (versión reemplazada) ya no sirve", async () => {
    B.agregar("fotofficeContratoVersion", { id: "v2", workspaceId: "ws-1", contratoId: "k1", number: 2, bodyText: "nuevo", contentHash: "h2", sentAt: AHORA });
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { revokedAt: AHORA });
    Object.assign(contrato(), { currentVersionId: "v2" });
    const r = await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps());
    expect(r).toEqual({ ok: false, error: F.MENSAJES_FIRMA.enlaceInvalido });
    expect(await F.rechazar("ws-1", TOKEN1, "no", EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.enlaceInvalido });
  });

  it("un enlace vencido, o de un contrato anulado, no sirve", async () => {
    const tarde = new Date(VENCE.getTime() + 1000);
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps({}, tarde))).toEqual({ ok: false, error: F.MENSAJES_FIRMA.enlaceInvalido });
    Object.assign(contrato(), { status: "ANULADO" });
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.enlaceInvalido });
  });
});

describe("solicitarCodigo", () => {
  it("valida nombre y tilde antes de tocar nada", async () => {
    for (const nombre of ["", "  ", "A", "x".repeat(121), null, 7]) {
      expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre, acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.nombre });
    }
    for (const acepto of [false, undefined, "true", 1]) {
      expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.acepto });
    }
    expect(enviarCodigo).not.toHaveBeenCalled();
    expect(eventos()).toEqual([]);
  });

  it("guarda sólo el hash (atado al firmante), manda el código y no lo deja en ningún lado", async () => {
    const r = await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "  Ana   Gómez ", acepto: true }, deps());
    expect(r).toMatchObject({ ok: true, venceEnMinutos: 15 });
    expect(r.ok && r.correo).toBe("a**@x.com");
    expect(codigos).toHaveLength(1);
    const codigo = codigos[0]!;
    expect(codigo).toMatch(/^[0-9]{6}$/);
    expect(enviarCodigo).toHaveBeenCalledWith(expect.objectContaining({ clave: "CONTRATO_CODIGO", para: "ana@x.com", workspaceId: "ws-1", contratoId: "k1" }));
    const f = firmante();
    expect(f).toMatchObject({ codeHash: hashCodigo(codigo, SECRETO, "f1"), codeAttempts: 0, codesSentInWindow: 1, typedName: "Ana Gómez", verifiedAt: null });
    expect(f.codeExpiresAt).toEqual(new Date(AHORA.getTime() + 15 * 60_000));
    // El código en claro no está en ninguna tabla.
    expect(JSON.stringify(B.datos)).not.toContain(`"${codigo}"`);
    expect(JSON.stringify(B.datos)).not.toMatch(new RegExp(`[^0-9]${codigo}[^0-9]`));
    expect(eventos()).toEqual(["CODIGO_ENVIADO"]);
    expect(B.datos.fotofficeContratoEvento[0]!.data).toEqual({ nroEnLaHora: 1, aceptoClausula: true });
  });

  it("límite de códigos: 3 por hora por firmante; pasada la hora vuelve a poder", async () => {
    for (let i = 0; i < 3; i++) expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toMatchObject({ ok: true });
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.topeCodigos });
    expect(codigos).toHaveLength(3);
    expect(firmante().codesSentInWindow).toBe(3);
    const mas = new Date(AHORA.getTime() + 61 * 60_000);
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps({}, mas))).toMatchObject({ ok: true });
    expect(firmante().codesSentInWindow).toBe(1);
  });

  it("el tope es de cada firmante: el otro tiene los suyos", async () => {
    sembrarFirmante("f2", 2);
    for (let i = 0; i < 3; i++) await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps());
    expect(await F.solicitarCodigo("ws-1", TOKEN2, { nombre: "Luis Pérez", acepto: true }, deps())).toMatchObject({ ok: true });
  });

  it("si el correo no sale lo dice (el pedido queda contado)", async () => {
    enviarCodigo = vi.fn(async (): Promise<SalidaCorreo> => "NO_ENVIADO");
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoNoSalio });
    expect(firmante().codesSentInWindow).toBe(1);
  });

  it("sin secreto configurado no emite nada", async () => {
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps({ secreto: null }))).toEqual({ ok: false, error: F.MENSAJES_FIRMA.sinConfigurar });
  });

  it("no emite si ya firmó, rechazó o el contrato está rechazado/firmado", async () => {
    Object.assign(firmante(), { signedAt: AHORA });
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaFirmo });
    Object.assign(firmante(), { signedAt: null, rejectedAt: AHORA });
    expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaRechazo });
    Object.assign(firmante(), { rejectedAt: null });
    for (const status of ["RECHAZADO", "FIRMADO", "BORRADOR"]) {
      Object.assign(contrato(), { status });
      expect(await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noAdmiteFirmas });
    }
    expect(codigos).toHaveLength(0);
  });
});

describe("verificarCodigo", () => {
  beforeEach(async () => {
    await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps());
  });
  const malo = () => (codigos[0] === "000000" ? "111111" : "000000");

  it("el código correcto verifica y se gasta", async () => {
    expect(await F.verificarCodigo("ws-1", TOKEN1, codigos[0], deps())).toEqual({ ok: true });
    expect(firmante()).toMatchObject({ verifiedAt: AHORA, codeHash: null, codeExpiresAt: null });
    expect(eventos()).toEqual(["CODIGO_ENVIADO", "CODIGO_VERIFICADO"]);
    // No sirve dos veces.
    expect(await F.verificarCodigo("ws-1", TOKEN1, codigos[0], deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.sinCodigo });
  });

  it("un código equivocado gasta un intento; al quinto se agota y ni el correcto sirve", async () => {
    const primero = await F.verificarCodigo("ws-1", TOKEN1, malo(), deps());
    expect(primero).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoIncorrecto, intentosRestantes: 4 });
    expect(firmante().codeAttempts).toBe(1);
    for (let i = 0; i < 3; i++) await F.verificarCodigo("ws-1", TOKEN1, malo(), deps());
    const quinto = await F.verificarCodigo("ws-1", TOKEN1, malo(), deps());
    expect(quinto).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoAgotado, intentosRestantes: 0 });
    expect(firmante().codeAttempts).toBe(5);
    expect(await F.verificarCodigo("ws-1", TOKEN1, codigos[0], deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoAgotado });
    expect(firmante().verifiedAt ?? null).toBeNull();
    expect(eventos().filter((e) => e === "CODIGO_FALLIDO")).toHaveLength(5);
    // Pidiendo uno nuevo vuelve a tener intentos.
    await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps());
    expect(await F.verificarCodigo("ws-1", TOKEN1, codigos[1], deps())).toEqual({ ok: true });
  });

  it("un código vencido no verifica ni gasta intentos", async () => {
    const tarde = new Date(AHORA.getTime() + 15 * 60_000);
    expect(await F.verificarCodigo("ws-1", TOKEN1, codigos[0], deps({}, tarde))).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoVencido });
    expect(firmante().codeAttempts).toBe(0);
    expect(firmante().verifiedAt ?? null).toBeNull();
  });

  it("formato inválido no gasta intentos; sin código pedido tampoco", async () => {
    for (const c of ["12345", "abcdef", "1234567", null, 123456]) {
      expect(await F.verificarCodigo("ws-1", TOKEN1, c, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.codigoFormato });
    }
    expect(firmante().codeAttempts).toBe(0);
    sembrarFirmante("f2", 2);
    expect(await F.verificarCodigo("ws-1", TOKEN2, "123456", deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.sinCodigo });
  });

  it("el código de un firmante no vale para el otro", async () => {
    sembrarFirmante("f2", 2);
    await F.solicitarCodigo("ws-1", TOKEN2, { nombre: "Luis Pérez", acepto: true }, deps());
    const r = await F.verificarCodigo("ws-1", TOKEN2, codigos[0], deps());
    // (Si por casualidad los dos códigos coincidieran, el hash atado al id los distingue igual.)
    expect(r.ok).toBe(codigos[0] === codigos[1]);
    expect(firmante("f2").verifiedAt === null).toBe(codigos[0] !== codigos[1]);
  });
});

describe("firmar", () => {
  const ok = (extra: Record<string, unknown> = {}) => ({ nombre: "Ana Gómez", png: FIRMA_OK, ...extra });

  it("sin verificar el código no se firma", async () => {
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noVerificado });
    await F.solicitarCodigo("ws-1", TOKEN1, { nombre: "Ana Gómez", acepto: true }, deps());
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noVerificado });
    expect(subir).not.toHaveBeenCalled();
    expect(firmante().signedAt ?? null).toBeNull();
  });

  it("la verificación vale 30 minutos", async () => {
    await llegarAVerificado();
    const justo = new Date(AHORA.getTime() + 30 * 60_000);
    const tarde = new Date(AHORA.getTime() + 30 * 60_000 + 1);
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps({}, tarde))).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noVerificado });
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps({}, justo))).toMatchObject({ ok: true });
  });

  it("exige el mismo nombre que escribió al pedir el código", async () => {
    await llegarAVerificado();
    expect(await F.firmar("ws-1", TOKEN1, ok({ nombre: "Otra Persona" }), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.otroNombre });
    expect(await F.firmar("ws-1", TOKEN1, ok({ nombre: "" }), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.nombre });
    expect(firmante().signedAt ?? null).toBeNull();
  });

  it("rechaza una firma inválida o vacía sin subir nada ni firmar", async () => {
    await llegarAVerificado();
    for (const png of [null, "hola", "data:image/png;base64,AAAA", aDataUrl(pngVacio()), 12]) {
      const r = await F.firmar("ws-1", TOKEN1, ok({ png }), EVID, deps());
      expect(r.ok, String(png).slice(0, 20)).toBe(false);
    }
    expect(subir).not.toHaveBeenCalled();
    expect(firmante().signedAt ?? null).toBeNull();
    expect(contrato().status).toBe("ENVIADO");
  });

  it("firma: guarda la evidencia, sube el PNG a la clave del firmante y el contrato queda FIRMADO", async () => {
    await llegarAVerificado();
    const r = await F.firmar("ws-1", TOKEN1, ok(), EVID, deps());
    expect(r).toEqual({ ok: true, completo: true, contratoId: "k1" });
    expect(subir).toHaveBeenCalledTimes(1);
    expect(subir).toHaveBeenCalledWith("contratos/ws-1/k1/f1.png", expect.any(Uint8Array), "image/png");
    expect(firmante()).toMatchObject({
      typedName: "Ana Gómez", signatureKey: "contratos/ws-1/k1/f1.png", signedAt: AHORA, ipHash: "iphash-1", userAgent: "Navegador/1", codeHash: null,
    });
    expect(contrato()).toMatchObject({ status: "FIRMADO", signedAt: AHORA });
    expect(eventos()).toEqual(["CODIGO_ENVIADO", "CODIGO_VERIFICADO", "FIRMADO"]);
  });

  it("con dos firmantes: el primero deja FIRMADO_PARCIAL y el segundo FIRMADO", async () => {
    sembrarFirmante("f2", 2);
    await llegarAVerificado(TOKEN1, "Ana Gómez");
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: true, completo: false, contratoId: "k1" });
    expect(contrato()).toMatchObject({ status: "FIRMADO_PARCIAL", signedAt: null });
    expect(enviarInterno).not.toHaveBeenCalled();
    await llegarAVerificado(TOKEN2, "Luis Pérez");
    expect(await F.firmar("ws-1", TOKEN2, ok({ nombre: "Luis Pérez" }), EVID, deps())).toEqual({ ok: true, completo: true, contratoId: "k1" });
    expect(contrato()).toMatchObject({ status: "FIRMADO", signedAt: AHORA });
    expect(subir.mock.calls.map((c) => c[0])).toEqual(["contratos/ws-1/k1/f1.png", "contratos/ws-1/k1/f2.png"]);
  });

  it("al quedar FIRMADO tilda la tarea del checklist (sin importar mayúsculas) y avisa al responsable", async () => {
    B.agregar("fotofficePedidoTarea", { id: "t1", workspaceId: "ws-1", pedidoId: "p1", position: 1, title: "  recoger FIRMA del contrato ", doneAt: null });
    B.agregar("fotofficePedidoTarea", { id: "t2", workspaceId: "ws-1", pedidoId: "p1", position: 2, title: "Pedir el anticipo", doneAt: null });
    B.agregar("fotofficePedidoTarea", { id: "t3", workspaceId: "ws-1", pedidoId: "p-otro", position: 1, title: "Recoger firma del contrato", doneAt: null });
    await llegarAVerificado();
    await F.firmar("ws-1", TOKEN1, ok(), EVID, deps());
    const t = (id: string) => B.datos.fotofficePedidoTarea.find((x) => x.id === id)!;
    expect(t("t1").doneAt).toEqual(AHORA);
    expect(t("t2").doneAt ?? null).toBeNull();
    expect(t("t3").doneAt ?? null).toBeNull();
    expect(enviarInterno).toHaveBeenCalledTimes(1);
    expect(enviarInterno).toHaveBeenCalledWith(expect.objectContaining({ to: "duena@dnx.test", subject: "El contrato C-1 quedó firmado" }));
  });

  it("sin tarea en el checklist firma igual", async () => {
    await llegarAVerificado();
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toMatchObject({ ok: true, completo: true });
  });

  it("firma duplicada: la segunda no firma ni sube nada", async () => {
    await llegarAVerificado();
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toMatchObject({ ok: true });
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaFirmo });
    expect(subir).toHaveBeenCalledTimes(1);
    expect(eventos().filter((e) => e === "FIRMADO")).toHaveLength(1);
  });

  it("carrera: si otra firma gana entre la lectura y la toma, ésta no escribe ni sube", async () => {
    await llegarAVerificado();
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      Object.assign(firmante(), { signedAt: new Date(AHORA.getTime() - 1000), signatureKey: "contratos/ws-1/k1/f1.png", typedName: "Ana Gómez" });
    };
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaFirmo });
    expect(subir).not.toHaveBeenCalled();
    expect(eventos()).not.toContain("FIRMADO");
  });

  it("carrera: si el UPDATE condicional no toma al firmante (otra transacción lo ganó), no sube la imagen", async () => {
    await llegarAVerificado();
    const real = B.tablas.fotofficeContratoFirmante.updateMany;
    B.tablas.fotofficeContratoFirmante.updateMany = async () => ({ count: 0 });
    try {
      expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaFirmo });
    } finally {
      B.tablas.fotofficeContratoFirmante.updateMany = real;
    }
    expect(subir).not.toHaveBeenCalled();
    expect(contrato().status).toBe("ENVIADO");
  });

  it("si falla la subida a R2 se deshace todo: no queda firmado sin imagen", async () => {
    await llegarAVerificado();
    subir.mockRejectedValueOnce(new Error("R2 caído"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.fallo });
    err.mockRestore();
    expect(firmante().signedAt ?? null).toBeNull();
    expect(firmante().signatureKey ?? null).toBeNull();
    expect(contrato().status).toBe("ENVIADO");
    // Se puede reintentar.
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toMatchObject({ ok: true });
  });

  it("no firma si el contrato ya fue rechazado por el otro firmante", async () => {
    sembrarFirmante("f2", 2);
    await llegarAVerificado(TOKEN1);
    expect(await F.rechazar("ws-1", TOKEN2, "No coincide el precio", EVID, deps())).toEqual({ ok: true });
    expect(await F.firmar("ws-1", TOKEN1, ok(), EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.noAdmiteFirmas });
  });
});

describe("rechazar", () => {
  it("el motivo es obligatorio y de hasta 1000 caracteres", async () => {
    for (const m of ["", "   ", null, 3, "x".repeat(1001)]) {
      expect(await F.rechazar("ws-1", TOKEN1, m, EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.motivo });
    }
    expect(contrato().status).toBe("ENVIADO");
    expect(await F.rechazar("ws-1", TOKEN1, "x".repeat(1000), EVID, deps())).toEqual({ ok: true });
  });

  it("deja el contrato RECHAZADO, guarda motivo y evidencia, avisa al responsable", async () => {
    expect(await F.rechazar("ws-1", TOKEN1, "  El monto no es el acordado  ", EVID, deps())).toEqual({ ok: true });
    expect(firmante()).toMatchObject({ rejectedAt: AHORA, rejectReason: "El monto no es el acordado", ipHash: "iphash-1", userAgent: "Navegador/1" });
    expect(contrato()).toMatchObject({ status: "RECHAZADO", rejectedAt: AHORA });
    expect(eventos()).toEqual(["RECHAZADO"]);
    expect(JSON.stringify(B.datos.fotofficeContratoEvento)).not.toContain("monto");
    expect(enviarInterno).toHaveBeenCalledWith(expect.objectContaining({ to: "duena@dnx.test" }));
  });

  it("no se puede rechazar dos veces ni después de firmar", async () => {
    await F.rechazar("ws-1", TOKEN1, "no", EVID, deps());
    expect(await F.rechazar("ws-1", TOKEN1, "no", EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaRechazo });
    Object.assign(firmante(), { rejectedAt: null, signedAt: AHORA });
    expect(await F.rechazar("ws-1", TOKEN1, "no", EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.yaFirmo });
  });

  it("carrera: el UPDATE condicional frena al segundo", async () => {
    const real = B.tablas.fotofficeContratoFirmante.updateMany;
    B.tablas.fotofficeContratoFirmante.updateMany = async () => ({ count: 0 });
    try {
      expect(await F.rechazar("ws-1", TOKEN1, "no", EVID, deps())).toEqual({ ok: false, error: F.MENSAJES_FIRMA.carrera });
    } finally {
      B.tablas.fotofficeContratoFirmante.updateMany = real;
    }
    expect(contrato().status).toBe("ENVIADO");
  });
});

describe("registrarVista", () => {
  it("la primera apertura marca viewedAt y deja un solo VISTO", async () => {
    const r = await L.resolverTokenFirmantePorWorkspace("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error("debía resolver");
    await F.registrarVista("ws-1", r, AHORA);
    expect(firmante().viewedAt).toEqual(AHORA);
    const otra = await L.resolverTokenFirmantePorWorkspace("ws-1", TOKEN1, AHORA);
    if (!otra.ok) throw new Error("debía resolver");
    await F.registrarVista("ws-1", otra, new Date(AHORA.getTime() + 5000));
    expect(firmante().viewedAt).toEqual(AHORA);
    expect(eventos()).toEqual(["VISTO"]);
  });
});

describe("la vista pública no filtra datos de otros", () => {
  it("de los otros firmantes sólo el nombre y si firmó; nada de correos, documentos, tokens, códigos ni IP", async () => {
    sembrarFirmante("f2", 2, { signedAt: AHORA, ipHash: "IPHASH-SECRETO-2", userAgent: "UA-SECRETO-2", codeHash: "CODEHASH-SECRETO", typedName: "Luis Pérez", signatureKey: "contratos/ws-1/k1/f2.png" });
    Object.assign(firmante(), { codeHash: "CODEHASH-1", ipHash: "IPHASH-1" });
    const r = await L.resolverTokenFirmantePorWorkspace("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error("debía resolver");
    const vista = await P.armarVistaFirma("ws-1", r, AHORA);
    expect(vista.firmantes).toEqual([
      { nombre: "Gómez, Ana", estado: "PENDIENTE", esUsted: true },
      { nombre: "Pérez, Luis", estado: "FIRMO", esUsted: false },
    ]);
    const texto = JSON.stringify(vista);
    for (const prohibido of [
      "luis@x.com", "99.888.777", "ana@x.com", L.hashDeToken(TOKEN2), L.hashDeToken(TOKEN1), TOKEN1, TOKEN2, "IPHASH", "UA-SECRETO", "CODEHASH",
      "contratos/ws-1/k1/f2.png", "signatureKey", "tokenHash", "ws-1", "\"f2\"", "\"f1\"",
    ]) {
      expect(texto, prohibido).not.toContain(prohibido);
    }
    expect(vista.puedeActuar).toBe(true);
    expect(vista.bloques.length).toBeGreaterThan(0);
    expect(vista.leyenda).toBe("Firma electrónica conforme a la Ley 25.506. Este documento no tiene firma digital con certificado.");
  });

  it("lo firmado se ve como firmado y no deja volver a actuar; el rechazo también", async () => {
    Object.assign(firmante(), { signedAt: AHORA, typedName: "Ana Gómez" });
    Object.assign(contrato(), { status: "FIRMADO", signedAt: AHORA });
    const r = await L.resolverTokenFirmantePorWorkspace("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error("debía resolver");
    const vista = await P.armarVistaFirma("ws-1", r, AHORA);
    expect(vista).toMatchObject({ puedeActuar: false, yo: { estado: "FIRMO" }, aviso: "El contrato quedó firmado por todas las partes." });
    expect(vista.yo.firmadoEn).toContain("2026");
  });
});
