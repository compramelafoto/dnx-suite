import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La puerta manda al panel pasando por acá, porque una página no puede escribir cookies: esta
 * ruta fija la institución de la puerta como activa y recién entonces abre `/workspace`. Sin
 * esto, una cookie vieja de otra institución abriría esa otra.
 */

const H = vi.hoisted(() => ({
  user: { id: 4 } as { id: number } | null,
  branding: { workspaceId: "ws-sfpr" } as { workspaceId: string } | null,
  profiles: [] as unknown[],
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: async () => H.user }));
vi.mock("@repo/db", () => ({
  prisma: { fotofficeWorkspaceBranding: { findUnique: async () => H.branding } },
}));
vi.mock("@/lib/portal/profiles", () => ({ listUserProfiles: async () => H.profiles }));

const { GET } = await import("./route");

const TEAM = { kind: "TEAM", workspaceId: "ws-sfpr", workspaceName: "SFPR", role: "STAFF" };

async function call() {
  const res = await GET(new Request("https://fotoffice.test/w/sfpr/entrar/panel"), {
    params: Promise.resolve({ workspaceSlug: "sfpr" }),
  });
  return {
    location: new URL(res.headers.get("location")!).pathname,
    cookie: res.cookies.get("fotoffice_workspace_id")?.value ?? null,
  };
}

beforeEach(() => {
  H.user = { id: 4 };
  H.branding = { workspaceId: "ws-sfpr" };
  H.profiles = [TEAM];
});

describe("puerta → panel", () => {
  it("equipo de la institución: la deja activa y abre el panel", async () => {
    expect(await call()).toEqual({ location: "/workspace", cookie: "ws-sfpr" });
  });

  it("sin ser equipo de esa institución: vuelve a la puerta sin tocar la cookie", async () => {
    H.profiles = [{ ...TEAM, workspaceId: "ws-otro" }];
    expect(await call()).toEqual({ location: "/w/sfpr/entrar", cookie: null });
  });

  it("sin sesión: vuelve a la puerta", async () => {
    H.user = null;
    expect(await call()).toEqual({ location: "/w/sfpr/entrar", cookie: null });
  });

  it("institución inexistente: va al inicio", async () => {
    H.branding = null;
    expect(await call()).toEqual({ location: "/", cookie: null });
  });
});
