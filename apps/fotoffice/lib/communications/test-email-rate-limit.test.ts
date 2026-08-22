import { beforeEach, describe, expect, it, vi } from "vitest";

const { countMock } = vi.hoisted(() => ({ countMock: vi.fn() }));

vi.mock("@repo/db", () => ({
  prisma: { sentEmailLog: { count: countMock } },
}));

const { checkTestEmailRateLimit } = await import("./test-email-rate-limit");
const { TEST_EMAIL_TEMPLATE_KEY, PER_USER_HOURLY_LIMIT } = await import("./constants");

const NOW = new Date("2026-08-22T12:00:00Z");
const ARGS = { userId: 7, now: NOW };

beforeEach(() => {
  countMock.mockReset();
});

describe("límite de emails de prueba", () => {
  it("permite mientras el usuario esté por debajo del tope", async () => {
    countMock.mockResolvedValue(PER_USER_HOURLY_LIMIT - 1);
    expect(await checkTestEmailRateLimit(ARGS)).toEqual({ allowed: true });
  });

  it("bloquea al alcanzar el tope", async () => {
    countMock.mockResolvedValue(PER_USER_HOURLY_LIMIT);
    expect(await checkTestEmailRateLimit(ARGS)).toEqual({ allowed: false });
  });

  it("el tope acordado es 3 por hora", () => {
    expect(PER_USER_HOURLY_LIMIT).toBe(3);
  });

  it("cuenta solo los envíos de prueba de ese usuario en la última hora", async () => {
    countMock.mockResolvedValue(0);
    await checkTestEmailRateLimit(ARGS);
    const where = countMock.mock.calls[0]?.[0]?.where;
    expect(where.templateKey).toBe(TEST_EMAIL_TEMPLATE_KEY);
    expect(where.userId).toBe(7);
    expect(where.createdAt.gte).toEqual(new Date("2026-08-22T11:00:00Z"));
  });

  it("hace una sola consulta: no hay límite por workspace en esta etapa", async () => {
    countMock.mockResolvedValue(0);
    await checkTestEmailRateLimit(ARGS);
    expect(countMock).toHaveBeenCalledTimes(1);
    expect(countMock.mock.calls[0]?.[0]?.where?.workspaceId).toBeUndefined();
  });

  /**
   * Los intentos fallidos también se registran y por lo tanto también consumen cupo: si no,
   * una configuración rota permitiría martillar al proveedor sin tope.
   */
  it("no distingue por estado: cuenta todos los intentos registrados", async () => {
    countMock.mockResolvedValue(0);
    await checkTestEmailRateLimit(ARGS);
    expect(countMock.mock.calls[0]?.[0]?.where?.status).toBeUndefined();
  });
});
