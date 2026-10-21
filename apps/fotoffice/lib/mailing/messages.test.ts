import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  messages: [] as { id: string; workspaceId: string; ctaUrl: string | null }[],
  post: null as { title: string; status: string; publishedAt: Date | null } | null,
  launched: [] as string[],
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeMailingMessage: {
      findMany: vi.fn(async () => H.messages),
      updateMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        H.launched.push(where.id);
        return { count: 1 };
      }),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    fotofficeWorkspaceBranding: { findUnique: vi.fn(async () => ({ publicSlug: "sfpr" })) },
    fotofficeWorkspaceDomain: { findUnique: vi.fn(async () => ({ domain: "sfpr.com.ar" })) },
    blogPost: { findUnique: vi.fn(async () => H.post) },
  },
}));
vi.mock("./settings", () => ({ getMailingSettings: vi.fn(async () => ({ bulkEnabled: true, requireApproval: false })) }));
vi.mock("./campaigns", () => ({ createCampaign: vi.fn(), loadAudience: vi.fn(), processCampaign: vi.fn() }));
vi.mock("./context", () => ({ loadMailingContext: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://fotoffice.com" }));

import { sendDueMessages } from "./messages";

const ENLACE = "https://sfpr.com.ar/blog/presenta-proyecto";

describe("sendDueMessages: campaña cuyo botón lleva a un artículo del blog", () => {
  beforeEach(() => {
    H.messages = [{ id: "msg_1", workspaceId: "ws_sfpr", ctaUrl: ENLACE }];
    H.launched = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("artículo programado para más tarde: no la toca, queda programada y lo registra", async () => {
    H.post = { title: "Presenta proyecto", status: "PUBLISHED", publishedAt: new Date(Date.now() + 86_400_000) };
    const r = await sendDueMessages(new Date(), Date.now() + 60_000);
    expect(r).toEqual({ msg_1: "ESPERA_ARTICULO:NOT_YET" });
    expect(H.launched).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("retenida"),
      expect.objectContaining({ id: "msg_1", articulo: "presenta-proyecto", motivo: "NOT_YET" }),
    );
  });

  it("artículo en borrador: la retiene", async () => {
    H.post = { title: "Presenta proyecto", status: "DRAFT", publishedAt: null };
    expect(await sendDueMessages(new Date(), Date.now() + 60_000)).toEqual({ msg_1: "ESPERA_ARTICULO:DRAFT" });
    expect(H.launched).toEqual([]);
  });

  it("artículo ya publicado: la lanza", async () => {
    H.post = { title: "Presenta proyecto", status: "PUBLISHED", publishedAt: new Date(Date.now() - 60_000) };
    await sendDueMessages(new Date(), Date.now() + 60_000);
    expect(H.launched).toEqual(["msg_1"]);
  });

  it("botón que no lleva al blog: la lanza sin mirar artículos", async () => {
    H.messages = [{ id: "msg_2", workspaceId: "ws_sfpr", ctaUrl: "https://sfpr.com.ar/cursos" }];
    H.post = null;
    await sendDueMessages(new Date(), Date.now() + 60_000);
    expect(H.launched).toEqual(["msg_2"]);
  });
});
