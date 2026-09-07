import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Record<string, unknown>[] = [];

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegrationOAuthState: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return data;
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { state: string } }) =>
          rows.find((r) => r.state === where.state) ?? null,
      ),
      delete: vi.fn(async ({ where }: { where: { state: string } }) => {
        const i = rows.findIndex((r) => r.state === where.state);
        if (i >= 0) rows.splice(i, 1);
        return null;
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import { consumeOAuthState, createOAuthState } from "./oauth-state";

describe("estado anti-CSRF del OAuth", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("el estado es opaco y suficientemente largo para no adivinarse", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
    });
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(state).not.toContain("ws-1");
  });

  it("dos estados seguidos son distintos", async () => {
    const a = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    const b = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    expect(a).not.toBe(b);
  });

  it("consumirlo devuelve a qué workspace y a qué integración pertenece", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
      redirectPath: "/workspace/configuracion/integraciones",
    });
    expect(await consumeOAuthState(state)).toEqual({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
      redirectPath: "/workspace/configuracion/integraciones",
    });
  });

  it("un estado se usa una sola vez", async () => {
    const state = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    expect(await consumeOAuthState(state)).not.toBeNull();
    expect(await consumeOAuthState(state)).toBeNull();
  });

  it("un estado inventado no vale", async () => {
    expect(await consumeOAuthState("inventado")).toBeNull();
  });

  it("un estado vencido no vale", async () => {
    const state = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    const dentroDeUnaHora = new Date(Date.now() + 60 * 60 * 1000);
    expect(await consumeOAuthState(state, dentroDeUnaHora)).toBeNull();
  });

  it("un redirectPath que no sea interno se descarta", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "k",
      userId: 1,
      redirectPath: "https://sitio-malicioso.example/robar",
    });
    expect((await consumeOAuthState(state))?.redirectPath).toBeNull();
  });
});
