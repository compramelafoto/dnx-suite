import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

/**
 * La plata en los listados (panel lateral, filtros, exportación) sigue la regla de main: deuda y
 * pagos con Ver en Cuotas; movimientos del cliente con Ver en Caja. Exportar es de quien gestiona
 * el módulo, con o sin plata. Los niveles salen de la misma función pura que `getModuleLevels`.
 */

const H = vi.hoisted(() => ({
  memberFindFirst: vi.fn(),
  aggregate: vi.fn(),
  cardFindFirst: vi.fn(),
  paymentFindMany: vi.fn(),
  clientFindFirst: vi.fn(),
  movementFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => {
    const { createElement } = require("react") as typeof import("react");
    return createElement("a", { href, ...rest }, children as never);
  },
}));
vi.mock("@repo/db", () => ({
  prisma: {
    member: { findFirst: H.memberFindFirst },
    membershipCharge: { aggregate: H.aggregate },
    memberCard: { findFirst: H.cardFindFirst },
    membershipPayment: { findMany: H.paymentFindMany },
    client: { findFirst: H.clientFindFirst },
    cashMovement: { findMany: H.movementFindMany },
  },
}));
vi.mock("@repo/db/fotoffice-members", () => ({ updateMember: vi.fn(), MemberConcurrencyError: class extends Error {} }));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: vi.fn() }));
vi.mock("@/lib/ficha/etiquetas", () => ({ ponerEtiqueta: vi.fn(), quitarEtiqueta: vi.fn(), buscarEtiquetas: vi.fn(async () => []) }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));

const { listadoSocios } = await import("@/lib/members/listado");
const { listadoClientes } = await import("@/lib/clients/listado");
const { recortarPorDinero } = await import("./dinero");
const { exigirCapacidad } = await import("./acceso");
const { listAvailableModuleKeys } = await import("@/lib/modules/registry");
const { resolveModuleLevel } = await import("@/lib/permissions/levels");
const { personVocabulary } = await import("@/lib/vocabulario/personas");
import type { ContextoListado } from "./tipos";
import type { ModuleLevel, RoleAssignmentForLevels } from "@/lib/permissions/levels";

const now = new Date("2026-10-06T15:00:00Z");
function rol(role: string, permisos: { moduleKey: string; level: ModuleLevel }[] | null, modulo: string): ContextoListado {
  const assignments: RoleAssignmentForLevels[] = permisos
    ? [{ startsAt: null, endsAt: null, revokedAt: null, permissions: permisos.map((p) => ({ ...p, actions: [] })) }]
    : [];
  const levels = Object.fromEntries(
    listAvailableModuleKeys().map((moduleKey) => [
      moduleKey,
      resolveModuleLevel({ moduleKey, moduleEnabled: true, workspaceRole: role, assignments, now }),
    ]),
  );
  return { workspaceId: "ws1", workspaceName: "W", userId: 7, userLabel: "Ana", role, acceso: { role, levels }, modulo };
}

const SOCIOS = listadoSocios(personVocabulary(null));
const SOCIO = {
  id: "m1", memberNumber: "12", firstName: "Laura", lastName: "Paz", status: "ACTIVE", email: null, userId: null,
  category: null, invitations: [], fotofficeTags: [], clientLink: null,
};

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.memberFindFirst.mockResolvedValue(SOCIO);
  H.aggregate.mockResolvedValue({ _sum: { balanceArs: 5000 }, _count: 2 });
  H.cardFindFirst.mockResolvedValue(null);
  H.paymentFindMany.mockResolvedValue([{ id: "p1", amountArs: 3000, paidAt: now, createdAt: now }]);
  H.clientFindFirst.mockResolvedValue({
    id: "c1", clientNumber: 3, kind: "PERSONA", firstName: "Ana", lastName: "Sol", businessName: null,
    docType: null, docNumber: null, ivaCondition: null, email: null, phone: null, address: null, city: null,
    status: "ACTIVE", member: null, fotofficeTags: [],
  });
  H.movementFindMany.mockResolvedValue([{ id: "k1", kind: "INGRESO", amountArs: 1000, occurredAt: now, description: "Copias" }]);
});

async function panel(def: { panel?: (ctx: ContextoListado, id: string) => Promise<unknown> }, ctx: ContextoListado, id: string) {
  return renderToStaticMarkup((await def.panel!(ctx, id)) as ReactElement);
}

describe("panel y filtros de Socios: deuda y pagos sólo con Ver en Cuotas", () => {
  const casos = [
    { nombre: "STAFF sin roles (Socios Ver, Cuotas nada)", ctx: rol("STAFF", null, "members"), ve: false },
    {
      nombre: "Comunicación: Socios Gestionar, sin Cuotas",
      ctx: rol("STAFF", [{ moduleKey: "members", level: "MANAGE" }], "members"),
      ve: false,
    },
    {
      nombre: "Tesorería: Socios Ver, Cuotas Ver",
      ctx: rol("STAFF", [{ moduleKey: "members", level: "VIEW" }, { moduleKey: "membership-dues", level: "VIEW" }], "members"),
      ve: true,
    },
    { nombre: "administrador", ctx: rol("WORKSPACE_ADMIN", null, "members"), ve: true },
  ];

  it.each(casos)("$nombre", async ({ ctx, ve }) => {
    const html = await panel(SOCIOS, ctx, "m1");
    expect(html.includes("Deuda"), "fila Deuda").toBe(ve);
    expect(html.includes("Últimos pagos"), "últimos pagos").toBe(ve);
    // Sin permiso la plata ni se consulta.
    expect(H.aggregate.mock.calls.length > 0).toBe(ve);
    expect(H.paymentFindMany.mock.calls.length > 0).toBe(ve);
    // El filtro "Deuda" no existe para quien no ve Cuotas (tampoco escrito a mano en la dirección).
    expect(recortarPorDinero(SOCIOS, ctx).filtros.some((f) => f.clave === "deuda")).toBe(ve);
  });
});

describe("panel y filtros de Clientes: movimientos sólo con Ver en Caja", () => {
  const casos = [
    { nombre: "STAFF sin roles (Clientes y Caja Gestionar)", ctx: rol("STAFF", null, "clients"), ve: true },
    {
      nombre: "Clientes Gestionar, sin Caja",
      ctx: rol("STAFF", [{ moduleKey: "clients", level: "MANAGE" }], "clients"),
      ve: false,
    },
    { nombre: "dueño", ctx: rol("WORKSPACE_OWNER", null, "clients"), ve: true },
  ];

  it.each(casos)("$nombre", async ({ ctx, ve }) => {
    const html = await panel(listadoClientes, ctx, "c1");
    expect(html.includes("Últimos movimientos de Caja")).toBe(ve);
    expect(H.movementFindMany.mock.calls.length > 0).toBe(ve);
    expect(recortarPorDinero(listadoClientes, ctx).filtros.some((f) => f.clave === "movimientos")).toBe(ve);
  });
});

describe("exportar: con Gestionar en el módulo, como el padrón de main", () => {
  it("Secretaría (Socios Gestionar, sin Cuotas) exporta el padrón completo: no tiene columnas de plata", () => {
    const ctx = rol("STAFF", [{ moduleKey: "members", level: "MANAGE" }], "members");
    expect(exigirCapacidad(ctx, "operar")).toBe(true);
    expect(recortarPorDinero(SOCIOS, ctx).exportar.columnas.map((c) => c.titulo)).toEqual(
      SOCIOS.exportar.columnas.map((c) => c.titulo),
    );
  });

  it("con sólo Ver no exporta", () => {
    expect(exigirCapacidad(rol("STAFF", null, "members"), "operar")).toBe(false);
  });

  it("una columna exportada de plata sale sólo con verDinero sobre su módulo", () => {
    const def = {
      ...SOCIOS,
      exportar: {
        columnas: [
          ...SOCIOS.exportar.columnas,
          { titulo: "Deuda", tipo: "importe" as const, valor: () => 1, dinero: "membership-dues" },
        ],
      },
    };
    const secretaria = rol("STAFF", [{ moduleKey: "members", level: "MANAGE" }], "members");
    const tesoreria = rol("STAFF", [{ moduleKey: "members", level: "MANAGE" }, { moduleKey: "membership-dues", level: "VIEW" }], "members");
    expect(recortarPorDinero(def, secretaria).exportar.columnas.some((c) => c.titulo === "Deuda")).toBe(false);
    expect(recortarPorDinero(def, tesoreria).exportar.columnas.some((c) => c.titulo === "Deuda")).toBe(true);
  });
});
