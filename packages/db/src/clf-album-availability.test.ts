import { resolveClfAlbumCommercialAvailability } from "./clf-album-availability";

function album(partial: Partial<Parameters<typeof resolveClfAlbumCommercialAvailability>[0]>) {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  return {
    publicSlug: "demo-album",
    isHidden: false,
    isPublic: true,
    deletedAt: null,
    firstPhotoDate: createdAt,
    createdAt,
    expirationExtensionDays: 0,
    cleanupStatus: "NONE",
    ...partial,
  };
}

const day = 86_400_000;

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = new Date("2026-01-01T00:00:00.000Z");

{
  const r = resolveClfAlbumCommercialAvailability(album({}), {
    now: new Date(base.getTime() + 10 * day),
    hideAfterDays: 30,
    retentionDays: 45,
    clfPublicBaseUrl: "https://example.com",
  });
  assert(r.status === "AVAILABLE", "day 10 should be AVAILABLE");
  assert(r.canPurchase, "day 10 can purchase");
  assert(r.publicUrl === "https://example.com/album/demo-album", "public url");
}

{
  const r = resolveClfAlbumCommercialAvailability(album({ isHidden: true }), {
    now: new Date(base.getTime() + 35 * day),
    hideAfterDays: 30,
    retentionDays: 45,
  });
  assert(r.status === "REACTIVATABLE", "hidden before purge => REACTIVATABLE");
  assert(r.canRequestReactivation, "can request reactivation");
  assert(!r.canPurchase, "cannot purchase while reactivatable");
}

{
  const r = resolveClfAlbumCommercialAvailability(album({}), {
    now: new Date(base.getTime() + 50 * day),
    hideAfterDays: 30,
    retentionDays: 45,
  });
  assert(r.status === "UNAVAILABLE", "past 45 days => UNAVAILABLE");
  assert(!r.canRequestReactivation, "no reactivation after purge window");
}

{
  const r = resolveClfAlbumCommercialAvailability(album({ deletedAt: new Date() }), {
    now: new Date(base.getTime() + 5 * day),
  });
  assert(r.status === "UNAVAILABLE", "deleted => UNAVAILABLE");
}

console.log("clf-album-availability.test.ts OK");
