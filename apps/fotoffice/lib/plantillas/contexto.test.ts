import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({ org: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({ loadWorkspaceEmailContext: H.org }));

const { contextoDe } = await import("./contexto");
const { resolverVariables } = await import("./variables");

const USUARIO = { nombre: "Ana Pérez", email: "ana@estudio.test" };
const HOY = new Date("2026-10-01T15:00:00.000Z");

function org(nombre = "Estudio DNX") {
  return {
    organizationName: nombre,
    signature: { html: "<table>firma</table>", text: "-- firma" },
    contact: { email: "hola@estudio.test", phone: "341 555", whatsapp: "+54 9 341 555 0000", website: "https://dnx.test", instagram: "@dnx", city: "Rosario" },
  };
}

beforeEach(() => {
  B.vaciar();
  H.org.mockReset();
  H.org.mockResolvedValue(org());
});

describe("contextoDe", () => {
  it("cliente: persona, organización, usuario y campos legibles", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Lucía", lastName: "Gómez Paz", email: " lucia@x.test ", phone: null, memberId: null });
    B.agregar("fotofficeCustomField", { id: "f1", workspaceId: "ws-1", entityType: "CLIENTE", key: "colegio", name: "Colegio", type: "TEXTO" });
    B.agregar("fotofficeCustomField", { id: "f2", workspaceId: "ws-1", entityType: "CLIENTE", key: "viejo", name: "Viejo", type: "TEXTO", archivedAt: new Date() });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", entityType: "CLIENTE", entityId: "c1", fieldId: "f1", valueText: "San José" });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", entityType: "CLIENTE", entityId: "c1", fieldId: "f2", valueText: "no va" });

    const c = await contextoDe("ws-1", "CLIENTE", "c1", USUARIO, HOY);
    expect(c).not.toBeNull();
    const v = resolverVariables(c!.variables);
    expect([v("nombre"), v("apellido"), v("nombre_completo"), v("email")]).toEqual(["Lucía", "Gómez Paz", "Lucía Gómez Paz", "lucia@x.test"]);
    expect([v("organizacion"), v("organizacion_email"), v("usuario_nombre"), v("hoy")]).toEqual(["Estudio DNX", "hola@estudio.test", "Ana Pérez", "01/10/2026"]);
    expect(v("campo:colegio")).toBe("San José");
    expect(v("campo:viejo")).toBeNull();
    expect(c!.camposActivos).toEqual([{ clave: "colegio", nombre: "Colegio" }]);
    expect(c!.firma).toEqual({ html: "<table>firma</table>", texto: "-- firma" });
    expect(c!.destino).toEqual({ email: "lucia@x.test", telefono: null });
    expect(c!.remitente).toEqual({ nombre: "Estudio DNX", replyTo: "hola@estudio.test" });
    expect(H.org).toHaveBeenCalledWith("ws-1");
  });

  it("aislado por workspace: un registro ajeno o inexistente es null y no lee la organización", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-2", kind: "PERSONA", firstName: "X", lastName: "Y", memberId: null });
    B.agregar("member", { id: "m1", workspaceId: "ws-2", firstName: "X", lastName: "Y", memberNumber: "7" });
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-2", name: "X", eventType: "BODA" });
    expect(await contextoDe("ws-1", "CLIENTE", "c1", USUARIO)).toBeNull();
    expect(await contextoDe("ws-1", "SOCIO", "m1", USUARIO)).toBeNull();
    expect(await contextoDe("ws-1", "CONSULTA", "l1", USUARIO)).toBeNull();
    expect(await contextoDe("ws-1", "CONSULTA", "nada", USUARIO)).toBeNull();
    expect(await contextoDe("ws-1", "GENERAL" as never, "c1", USUARIO)).toBeNull();
    expect(H.org).not.toHaveBeenCalled();
  });

  it("empresa: el nombre es la razón social", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "EMPRESA", businessName: "Foto SRL", firstName: null, lastName: null, memberId: null });
    const c = await contextoDe("ws-1", "CLIENTE", "c1", USUARIO);
    expect(resolverVariables(c!.variables)("nombre_completo")).toBe("Foto SRL");
  });

  it("socio: número de socio y datos del cliente vinculado que le falten", async () => {
    B.agregar("member", { id: "m1", workspaceId: "ws-1", firstName: "Juan", lastName: "Sosa", email: null, phone: "+54 341 4444444", memberNumber: "124" });
    const c = await contextoDe("ws-1", "SOCIO", "m1", USUARIO);
    const v = resolverVariables(c!.variables);
    expect([v("nombre"), v("socio_numero"), v("telefono")]).toEqual(["Juan", "124", "+54 341 4444444"]);
    expect(c!.destino.email).toBeNull();
  });

  it("cliente que también es socio completa el correo con el del socio", async () => {
    B.agregar("member", { id: "m1", workspaceId: "ws-1", firstName: "Juan", lastName: "Sosa", email: "juan@x.test", phone: null, memberNumber: "1" });
    B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Juan", lastName: "Sosa", email: null, memberId: "m1" });
    const c = await contextoDe("ws-1", "CLIENTE", "c1", USUARIO);
    expect(c!.destino.email).toBe("juan@x.test");
    expect(c!.variables.socio).toBeUndefined();
  });

  it("consulta: número, tipo, fecha, lugar, mensaje y etapa del recorrido abierto", async () => {
    B.agregar("serviceSalesLead", {
      id: "l1", workspaceId: "ws-1", name: "Mara Ríos", email: "mara@x.test", phone: "+5493415550000", eventType: "BODA",
      eventDate: new Date("2026-12-05T00:00:00.000Z"), eventLocation: "Rosario", message: "Hola",
    });
    B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", sequenceKey: "CONSULTA", entityType: "CONSULTA", entityId: "l1", value: 12, display: "C-0012" });
    B.agregar("fotofficeCircuit", { id: "k1", workspaceId: "ws-1", name: "Ventas" });
    B.agregar("fotofficeStage", { id: "s1", circuitId: "k1", name: "Propuesta enviada", order: 1 });
    B.agregar("fotofficeJourney", { workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "l1", kind: "VENTA", circuitId: "k1", stageId: "s1" });
    const c = await contextoDe("ws-1", "CONSULTA", "l1", USUARIO);
    const v = resolverVariables(c!.variables);
    expect([v("consulta_numero"), v("consulta_fecha"), v("consulta_lugar"), v("consulta_mensaje"), v("consulta_etapa")]).toEqual([
      "C-0012", "05/12/2026", "Rosario", "Hola", "Propuesta enviada",
    ]);
    expect(v("consulta_tipo")).toBeTruthy();
    expect(c!.destino).toEqual({ email: "mara@x.test", telefono: "+5493415550000" });
  });

  it("consulta con el recorrido cerrado: la etapa es cómo terminó", async () => {
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Mara", eventType: "BODA" });
    B.agregar("fotofficeJourney", {
      workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "l1", kind: "VENTA", circuitId: "k1", outcome: "GANADA", closedAt: new Date(),
    });
    const c = await contextoDe("ws-1", "CONSULTA", "l1", USUARIO);
    expect(resolverVariables(c!.variables)("consulta_etapa")).toBe("Ganada");
    expect(resolverVariables(c!.variables)("consulta_numero")).toBeNull();
  });

  it("sin correo de contacto de la organización no hay responder-a", async () => {
    H.org.mockResolvedValue({ ...org(), signature: null, contact: { ...org().contact, email: null } });
    B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "A", memberId: null });
    const c = await contextoDe("ws-1", "CLIENTE", "c1", USUARIO);
    expect(c!.remitente.replyTo).toBeNull();
    expect(c!.firma).toEqual({ html: "", texto: "" });
  });
});
