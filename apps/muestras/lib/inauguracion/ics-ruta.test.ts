import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
const { GET } = await import("@/app/m/[slug]/inauguracion/evento.ics/route");

const muestra = (extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "rosario", title: "Rosario", type: "MUESTRA", reviewStatus: "APPROVED", isVirtualOnly: false, isCancelled: false,
  openingAt: new Date("2026-11-14T22:00:00Z"), openingEndsAt: null, openingNote: null, rsvpStatus: "OFF", rsvpMaxCompanions: 3,
  venueName: "Sala", address: "Calle 1", city: "Rosario", province: "Santa Fe", latitude: null, longitude: null,
  coverImageUrl: null, organizersText: "Fotoclub", updatedAt: new Date("2026-10-01T12:00:00Z"), ...extra,
});
const pedir = (slug = "rosario") => GET(new Request(`http://localhost:3014/m/${slug}/inauguracion/evento.ics`), { params: Promise.resolve({ slug }) });

beforeEach(() => vi.clearAllMocks());

describe("GET evento.ics", () => {
  it("una muestra OPEN u OFF da el archivo de calendario", async () => {
    for (const rsvpStatus of ["OFF", "OPEN"]) {
      db.culturalActivity.findFirst.mockResolvedValue(muestra({ rsvpStatus }));
      const r = await pedir();
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
      expect(r.headers.get("content-disposition")).toBe('attachment; filename="inauguracion-rosario.ics"');
      const cuerpo = await r.text();
      expect(cuerpo).toMatch(/UID:inauguracion-a1@muestrasfotograficas\.com/);
      expect(cuerpo).toMatch(/DTSTART:20261114T220000Z/);
    }
  });
  it("UNAVAILABLE o inexistente → 404", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ openingAt: new Date("2026-11-14T03:00:00Z") }));
    expect((await pedir()).status).toBe(404);
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect((await pedir("otra")).status).toBe(404);
  });
});
