import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El cierre del ingreso cuando entra el pago.
 *
 * Corre pegado a la acreditación de un pago, que es un hecho ya consumado: lo que más importa
 * probar es que **no puede romper nada** —ni tumbar el pago, ni cerrar un alta que todavía
 * debe, ni avisar dos veces— y que emite el carnet, que es lo que el socio está esperando.
 */

const H = vi.hoisted(() => ({
  appFindFirst: vi.fn(),
  appUpdateMany: vi.fn(),
  chargeFindMany: vi.fn(),
  memberFindUnique: vi.fn(),
  issueCard: vi.fn(),
  issuePrepaid: vi.fn(),
  sendAndLog: vi.fn(),
  emailContext: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      membershipApplication: { findFirst: H.appFindFirst, updateMany: H.appUpdateMany },
      membershipCharge: { findMany: H.chargeFindMany },
      member: { findUnique: H.memberFindUnique },
    },
  };
});

vi.mock("@/lib/carnet/issue", () => ({ issueDigitalCard: H.issueCard }));
vi.mock("@/lib/carnet/prepaid-card", () => ({ issuePrepaidPrintedCard: H.issuePrepaid }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLog }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.emailContext,
}));

const { completeApplicationIfPaid } = await import("./complete-application");

const saldado = { balanceArs: "0.00" };

beforeEach(() => {
  H.appFindFirst.mockReset().mockResolvedValue({
    id: "app-1",
    workspaceId: "ws-sfpr",
    wantsPrintedCard: false,
  });
  H.appUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  H.chargeFindMany.mockReset().mockResolvedValue([saldado, saldado, saldado]);
  H.memberFindUnique.mockReset().mockResolvedValue({
    firstName: "Ana",
    email: "ana@test.com",
    memberNumber: "735",
    avatarUrl: null,
    userId: 42,
  });
  H.issueCard.mockReset().mockResolvedValue({ ok: true, created: true });
  H.issuePrepaid.mockReset().mockResolvedValue({ emitida: true });
  H.sendAndLog.mockReset().mockResolvedValue({ status: "SENT", providerId: "re_1" });
  H.emailContext.mockReset().mockResolvedValue({ organizationName: "Club SFPR", signature: null });
  process.env.APP_URL = "https://fotoffice.test";
  process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";
});

describe("cierre del ingreso", () => {
  it("con todo pago cierra la solicitud, emite el carnet y da la bienvenida", async () => {
    const r = await completeApplicationIfPaid("m-1");

    expect(r.completed).toBe(true);
    expect(H.appUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETADA" } }),
    );
    expect(H.issueCard).toHaveBeenCalledWith({ workspaceId: "ws-sfpr", memberId: "m-1" });
    expect(H.sendAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@test.com", userId: 42 }),
    );
  });

  it("mientras quede un peso, no cierra nada", async () => {
    H.chargeFindMany.mockResolvedValue([saldado, { balanceArs: "8000.00" }]);

    const r = await completeApplicationIfPaid("m-1");

    expect(r.completed).toBe(false);
    expect(H.appUpdateMany).not.toHaveBeenCalled();
    expect(H.issueCard).not.toHaveBeenCalled();
    expect(H.sendAndLog).not.toHaveBeenCalled();
  });

  /** El socio del padrón migrado que paga su cuota mensual no viene de ninguna solicitud. */
  it("no hace nada si el socio no viene de una solicitud aprobada e impaga", async () => {
    H.appFindFirst.mockResolvedValue(null);

    const r = await completeApplicationIfPaid("m-1");

    expect(r.completed).toBe(false);
    expect(H.chargeFindMany).not.toHaveBeenCalled();
    expect(H.issueCard).not.toHaveBeenCalled();
  });

  it("dos acreditaciones seguidas no mandan dos bienvenidas", async () => {
    H.appUpdateMany.mockResolvedValue({ count: 0 });

    const r = await completeApplicationIfPaid("m-1");

    expect(r.completed).toBe(false);
    expect(H.sendAndLog).not.toHaveBeenCalled();
    expect(H.issueCard).not.toHaveBeenCalled();
  });

  /**
   * La credencial impresa se cobra con la inscripción pero se emite recién cuando llega la
   * foto. Este email es el mejor momento para pedirla: es el único que la persona va a abrir
   * con ganas.
   */
  it("a quien pagó la credencial impresa y no subió la foto, se la pide", async () => {
    H.appFindFirst.mockResolvedValue({
      id: "app-1",
      workspaceId: "ws-sfpr",
      wantsPrintedCard: true,
    });

    await completeApplicationIfPaid("m-1");

    const [args] = H.sendAndLog.mock.calls[0] as [{ body: { text: string } }];
    expect(args.body.text).toContain("tu foto");
  });

  it("no le pide la foto a quien ya la tiene", async () => {
    H.appFindFirst.mockResolvedValue({
      id: "app-1",
      workspaceId: "ws-sfpr",
      wantsPrintedCard: true,
    });
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: "ana@test.com",
      memberNumber: "735",
      avatarUrl: "https://r2.test/ana.jpg",
      userId: 42,
    });

    await completeApplicationIfPaid("m-1");

    const [args] = H.sendAndLog.mock.calls[0] as [{ body: { text: string } }];
    expect(args.body.text).not.toContain("tu foto");
  });

  /**
   * El cruce que quedaba abierto: quien subió la foto ANTES de pagar no disparaba nada —el
   * cargo tenía saldo— y al pagar no había tarjeta pendiente que liberar. La credencial
   * pagada no se emitía nunca.
   */
  it("emite la credencial impresa ya pagada de quien subió la foto antes de pagar", async () => {
    H.appFindFirst.mockResolvedValue({
      id: "app-1",
      workspaceId: "ws-sfpr",
      wantsPrintedCard: true,
    });
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: "ana@test.com",
      memberNumber: "735",
      avatarUrl: "https://r2.test/ana.jpg",
      userId: 42,
    });

    await completeApplicationIfPaid("m-1");

    expect(H.issuePrepaid).toHaveBeenCalledWith({ workspaceId: "ws-sfpr", memberId: "m-1" });
  });

  it("no intenta emitir credencial impresa a quien no la pidió", async () => {
    await completeApplicationIfPaid("m-1");
    expect(H.issuePrepaid).not.toHaveBeenCalled();
  });

  /** Un pago acreditado no puede deshacerse porque el proveedor de correo esté caído. */
  it("si algo falla, no propaga el error hacia el pago", async () => {
    H.issueCard.mockRejectedValue(new Error("base caída"));

    await expect(completeApplicationIfPaid("m-1")).resolves.toEqual({ completed: false });
  });

  it("sin email cargado cierra igual: el alta no depende de poder avisar", async () => {
    H.memberFindUnique.mockResolvedValue({
      firstName: "Ana",
      email: null,
      memberNumber: "735",
      avatarUrl: null,
      userId: null,
    });

    const r = await completeApplicationIfPaid("m-1");

    expect(r.completed).toBe(true);
    expect(H.issueCard).toHaveBeenCalled();
    expect(H.sendAndLog).not.toHaveBeenCalled();
  });
});
