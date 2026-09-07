import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El vencimiento de una solicitud impaga, de punta a punta y sin red.
 *
 * Es la parte del circuito con consecuencias irreversibles para una persona —le da de baja el
 * alta y le borra los cargos—, así que lo que se prueba acá no es que funcione sino que **no
 * se pase de la raya**: que no toque a quien pagó algo, que no repita lo ya hecho, y que el
 * orden de los pasos deje el ciclo recuperable si algo se corta en el medio.
 */

const H = vi.hoisted(() => ({
  appFindMany: vi.fn(),
  appUpdateMany: vi.fn(),
  chargeFindMany: vi.fn(),
  chargeDeleteMany: vi.fn(),
  memberFindUnique: vi.fn(),
  invitationFindFirst: vi.fn(),
  brandingFindUnique: vi.fn(),
  transaction: vi.fn(),
  updateMember: vi.fn(),
  revokeInvitation: vi.fn(),
  sendAndLog: vi.fn(),
  inviteOne: vi.fn(),
  emailContext: vi.fn(),
  completeIfPaid: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  const tx = {
    membershipApplication: { updateMany: H.appUpdateMany },
    // La transacción del vencimiento relee los cargos para decidir cuáles se pueden borrar.
    membershipCharge: { findMany: H.chargeFindMany, deleteMany: H.chargeDeleteMany },
  };
  return {
    ...actual,
    prisma: {
      membershipApplication: { findMany: H.appFindMany, updateMany: H.appUpdateMany },
      membershipCharge: { findMany: H.chargeFindMany, deleteMany: H.chargeDeleteMany },
      member: { findUnique: H.memberFindUnique },
      memberInvitation: { findFirst: H.invitationFindFirst },
      fotofficeWorkspaceBranding: { findUnique: H.brandingFindUnique },
      $transaction: H.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx)),
    },
  };
});

vi.mock("@repo/db/fotoffice-members", () => ({
  updateMember: H.updateMember,
  revokeMemberInvitation: H.revokeInvitation,
}));

vi.mock("./complete-application", () => ({ completeApplicationIfPaid: H.completeIfPaid }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLog }));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: H.inviteOne }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.emailContext,
}));

const { processApplicationDeadlines } = await import("./expire-applications");

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-09-06T06:30:00.000Z");
const en = (dias: number) => new Date(AHORA.getTime() + dias * DIA);

const SOLICITUD = {
  id: "app-1",
  workspaceId: "ws-sfpr",
  memberId: "m-1",
  expiresAt: en(-1),
};

/** Cargo del alta que nadie tocó: saldo intacto y sin ninguna imputación. */
const cargoIntacto = (id: string) => ({
  id,
  balanceArs: "8000.00",
  amountArs: "8000.00",
  _count: { allocations: 0 },
});

beforeEach(() => {
  H.appFindMany.mockReset().mockResolvedValue([SOLICITUD]);
  H.appUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  H.chargeFindMany.mockReset().mockResolvedValue([cargoIntacto("c-1"), cargoIntacto("c-2")]);
  H.chargeDeleteMany.mockReset().mockResolvedValue({ count: 2 });
  H.memberFindUnique.mockReset().mockResolvedValue({
    firstName: "Ana",
    email: "ana@test.com",
    status: "ACTIVE",
    userId: null,
    updatedAt: AHORA,
  });
  H.invitationFindFirst.mockReset().mockResolvedValue({ id: "inv-1" });
  H.brandingFindUnique.mockReset().mockResolvedValue({ publicSlug: "sfpr" });
  H.updateMember.mockReset().mockResolvedValue({ id: "m-1" });
  H.revokeInvitation.mockReset().mockResolvedValue({ count: 1 });
  H.sendAndLog.mockReset().mockResolvedValue({ status: "SENT", providerId: "re_1" });
  H.inviteOne.mockReset().mockResolvedValue({ error: null, ok: true, sentTo: "ana@test.com" });
  H.emailContext.mockReset().mockResolvedValue({ organizationName: "Club SFPR", signature: null });
  H.completeIfPaid.mockReset().mockResolvedValue({ completed: false });
  process.env.APP_URL = "https://fotoffice.test";
  process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";
});

describe("vencimiento", () => {
  it("marca la solicitud vencida, da de baja al socio y le avisa", async () => {
    const r = await processApplicationDeadlines(AHORA);

    expect(r.vencidas).toBe(1);
    expect(H.appUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "VENCIDA" } }),
    );
    expect(H.updateMember).toHaveBeenCalledWith(
      "ws-sfpr",
      "m-1",
      { status: "INACTIVE", leftAt: AHORA },
      expect.objectContaining({ source: "SYSTEM", action: "STATUS_CHANGED" }),
    );
    expect(H.sendAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@test.com" }),
    );
  });

  /** La baja de una persona no puede quedar sin explicación en su historial. */
  it("la baja automática deja escrito el motivo y no finge un administrador", async () => {
    await processApplicationDeadlines(AHORA);

    const [, , , opciones] = H.updateMember.mock.calls[0] as [
      string,
      string,
      unknown,
      { actor: { userId: number | null }; reason: string },
    ];
    expect(opciones.actor.userId).toBeNull();
    expect(opciones.reason).toContain("no pagado dentro del plazo");
  });

  /**
   * También la cuota del mes: la generación mensual no sabe si el ingreso se pagó, así que a
   * los pocos días de aprobado ya le corrió una. Si el alta queda sin efecto, esa tampoco
   * corresponde.
   */
  it("borra toda la deuda que nadie tocó, incluida la cuota mensual que corrió mientras tanto", async () => {
    H.chargeFindMany
      .mockResolvedValueOnce([cargoIntacto("c-1"), cargoIntacto("c-2")])
      .mockResolvedValueOnce([
        cargoIntacto("c-1"),
        cargoIntacto("c-2"),
        cargoIntacto("mensual-1"),
      ]);

    await processApplicationDeadlines(AHORA);

    expect(H.chargeDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["c-1", "c-2", "mensual-1"] } },
    });
  });

  it("nunca borra un cargo que recibió dinero, aunque el alta venza", async () => {
    H.chargeFindMany
      .mockResolvedValueOnce([cargoIntacto("c-1")])
      .mockResolvedValueOnce([
        cargoIntacto("c-1"),
        { id: "viejo", balanceArs: "0.00", amountArs: "8000.00", _count: { allocations: 1 } },
      ]);

    await processApplicationDeadlines(AHORA);

    expect(H.chargeDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["c-1"] } } });
  });

  it("revoca el enlace de acceso que ya no corresponde", async () => {
    await processApplicationDeadlines(AHORA);
    expect(H.revokeInvitation).toHaveBeenCalledWith(
      "ws-sfpr",
      "m-1",
      "inv-1",
      expect.objectContaining({ userId: null }),
      expect.objectContaining({ source: "SYSTEM" }),
    );
  });

  /**
   * El caso que justifica todo el cuidado: alguien pagó dos de sus tres cuotas de ingreso. No
   * es un moroso, es un trámite a medias, y una tarea automática no puede darlo de baja ni
   * borrarle cargos que ya recibieron dinero.
   */
  it("con un pago parcial no toca NADA y lo deriva a la Secretaría", async () => {
    H.chargeFindMany.mockResolvedValue([
      cargoIntacto("c-1"),
      { id: "c-2", balanceArs: "0.00", amountArs: "8000.00", _count: { allocations: 1 } },
    ]);

    const r = await processApplicationDeadlines(AHORA);

    expect(r.derivadas).toBe(1);
    expect(r.vencidas).toBe(0);
    expect(H.updateMember).not.toHaveBeenCalled();
    expect(H.chargeDeleteMany).not.toHaveBeenCalled();
    expect(H.appUpdateMany).not.toHaveBeenCalled();
    expect(H.sendAndLog).not.toHaveBeenCalled();
  });

  it("detecta el pago parcial aunque no haya quedado imputación registrada", async () => {
    H.chargeFindMany.mockResolvedValue([
      { id: "c-1", balanceArs: "3000.00", amountArs: "8000.00", _count: { allocations: 0 } },
    ]);
    const r = await processApplicationDeadlines(AHORA);
    expect(r.derivadas).toBe(1);
  });

  /** Dos corridas simultáneas, o un pago que entró justo: la segunda no vuelve a avisar. */
  it("si otra corrida la resolvió primero, no manda un segundo email", async () => {
    H.appUpdateMany.mockResolvedValue({ count: 0 });
    const r = await processApplicationDeadlines(AHORA);
    expect(r.vencidas).toBe(0);
    expect(H.sendAndLog).not.toHaveBeenCalled();
    expect(H.chargeDeleteMany).not.toHaveBeenCalled();
  });

  it("no vuelve a dar de baja a quien ya está dado de baja", async () => {
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: "ana@test.com",
      status: "INACTIVE",
      userId: null,
      updatedAt: AHORA,
    });
    await processApplicationDeadlines(AHORA);
    expect(H.updateMember).not.toHaveBeenCalled();
    // El resto del ciclo sí se completa: es la corrida que retoma lo que quedó a medias.
    expect(H.appUpdateMany).toHaveBeenCalled();
  });

  it("un fallo en una solicitud no corta las demás", async () => {
    H.appFindMany.mockResolvedValue([SOLICITUD, { ...SOLICITUD, id: "app-2", memberId: "m-2" }]);
    H.memberFindUnique
      .mockRejectedValueOnce(new Error("base caída"))
      .mockResolvedValue({
        firstName: "Beto",
        email: "beto@test.com",
        status: "ACTIVE",
        userId: null,
        updatedAt: AHORA,
      });

    const r = await processApplicationDeadlines(AHORA);

    expect(r.fallidas).toBe(1);
    expect(r.vencidas).toBe(1);
  });
});

describe("solicitudes que ya estaban pagas", () => {
  /**
   * El caso real que apareció al mirar la base: dos socios habían pagado su ingreso completo
   * antes de que existiera el cierre automático, y sus solicitudes iban a quedar en «aprobada
   * e impaga» para siempre —sin carnet y apareciendo cada día como pendientes—.
   */
  it("las cierra en vez de dejarlas dando vueltas", async () => {
    H.completeIfPaid.mockResolvedValue({ completed: true });

    const r = await processApplicationDeadlines(AHORA);

    expect(r.completadas).toBe(1);
    expect(r.vencidas).toBe(0);
    expect(H.updateMember).not.toHaveBeenCalled();
    expect(H.chargeDeleteMany).not.toHaveBeenCalled();
  });
});

describe("recordatorio", () => {
  const porVencer = { ...SOLICITUD, expiresAt: en(6.5) };

  beforeEach(() => {
    H.appFindMany.mockResolvedValue([porVencer]);
  });

  /**
   * A los 23 días de aprobada, el enlace de la aprobación —que dura 14— ya venció seguro. Un
   * recordatorio que apunte ahí no sirve de nada: hay que emitir uno nuevo.
   */
  it("a quien no activó su cuenta le manda un enlace nuevo", async () => {
    const r = await processApplicationDeadlines(AHORA);

    expect(r.recordadas).toBe(1);
    expect(H.inviteOne).toHaveBeenCalledWith(
      { id: "ws-sfpr" },
      { kind: "SYSTEM", label: "FotoOffice" },
      "m-1",
      expect.anything(),
    );
    // No se manda además el email suelto: sería el mismo aviso dos veces.
    expect(H.sendAndLog).not.toHaveBeenCalled();
  });

  it("a quien ya tiene cuenta lo manda a pagar, sin tocarle el acceso", async () => {
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: "ana@test.com",
      status: "ACTIVE",
      userId: 42,
      updatedAt: AHORA,
    });

    const r = await processApplicationDeadlines(AHORA);

    expect(r.recordadas).toBe(1);
    expect(H.inviteOne).not.toHaveBeenCalled();
    expect(H.sendAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@test.com", userId: 42 }),
    );
  });

  it("no recuerda nada a quien ya no debe: el cierre lo resuelve la acreditación", async () => {
    H.chargeFindMany.mockResolvedValue([
      { id: "c-1", balanceArs: "0.00", amountArs: "8000.00", _count: { allocations: 1 } },
    ]);
    const r = await processApplicationDeadlines(AHORA);
    expect(r.recordadas).toBe(0);
    expect(H.inviteOne).not.toHaveBeenCalled();
  });

  it("no le escribe a un socio suspendido ni a uno sin email", async () => {
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: null,
      status: "ACTIVE",
      userId: null,
      updatedAt: AHORA,
    });
    expect((await processApplicationDeadlines(AHORA)).recordadas).toBe(0);
  });

  it("con el plazo entero por delante no hace nada", async () => {
    H.appFindMany.mockResolvedValue([{ ...SOLICITUD, expiresAt: en(20) }]);
    const r = await processApplicationDeadlines(AHORA);
    expect(r).toMatchObject({ revisadas: 1, recordadas: 0, vencidas: 0 });
  });
});
