import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acciones de Configuración → Plantillas contra el catálogo real y la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ role: vi.fn(), workspaceId: vi.fn(), revalidate: vi.fn(), modulo: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: H.workspaceId(), name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");

type Accion = (p: undefined, f: FormData) => Promise<{ error: string | null; ok?: string }>;

function fd(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const plantillas = () => B.datos.fotofficeMessageTemplate;
const APAGADO = "Ese módulo no está activo.";

async function crear(nombre: string, extra: Record<string, string> = {}) {
  const r = await A.crearPlantillaAction(
    undefined,
    fd({ canal: "EMAIL", tipo: "CLIENTE", nombre, asunto: "Hola [nombre]", cuerpo: "Hola [nombre]", ...extra }),
  );
  expect(r.error).toBeNull();
  return plantillas().find((p) => p.name === nombre)!.id as string;
}

function automatico(workspaceId = "ws-1") {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId, channel: "EMAIL", entityType: "CONSULTA", name: "Respuesta automática a una consulta nueva",
    subject: "Recibimos tu consulta", body: "Hola", systemKey: "CONSULTA_AUTORESPUESTA", enabled: false,
  }).id as string;
}

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.role.mockReturnValue("WORKSPACE_ADMIN");
  H.workspaceId.mockReturnValue("ws-1");
  H.modulo.mockResolvedValue(true);
});

describe("Configuración → Plantillas (acciones)", () => {
  it("sin `configurar` ninguna acción toca la base", async () => {
    const id = await crear("Algo");
    automatico();
    const antes = JSON.stringify(B.datos);
    H.role.mockReturnValue("STAFF");
    const acciones = Object.entries(A).filter(([, v]) => typeof v === "function") as [string, Accion][];
    expect(acciones).toHaveLength(8);
    const f = fd({
      id, canal: "EMAIL", tipo: "CLIENTE", nombre: "X", asunto: "a", cuerpo: "b", orden: [id],
      clave: "CONSULTA_AUTORESPUESTA", enabled: "1",
    });
    for (const [n, accion] of acciones) expect((await accion(undefined, f)).error, n).toMatch(/dueño o un administrador/);
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("crea con el workspace de la sesión y revalida la pantalla", async () => {
    const id = await crear("Presupuesto", { workspaceId: "otro" });
    expect(plantillas().find((p) => p.id === id)).toMatchObject({
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", subject: "Hola [nombre]", body: "Hola [nombre]",
    });
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/plantillas");
  });

  it("WhatsApp sin asunto", async () => {
    const r = await A.crearPlantillaAction(undefined, fd({ canal: "WHATSAPP", tipo: "GENERAL", nombre: "Hola", cuerpo: "Hola [nombre]" }));
    expect(r).toEqual({ error: null, ok: "Plantilla agregada." });
    expect(plantillas()[0]).toMatchObject({ channel: "WHATSAPP", subject: null });
  });

  it("una variable de otra ficha vuelve con su posición y el campo donde está", async () => {
    const r = await A.crearPlantillaAction(
      undefined,
      fd({ canal: "EMAIL", tipo: "SOCIO", nombre: "X", asunto: "Hola", cuerpo: "Tu consulta [consulta_numero]" }),
    );
    expect(r.error).toMatch(/consulta_numero/);
    expect(r.errores).toEqual([expect.objectContaining({ campo: "cuerpo", posicion: 12, variable: "consulta_numero" })]);
    expect(plantillas()).toHaveLength(0);
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("editar: cambia nombre, ficha y texto; los errores llegan con posición", async () => {
    const id = await crear("Hola");
    const ok = await A.editarPlantillaAction(
      undefined,
      fd({ id, tipo: "GENERAL", nombre: "Saludo", asunto: "Hola [nombre]", cuerpo: "Chau [nombre]" }),
    );
    expect(ok).toEqual({ error: null, ok: "Cambios guardados." });
    expect(plantillas().find((p) => p.id === id)).toMatchObject({ name: "Saludo", entityType: "GENERAL", body: "Chau [nombre]" });
    const mal = await A.editarPlantillaAction(undefined, fd({ id, tipo: "GENERAL", nombre: "Saludo", asunto: "[socio_numero]", cuerpo: "x" }));
    expect(mal.errores).toEqual([expect.objectContaining({ campo: "asunto", posicion: 0 })]);
  });

  it("ids de otro workspace: no encontrada y nada cambia", async () => {
    const id = await crear("Hola");
    H.workspaceId.mockReturnValue("ws-2");
    const antes = JSON.stringify(B.datos);
    for (const accion of [A.editarPlantillaAction, A.duplicarPlantillaAction, A.archivarPlantillaAction, A.borrarPlantillaAction]) {
      const r = await accion(undefined, fd({ id, tipo: "CLIENTE", nombre: "X", asunto: "a", cuerpo: "b" }));
      expect(r.error).toBe("No encontramos esa plantilla.");
    }
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("duplica, reordena, archiva, desarchiva y borra", async () => {
    const a = await crear("A");
    const b = await crear("B");
    expect((await A.duplicarPlantillaAction(undefined, fd({ id: a }))).error).toBeNull();
    expect(plantillas()).toHaveLength(3);
    const copia = plantillas().find((p) => p.id !== a && p.id !== b)!.id as string;
    expect((await A.reordenarPlantillasAction(undefined, fd({ canal: "EMAIL", orden: [copia, b, a] }))).error).toBeNull();
    expect(plantillas().find((p) => p.id === copia)!.order).toBe(0);
    expect((await A.archivarPlantillaAction(undefined, fd({ id: b }))).ok).toBe("Plantilla archivada.");
    expect(plantillas().find((p) => p.id === b)!.archivedAt).not.toBeNull();
    expect((await A.desarchivarPlantillaAction(undefined, fd({ id: b }))).ok).toBe("Plantilla desarchivada.");
    expect((await A.borrarPlantillaAction(undefined, fd({ id: copia }))).ok).toBe("Plantilla borrada.");
    expect(plantillas()).toHaveLength(2);
  });

  it("una plantilla usada no se borra", async () => {
    const id = await crear("Usada");
    B.agregar("fotofficeMessage", { workspaceId: "ws-1", templateId: id, channel: "EMAIL", status: "SENT" });
    const r = await A.borrarPlantillaAction(undefined, fd({ id }));
    expect(r.error).toBe("Esta plantilla ya se usó: archivala.");
    expect(plantillas()).toHaveLength(1);
  });

  it("con el módulo de la ficha apagado no se crea ni edita para esa ficha; General sí", async () => {
    const { SERVICE_LEADS_MODULE_KEY } = await import("@/lib/service-leads/constants");
    const id = await crear("Hola");
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== SERVICE_LEADS_MODULE_KEY);
    const r = await A.crearPlantillaAction(undefined, fd({ canal: "EMAIL", tipo: "CONSULTA", nombre: "X", asunto: "a", cuerpo: "b" }));
    expect(r.error).toBe(APAGADO);
    expect((await A.editarPlantillaAction(undefined, fd({ id, tipo: "CONSULTA", nombre: "X", asunto: "a", cuerpo: "b" }))).error).toBe(APAGADO);
    expect((await A.crearPlantillaAction(undefined, fd({ canal: "EMAIL", tipo: "GENERAL", nombre: "G", asunto: "a", cuerpo: "b" }))).error).toBeNull();
  });

  it("una plantilla de un módulo apagado no se duplica, archiva, desarchiva, borra ni mueve; General y las demás sí", async () => {
    const { SERVICE_LEADS_MODULE_KEY } = await import("@/lib/service-leads/constants");
    const consulta = await crear("De consulta", { tipo: "CONSULTA" });
    const general = await crear("General", { tipo: "GENERAL" });
    const cliente = await crear("Cliente");
    const archivada = await crear("Archivada", { tipo: "CONSULTA" });
    expect((await A.archivarPlantillaAction(undefined, fd({ id: archivada }))).error).toBeNull();
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== SERVICE_LEADS_MODULE_KEY);
    const antes = JSON.stringify(B.datos);
    expect(await A.duplicarPlantillaAction(undefined, fd({ id: consulta }))).toEqual({ error: APAGADO });
    expect(await A.archivarPlantillaAction(undefined, fd({ id: consulta }))).toEqual({ error: APAGADO });
    expect(await A.borrarPlantillaAction(undefined, fd({ id: consulta }))).toEqual({ error: APAGADO });
    expect(await A.desarchivarPlantillaAction(undefined, fd({ id: archivada }))).toEqual({ error: APAGADO });
    expect(await A.editarPlantillaAction(undefined, fd({ id: consulta, tipo: "GENERAL", nombre: "X", asunto: "a", cuerpo: "b" }))).toEqual({ error: APAGADO });
    // Mover la de consulta, no; ordenar las demás sin tocarla, sí.
    expect(await A.reordenarPlantillasAction(undefined, fd({ canal: "EMAIL", orden: [general, consulta, cliente] }))).toEqual({ error: APAGADO });
    expect(JSON.stringify(B.datos)).toBe(antes);
    expect((await A.reordenarPlantillasAction(undefined, fd({ canal: "EMAIL", orden: [consulta, cliente, general] }))).error).toBeNull();
    expect((await A.duplicarPlantillaAction(undefined, fd({ id: general }))).error).toBeNull();
    expect((await A.archivarPlantillaAction(undefined, fd({ id: cliente }))).error).toBeNull();
  });

  it("formulario incompleto: datos inválidos", async () => {
    expect(await A.crearPlantillaAction(undefined, fd({ nombre: "X" }))).toEqual({ error: "Los datos no son válidos." });
    expect(await A.editarPlantillaAction(undefined, fd({ tipo: "GENERAL" }))).toEqual({ error: "Los datos no son válidos." });
    expect(await A.reordenarPlantillasAction(undefined, fd({ orden: ["a"] }))).toEqual({ error: "Los datos no son válidos." });
    expect(await A.guardarAutomaticoAction(undefined, fd({ clave: "OTRA" }))).toEqual({ error: "Los datos no son válidos." });
  });
});

describe("Configuración → Plantillas (automático)", () => {
  it("enciende y apaga la respuesta automática con su texto", async () => {
    const id = automatico();
    const r = await A.guardarAutomaticoAction(
      undefined,
      fd({ clave: "CONSULTA_AUTORESPUESTA", enabled: "1", asunto: "Recibimos tu consulta [consulta_numero]", cuerpo: "Hola [nombre]" }),
    );
    expect(r).toEqual({ error: null, ok: "Guardado: la respuesta automática está encendida." });
    expect(plantillas().find((p) => p.id === id)).toMatchObject({
      enabled: true, subject: "Recibimos tu consulta [consulta_numero]", body: "Hola [nombre]",
    });
    const off = await A.guardarAutomaticoAction(undefined, fd({ clave: "CONSULTA_AUTORESPUESTA", asunto: "a", cuerpo: "b" }));
    expect(off.ok).toBe("Guardado: la respuesta automática está apagada.");
    expect(plantillas().find((p) => p.id === id)!.enabled).toBe(false);
  });

  it("no se enciende con textos en mayúsculas por completar", async () => {
    automatico();
    const r = await A.guardarAutomaticoAction(
      undefined,
      fd({ clave: "CONSULTA_AUTORESPUESTA", enabled: "1", asunto: "Hola", cuerpo: "Agendá acá: [PEGÁ ACÁ EL ENLACE]" }),
    );
    expect(r.error).toMatch(/Completá los textos entre corchetes/);
  });

  it("sin Captación no se guarda", async () => {
    automatico();
    const antes = JSON.stringify(B.datos);
    const { SERVICE_LEADS_MODULE_KEY } = await import("@/lib/service-leads/constants");
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== SERVICE_LEADS_MODULE_KEY);
    const r = await A.guardarAutomaticoAction(undefined, fd({ clave: "CONSULTA_AUTORESPUESTA", enabled: "1", asunto: "a", cuerpo: "b" }));
    expect(r).toEqual({ error: APAGADO });
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("una variable de otra ficha en el automático vuelve con su posición", async () => {
    automatico();
    const r = await A.guardarAutomaticoAction(
      undefined,
      fd({ clave: "CONSULTA_AUTORESPUESTA", asunto: "Hola", cuerpo: "Socio [socio_numero]" }),
    );
    expect(r.errores).toEqual([expect.objectContaining({ campo: "cuerpo", posicion: 6, variable: "socio_numero" })]);
  });
});
