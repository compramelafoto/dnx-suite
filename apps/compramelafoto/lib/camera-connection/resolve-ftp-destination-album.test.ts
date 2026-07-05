import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  albumMatchesReceivedAt,
  getAlbumFtpEffectiveWindow,
  resolveAlbumIdFromTimeMatches,
  FTP_DESTINATION_REASON,
} from "./resolve-ftp-destination-album";

describe("getAlbumFtpEffectiveWindow", () => {
  it("usa startsAt y endsAt cuando existen ambos", () => {
    const start = new Date("2026-05-30T20:00:00.000Z");
    const end = new Date("2026-05-31T02:00:00.000Z");
    const window = getAlbumFtpEffectiveWindow({
      id: 1,
      startsAt: start,
      endsAt: end,
      eventDate: new Date("2026-05-30T03:00:00.000Z"),
    });
    assert.deepEqual(window, { start, end });
  });

  it("solo eventDate → ventana virtual de día completo ART", () => {
    const window = getAlbumFtpEffectiveWindow({
      id: 1,
      startsAt: null,
      endsAt: null,
      eventDate: new Date("2026-05-30T03:00:00.000Z"),
    });
    assert.ok(window);
    assert.equal(window!.start.toISOString(), "2026-05-30T03:00:00.000Z");
    assert.equal(window!.end.toISOString(), "2026-05-31T02:59:59.999Z");
  });
});

describe("albumMatchesReceivedAt", () => {
  const album = {
    id: 10,
    startsAt: new Date("2026-05-30T20:00:00.000Z"),
    endsAt: new Date("2026-05-31T02:00:00.000Z"),
    eventDate: null,
  };

  it("coincide dentro de la ventana", () => {
    assert.equal(
      albumMatchesReceivedAt(album, new Date("2026-05-30T21:00:00.000Z")),
      true
    );
  });

  it("no coincide fuera de la ventana", () => {
    assert.equal(
      albumMatchesReceivedAt(album, new Date("2026-05-30T19:00:00.000Z")),
      false
    );
  });
});

describe("resolveAlbumIdFromTimeMatches", () => {
  it("0 coincidencias → UNASSIGNED", () => {
    const result = resolveAlbumIdFromTimeMatches([]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, FTP_DESTINATION_REASON.UNASSIGNED);
    }
  });

  it("1 coincidencia → albumId", () => {
    const result = resolveAlbumIdFromTimeMatches([{ id: 42, startsAt: null, endsAt: null, eventDate: null }]);
    assert.deepEqual(result, { ok: true, albumId: 42 });
  });

  it("2+ coincidencias → AMBIGUOUS_ALBUM_TIME_MATCH", () => {
    const result = resolveAlbumIdFromTimeMatches([
      { id: 1, startsAt: null, endsAt: null, eventDate: null },
      { id: 2, startsAt: null, endsAt: null, eventDate: null },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, FTP_DESTINATION_REASON.AMBIGUOUS_ALBUM_TIME_MATCH);
    }
  });
});
