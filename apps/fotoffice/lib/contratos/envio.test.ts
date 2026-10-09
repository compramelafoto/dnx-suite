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
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({ organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" }, contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null } }),
}));

const E = await import("./envio");
const L = await import("./enlace");
const { huellaTexto } = await import("./huella");
const { MENSAJES_CONTRATO: M } = await import("./acceso");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (contracts: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { contracts } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-09T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const deps = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };
const TEXTO = "# Contrato C-1\n\nEntre las partes se acuerda lo siguiente.";

const contrato = () => B.datos.fotofficeContrato[0]!;
const versiones = () => B.datos.fotofficeContratoVersion;
const firmantes = () => B.datos.fotofficeContratoFirmante;
const eventos = () => B.datos.fotofficeContratoEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "ana@x.com", docType: "DNI", docNumber: "30.111" });
  B.agregar("client", { id: "c2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Luis", lastName: "Pérez", email: "luis@x.com" });
  B.agregar("fotofficePedido", { id: "p1", workspaceId: "ws-1", number: "P-7", clientId: "c1", status: "CONFIRMADO", totalArs: "1.00", items: [], totals: {} });
  B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", companyName: "Estudio Luz" });
  B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "Contrato", status: "BORRADOR", bodyText: TEXTO });
});

describe("enviar", () => {
  it("crea la versión 1 con su huella, el firmante con su token y deja el contrato ENVIADO", async () => {
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r).toMatchObject({ ok: true, version: 1, correccion: false });
    if (!r.ok) return;
    expect(versiones()).toHaveLength(1);
    expect(versiones()[0]).toMatchObject({ id: r.versionId, contratoId: "k1", number: 1, bodyText: TEXTO, contentHash: huellaTexto(TEXTO), sentAt: AHORA, revokedAt: null });
    expect(firmantes()).toHaveLength(1);
    const f = firmantes()[0]!;
    expect(f).toMatchObject({ versionId: r.versionId, orden: 1, clientId: "c1", name: "Gómez, Ana", docNumber: "DNI 30.111", email: "ana@x.com" });
    const vence = new Date(AHORA.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(f.tokenExpiresAt).toEqual(vence);
    expect(f.tokenHash).toBe(L.hashDeToken(L.tokenDeFirmante(f.id as string, vence, CLAVE)));
    expect(contrato()).toMatchObject({ status: "ENVIADO", currentVersionId: r.versionId, sentAt: AHORA });
    expect(eventos()).toEqual(["ENVIADO"]);
    expect(B.datos.fotofficeContratoEvento[0]!.data).toEqual({ version: 1, firmantes: 1, correccion: false });
  });

  it("con dos contratantes crea dos firmantes, cada uno con su token", async () => {
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r.ok && r.firmantes.map((f) => f.orden)).toEqual([1, 2]);
    expect(firmantes().map((f) => f.email)).toEqual(["ana@x.com", "luis@x.com"]);
    expect(new Set(firmantes().map((f) => f.tokenHash)).size).toBe(2);
  });

  it("permisos: sólo Gestionar; Ver y los de otra organización no", async () => {
    expect(await E.enviar(SOLO_VER, "k1", {}, deps)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await E.enviar(ctx("NONE"), "k1", {}, deps)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await E.enviar(OTRO_WS, "k1", {}, deps)).toEqual({ ok: false, error: M.contratoNoExiste });
    expect(await E.enviar(GESTIONA, 3, {}, deps)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(versiones()).toHaveLength(0);
    expect(contrato().status).toBe("BORRADOR");
  });

  it("frena el texto con variables sin completar o textos por completar", async () => {
    contrato().bodyText = "Hola [contratante1_nombre] y [otra_cosa]";
    const a = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(a.ok).toBe(false);
    expect(!a.ok && a.error).toContain("[contratante1_nombre]");
    contrato().bodyText = "Firma: [COMPLETAR NOMBRE DEL TESTIGO]";
    const b = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(!b.ok && b.error).toContain("mayúsculas");
    contrato().bodyText = "Bloque [si:evento] sin cerrar";
    expect((await E.enviar(GESTIONA, "k1", {}, deps)).ok).toBe(false);
    contrato().bodyText = "   ";
    expect((await E.enviar(GESTIONA, "k1", {}, deps)).ok).toBe(false);
    expect(versiones()).toHaveLength(0);
    expect(firmantes()).toHaveLength(0);
    expect(contrato().status).toBe("BORRADOR");
  });

  it("frena si algún contratante no tiene un correo válido, y dice quién", async () => {
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    B.datos.client[1]!.email = "no-es-un-correo";
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("Pérez, Luis");
    B.datos.client[1]!.email = "luis@x.com";
    B.datos.client[0]!.email = null;
    expect((await E.enviar(GESTIONA, "k1", {}, deps)).ok).toBe(false);
    expect(versiones()).toHaveLength(0);
  });

  it("frena sin los datos de la empresa o sin clave para los enlaces", async () => {
    B.datos.fotofficeContratoAjustes[0]!.companyName = "  ";
    expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.sinEmpresa });
    B.datos.fotofficeContratoAjustes.length = 0;
    expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.sinEmpresa });
    B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", companyName: "Estudio Luz" });
    expect(await E.enviar(GESTIONA, "k1", {}, { ...deps, clave: null })).toEqual({ ok: false, error: M.sinClaveEnlace });
    expect(versiones()).toHaveLength(0);
  });

  it("enviar dos veces seguidas deja una sola versión", async () => {
    const a = await E.enviar(GESTIONA, "k1", {}, deps);
    const b = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(a.ok).toBe(true);
    expect(b).toEqual({ ok: false, error: M.faltaTextoCorregido });
    expect(versiones()).toHaveLength(1);
    expect(firmantes()).toHaveLength(1);
    expect(eventos()).toEqual(["ENVIADO"]);
  });

  it("carrera: otro envío gana mientras éste espera el candado, y no queda nada duplicado", async () => {
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      // Otra transacción envió el contrato justo antes.
      B.agregarDeOtraTransaccion("fotofficeContratoVersion", { id: "v-otro", workspaceId: "ws-1", contratoId: "k1", number: 1, bodyText: TEXTO, contentHash: huellaTexto(TEXTO), sentAt: AHORA });
      Object.assign(contrato(), { status: "ENVIADO", currentVersionId: "v-otro" });
    };
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r).toEqual({ ok: false, error: M.yaEnviado });
    expect(versiones()).toHaveLength(1);
    expect(firmantes()).toHaveLength(0);
    expect(eventos()).toEqual([]);
  });

  it("carrera: si el índice único de versiones frena a uno, el error es el de la carrera y no se deja nada", async () => {
    const real = B.tablas.fotofficeContratoVersion.create;
    B.tablas.fotofficeContratoVersion.create = async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    };
    try {
      expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.carrera });
    } finally {
      B.tablas.fotofficeContratoVersion.create = real;
    }
    expect(firmantes()).toHaveLength(0);
    expect(contrato().status).toBe("BORRADOR");
  });

  it("carrera: si el contrato cambia entre la lectura y la toma, no se pisa", async () => {
    const real = B.tablas.fotofficeContrato.updateMany;
    B.tablas.fotofficeContrato.updateMany = async () => ({ count: 0 });
    try {
      expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.carrera });
    } finally {
      B.tablas.fotofficeContrato.updateMany = real;
    }
    expect(versiones()).toHaveLength(0);
    expect(firmantes()).toHaveLength(0);
  });

  it("anulado o firmado no se envían", async () => {
    for (const estado of ["ANULADO", "FIRMADO"]) {
      contrato().status = estado;
      expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.noSeEnvia });
    }
    expect(versiones()).toHaveLength(0);
  });
});

describe("lectura dentro del candado", () => {
  it("si el borrador se edita mientras se espera el candado, se congela el texto nuevo (no el viejo)", async () => {
    const EDITADO = "# Contrato C-1\n\nTexto editado a último momento.";
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      Object.assign(contrato(), { bodyText: EDITADO });
    };
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r.ok).toBe(true);
    expect(versiones()[0]).toMatchObject({ bodyText: EDITADO, contentHash: huellaTexto(EDITADO) });
    expect(contrato().bodyText).toBe(EDITADO);
  });

  it("si lo editado a último momento ya no es válido, no se envía", async () => {
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      Object.assign(contrato(), { bodyText: "Falta [algo]" });
    };
    expect((await E.enviar(GESTIONA, "k1", {}, deps)).ok).toBe(false);
    expect(versiones()).toHaveLength(0);
    expect(contrato().status).toBe("BORRADOR");
  });

  it("si el contratante pierde su correo mientras se espera el candado, no se envía", async () => {
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      Object.assign(B.datos.client[0]!, { email: null });
    };
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r.ok).toBe(false);
    expect(versiones()).toHaveLength(0);
  });
});

describe("variables sin completar: pide confirmar", () => {
  beforeEach(() => {
    B.agregar("fotofficeContratoPlantilla", { id: "t1", workspaceId: "ws-1", name: "Plantilla", body: "Entre [contratante1_nombre] y [contratante2_nombre].", isActive: true, order: 0 });
    Object.assign(contrato(), { templateId: "t1" });
  });

  it("devuelve la lista y no envía; con la confirmación envía", async () => {
    const r = await E.enviar(GESTIONA, "k1", {}, deps);
    expect(r).toMatchObject({ ok: false, vacias: ["contratante2_nombre"] });
    expect(versiones()).toHaveLength(0);
    expect(contrato().status).toBe("BORRADOR");
    const ok = await E.enviar(GESTIONA, "k1", { confirmarVacias: true }, deps);
    expect(ok.ok).toBe(true);
    expect(versiones()).toHaveLength(1);
  });

  it("sin variables vacías no pide nada", async () => {
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    expect((await E.enviar(GESTIONA, "k1", {}, deps)).ok).toBe(true);
  });
});

describe("corregir un contrato rechazado", () => {
  it("pide el texto; con él crea la versión 2, revoca la 1, vuelve a ENVIADO y limpia el rechazo", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    Object.assign(firmantes()[0]!, { rejectedAt: AHORA, rejectReason: "No estoy de acuerdo" });
    Object.assign(contrato(), { status: "RECHAZADO", rejectedAt: AHORA });
    expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.faltaTextoCorregido });

    const r = await E.enviar(GESTIONA, "k1", { textoCorregido: "# Contrato C-1\n\nCon el cambio pedido." }, deps);
    expect(r).toMatchObject({ ok: true, version: 2, correccion: true });
    expect(contrato()).toMatchObject({ status: "ENVIADO", rejectedAt: null });
    expect(versiones().map((v) => [v.number, v.revokedAt])).toEqual([[1, AHORA], [2, null]]);
    const nuevos = firmantes().filter((f) => f.versionId === (r.ok ? r.versionId : ""));
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0]).toMatchObject({ rejectedAt: null, signedAt: null });
  });

  it("un rechazado se puede reenviar aunque el texto sea el mismo", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    Object.assign(contrato(), { status: "RECHAZADO", rejectedAt: AHORA });
    const r = await E.enviar(GESTIONA, "k1", { textoCorregido: TEXTO }, deps);
    expect(r).toMatchObject({ ok: true, version: 2 });
  });
});

describe("corregir (versión nueva)", () => {
  const CORREGIDO = "# Contrato C-1\n\nTexto corregido.";

  it("crea la versión 2, revoca la 1 y los enlaces viejos dejan de servir", async () => {
    const a = await E.enviar(GESTIONA, "k1", {}, deps);
    if (!a.ok) throw new Error(a.error);
    const viejo = firmantes()[0]!;
    const tokenViejo = L.tokenDeFirmante(viejo.id as string, viejo.tokenExpiresAt as Date, CLAVE);
    expect((await L.resolverTokenFirmante("dnxestudio", tokenViejo, AHORA)).ok).toBe(true);

    const b = await E.enviar(GESTIONA, "k1", { textoCorregido: CORREGIDO }, deps);
    expect(b).toMatchObject({ ok: true, version: 2, correccion: true });
    expect(versiones().map((v) => [v.number, v.revokedAt])).toEqual([[1, AHORA], [2, null]]);
    expect(versiones()[0]!.bodyText).toBe(TEXTO);
    expect(versiones()[1]).toMatchObject({ bodyText: CORREGIDO, contentHash: huellaTexto(CORREGIDO) });
    expect(firmantes()).toHaveLength(2);
    expect(contrato()).toMatchObject({ status: "ENVIADO", bodyText: CORREGIDO, currentVersionId: b.ok ? b.versionId : "" });
    expect(eventos()).toEqual(["ENVIADO", "VERSION_REVOCADA", "ENVIADO"]);

    expect(await L.resolverTokenFirmante("dnxestudio", tokenViejo, AHORA)).toEqual({ ok: false, motivo: "REEMPLAZADO" });
    const nuevo = firmantes()[1]!;
    const tokenNuevo = L.tokenDeFirmante(nuevo.id as string, nuevo.tokenExpiresAt as Date, CLAVE);
    const res = await L.resolverTokenFirmante("dnxestudio", tokenNuevo, AHORA);
    expect(res).toMatchObject({ ok: true, version: { number: 2, bodyText: CORREGIDO } });
  });

  it("corrige también un contrato firmado por una parte: la firma queda en la versión vieja y vuelve a ENVIADO", async () => {
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    await E.enviar(GESTIONA, "k1", {}, deps);
    Object.assign(firmantes()[0]!, { signedAt: AHORA, typedName: "Ana Gómez" });
    contrato().status = "FIRMADO_PARCIAL";
    const b = await E.enviar(GESTIONA, "k1", { textoCorregido: CORREGIDO }, deps);
    expect(b).toMatchObject({ ok: true, version: 2 });
    expect(contrato().status).toBe("ENVIADO");
    expect(firmantes()[0]!.signedAt).toEqual(AHORA);
    expect(firmantes().filter((f) => f.versionId === (b.ok ? b.versionId : "")).every((f) => f.signedAt === null)).toBe(true);
  });

  it("corregir con el mismo texto de la versión vigente no hace una versión nueva", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    expect(await E.enviar(GESTIONA, "k1", { textoCorregido: `${TEXTO}\n` }, deps)).toEqual({ ok: false, error: M.sinCambios });
    expect(versiones()).toHaveLength(1);
    expect(versiones()[0]!.revokedAt).toBeNull();
  });

  it("pide el texto corregido, y lo revisa igual que un envío común", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    expect(await E.enviar(GESTIONA, "k1", {}, deps)).toEqual({ ok: false, error: M.faltaTextoCorregido });
    const r = await E.enviar(GESTIONA, "k1", { textoCorregido: "Falta [algo]" }, deps);
    expect(r.ok).toBe(false);
    expect(versiones()).toHaveLength(1);
    expect(versiones()[0]!.revokedAt).toBeNull();
  });

  it("carrera entre dos correcciones: gana una sola", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      B.agregarDeOtraTransaccion("fotofficeContratoVersion", { id: "v2-otro", workspaceId: "ws-1", contratoId: "k1", number: 2, bodyText: CORREGIDO, contentHash: "h", sentAt: AHORA });
      versiones()[0]!.revokedAt = AHORA;
      contrato().currentVersionId = "v2-otro";
    };
    const r = await E.enviar(GESTIONA, "k1", { textoCorregido: CORREGIDO }, deps);
    expect(r).toEqual({ ok: false, error: M.sinCambios });
    expect(versiones()).toHaveLength(2);
    expect(firmantes()).toHaveLength(1);
  });
});

describe("reenviar el enlace", () => {
  it("cambia el token: el anterior deja de servir y el nuevo sí", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    const f = firmantes()[0]!;
    const viejo = L.tokenDeFirmante(f.id as string, f.tokenExpiresAt as Date, CLAVE);
    const mas = { ...deps, ahora: () => new Date(AHORA.getTime() + 3 * 24 * 60 * 60 * 1000) };
    const r = await E.reenviarEnlace(GESTIONA, f.id, mas);
    expect(r).toEqual({ ok: true, firmanteId: f.id, contratoId: "k1" });
    expect(f.tokenExpiresAt).toEqual(new Date(mas.ahora().getTime() + 30 * 24 * 60 * 60 * 1000));
    expect(await L.resolverTokenFirmante("dnxestudio", viejo, AHORA)).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
    const nuevo = L.tokenDeFirmante(f.id as string, f.tokenExpiresAt as Date, CLAVE);
    expect((await L.resolverTokenFirmante("dnxestudio", nuevo, AHORA)).ok).toBe(true);
    expect(eventos()).toEqual(["ENVIADO", "REENVIADO"]);
  });

  it("no a quien ya firmó o rechazó, ni de una versión reemplazada, ni con contrato anulado", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    const f = firmantes()[0]!;
    f.signedAt = AHORA;
    expect(await E.reenviarEnlace(GESTIONA, f.id, deps)).toEqual({ ok: false, error: M.noSeReenvia });
    f.signedAt = null;
    f.rejectedAt = AHORA;
    expect(await E.reenviarEnlace(GESTIONA, f.id, deps)).toEqual({ ok: false, error: M.noSeReenvia });
    f.rejectedAt = null;
    contrato().status = "ANULADO";
    expect(await E.reenviarEnlace(GESTIONA, f.id, deps)).toEqual({ ok: false, error: M.noSeReenvia });
    contrato().status = "ENVIADO";
    await E.enviar(GESTIONA, "k1", { textoCorregido: "Otro texto" }, deps);
    expect(await E.reenviarEnlace(GESTIONA, f.id, deps)).toEqual({ ok: false, error: M.noSeReenvia });
  });

  it("permisos y aislamiento", async () => {
    await E.enviar(GESTIONA, "k1", {}, deps);
    const id = firmantes()[0]!.id;
    expect(await E.reenviarEnlace(SOLO_VER, id, deps)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await E.reenviarEnlace(OTRO_WS, id, deps)).toEqual({ ok: false, error: M.firmanteNoExiste });
    expect(await E.reenviarEnlace(GESTIONA, 4, deps)).toEqual({ ok: false, error: M.datosInvalidos });
  });
});

describe("resolver el token del firmante", () => {
  async function enviado() {
    await E.enviar(GESTIONA, "k1", {}, deps);
    const f = firmantes()[0]!;
    return { f, token: L.tokenDeFirmante(f.id as string, f.tokenExpiresAt as Date, CLAVE) };
  }

  it("devuelve firmante, contrato y versión; no expone el código ni el hash", async () => {
    const { token } = await enviado();
    const r = await L.resolverTokenFirmante("dnxestudio", token, AHORA);
    expect(r).toMatchObject({ ok: true, workspaceId: "ws-1", firmante: { name: "Gómez, Ana", email: "ana@x.com" }, contrato: { number: "C-1", status: "ENVIADO" }, version: { number: 1 } });
    expect(JSON.stringify(r)).not.toMatch(/tokenHash|codeHash/);
  });

  it("sirve sólo en la organización del slug, con forma de token y sin vencer", async () => {
    const { token } = await enviado();
    expect(await L.resolverTokenFirmante("otro", token, AHORA)).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
    expect(await L.resolverTokenFirmante("no-existe", token, AHORA)).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
    expect(await L.resolverTokenFirmante("dnxestudio", "corto", AHORA)).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
    expect(await L.resolverTokenFirmante("dnxestudio", 5, AHORA)).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
    expect(await L.resolverTokenFirmante("dnxestudio", token, new Date(AHORA.getTime() + 31 * 24 * 60 * 60 * 1000))).toEqual({ ok: false, motivo: "VENCIDO" });
  });

  it("un contrato anulado o firmado en papel no se firma más", async () => {
    const { token } = await enviado();
    contrato().status = "ANULADO";
    expect(await L.resolverTokenFirmante("dnxestudio", token, AHORA)).toEqual({ ok: false, motivo: "ANULADO" });
    contrato().status = "FIRMADO";
    contrato().manualSignedAt = AHORA;
    expect(await L.resolverTokenFirmante("dnxestudio", token, AHORA)).toEqual({ ok: false, motivo: "FIRMADO_EN_PAPEL" });
  });
});
