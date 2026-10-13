import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { buscarConsultasDelBot, consultaParaBorrador } = await import("./consultas");

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE" };
const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };

function consulta(p: { leadId: string; ws?: string; nombre: string; apellido?: string; fecha?: string; categoria?: string; ficha?: boolean; numero?: string }) {
  const ws = p.ws ?? "ws-1";
  B.agregar("serviceSalesLead", {
    id: p.leadId, workspaceId: ws, name: `${p.nombre} ${p.apellido ?? "Pérez"}`, email: "x@y.test", phone: "3415550000",
    eventType: "BODA", eventDate: p.fecha ? new Date(p.fecha) : null, createdAt: new Date(`2026-10-0${p.leadId.length % 9 + 1}T12:00:00Z`),
  });
  if (p.ficha !== false) {
    B.agregar("client", { id: `cli-${p.leadId}`, workspaceId: ws, kind: "PERSONA", firstName: p.nombre, lastName: p.apellido ?? "Pérez", businessName: null });
    const nombreCat = p.categoria ?? "Bodas";
    const catId = `cat-${ws}-${nombreCat}`;
    if (!B.datos.fotofficeConsultaCategoria.some((c) => c.id === catId)) {
      B.agregar("fotofficeConsultaCategoria", { id: catId, workspaceId: ws, name: nombreCat, group: "Sociales" });
    }
    B.agregar("fotofficeConsulta", { workspaceId: ws, leadId: p.leadId, clientId: `cli-${p.leadId}`, categoryId: catId });
  }
  if (p.numero) B.agregar("fotofficeRecordNumber", { workspaceId: ws, entityType: "CONSULTA", entityId: p.leadId, display: p.numero });
}

function presupuesto(id: string, leadId: string, opciones: { enviado?: boolean; numero?: string } = {}) {
  B.agregar("fotofficePresupuesto", { id, workspaceId: "ws-1", consultaLeadId: leadId, clientId: `cli-${leadId}`, status: opciones.enviado ? "ENVIADO" : "BORRADOR" });
  B.agregar("fotofficePresupuestoVersion", { id: `v-${id}`, workspaceId: "ws-1", presupuestoId: id, number: 1, items: [], totals: {}, sentAt: opciones.enviado ? new Date() : null });
  if (opciones.numero) B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", entityType: "PRESUPUESTO", entityId: id, display: opciones.numero });
}

beforeEach(() => {
  B.vaciar();
});

describe("buscarConsultasDelBot", () => {
  it("sólo el nombre de pila: nunca apellido, correo ni teléfono", async () => {
    consulta({ leadId: "l1", nombre: "Lucía María", apellido: "Gómez", numero: "12", fecha: "2026-11-15T00:00:00Z" });
    const [c] = await buscarConsultasDelBot(CTX, { texto: "lucia" });
    expect(c).toMatchObject({ leadId: "l1", numero: "12", nombreDePila: "Lucía", categoria: "Bodas", fechaEvento: "15/11/2026", tieneFicha: true });
    const texto = JSON.stringify(c);
    for (const dato of ["Gómez", "María", "x@y.test", "3415550000"]) expect(texto).not.toContain(dato);
  });

  it("no ve consultas de otro workspace", async () => {
    consulta({ leadId: "l1", nombre: "Lucía" });
    consulta({ leadId: "l2", ws: "ws-2", nombre: "Lucía" });
    expect((await buscarConsultasDelBot(CTX, { texto: "Lucía" })).map((c) => c.leadId)).toEqual(["l1"]);
  });

  it("filtra por fecha del evento y por texto de la categoría", async () => {
    consulta({ leadId: "l1", nombre: "Ana", fecha: "2026-11-15T12:00:00Z", categoria: "Bodas" });
    consulta({ leadId: "l22", nombre: "Bea", fecha: "2026-12-20T12:00:00Z", categoria: "Quince" });
    expect((await buscarConsultasDelBot(CTX, { desde: "2026-11-15", hasta: "2026-11-15" })).map((c) => c.leadId)).toEqual(["l1"]);
    expect((await buscarConsultasDelBot(CTX, { texto: "quince" })).map((c) => c.leadId)).toEqual(["l22"]);
  });

  it("dice qué presupuestos tiene cada una y si hay borrador; soloSinPresupuesto las saca", async () => {
    consulta({ leadId: "l1", nombre: "Ana" });
    consulta({ leadId: "l22", nombre: "Bea" });
    presupuesto("p1", "l1", { numero: "0007" });
    const todas = await buscarConsultasDelBot(CTX, {});
    expect(todas.find((c) => c.leadId === "l1")!.presupuestos).toEqual([{ id: "p1", numero: "0007", estado: "BORRADOR", tieneBorrador: true }]);
    expect((await buscarConsultasDelBot(CTX, { soloSinPresupuesto: true })).map((c) => c.leadId)).toEqual(["l22"]);
  });

  it("sin ficha: tieneFicha false y el nombre de pila sale del nombre de la consulta", async () => {
    consulta({ leadId: "l1", nombre: "Carla", apellido: "Ruiz", ficha: false });
    const [c] = await buscarConsultasDelBot(CTX, {});
    expect(c).toMatchObject({ tieneFicha: false, nombreDePila: "Carla", categoria: null });
  });

  it("como mucho 10", async () => {
    for (let i = 0; i < 14; i++) consulta({ leadId: `l${"x".repeat(i)}`, nombre: `N${i}` });
    expect(await buscarConsultasDelBot(CTX, {})).toHaveLength(10);
  });
});

describe("consultaParaBorrador", () => {
  it("la consulta del workspace con sus presupuestos; ajena o inexistente → null", async () => {
    consulta({ leadId: "l1", nombre: "Ana", numero: "3" });
    presupuesto("p1", "l1", { enviado: true });
    expect(await consultaParaBorrador(CTX, "l1")).toMatchObject({ leadId: "l1", numero: "3", tieneFicha: true, presupuestos: [{ id: "p1", tieneBorrador: false }] });
    expect(await consultaParaBorrador(CTX, "nada")).toBeNull();
    consulta({ leadId: "l9", ws: "ws-2", nombre: "Otra" });
    expect(await consultaParaBorrador(CTX, "l9")).toBeNull();
  });
});
