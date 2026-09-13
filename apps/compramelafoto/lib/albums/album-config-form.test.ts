import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasUnsavedAlbumConfigChanges,
  type AlbumConfigFormSnapshot,
} from "./album-config-form";

const base: AlbumConfigFormSnapshot = {
  title: "Cumpleaños de Ana",
  location: "Rosario",
  eventDate: "2026-09-01",
  eventStartTime: "10:00",
  eventEndTime: "12:00",
  isPublic: true,
  hiddenPhotosEnabled: false,
  hiddenSelfieRetentionDays: "",
  showComingSoonMessage: true,
  scanProtectionEnabled: true,
};

describe("hasUnsavedAlbumConfigChanges", () => {
  it("no marca cambios mientras el álbum todavía no cargó", () => {
    assert.equal(hasUnsavedAlbumConfigChanges(null, base), false);
  });

  it("no marca cambios cuando el formulario coincide con lo guardado", () => {
    assert.equal(hasUnsavedAlbumConfigChanges(base, { ...base }), false);
  });

  it("marca cambios al destildar la protección al ampliar fotos", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, scanProtectionEnabled: false }),
      true
    );
  });

  it("marca cambios al destildar álbum público", () => {
    assert.equal(hasUnsavedAlbumConfigChanges(base, { ...base, isPublic: false }), true);
  });

  it("marca cambios al tildar el mensaje de fotos próximamente", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, showComingSoonMessage: false }),
      true
    );
  });

  it("ignora espacios sobrantes en título y lugar", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, {
        ...base,
        title: "  Cumpleaños de Ana  ",
        location: " Rosario ",
      }),
      false
    );
  });

  it("marca cambios cuando cambia la retención del selfie", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, hiddenSelfieRetentionDays: "30" }),
      true
    );
  });

  it("marca cambios cuando cambia la fecha del evento", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, eventDate: "2026-09-02" }),
      true
    );
  });
  it("no avisa mientras el fotógrafo no tocó nada, aunque el formulario difiera", () => {
    // Al cargar, algunos campos se normalizan (la fecha del evento) y pueden no
    // coincidir exactamente con lo guardado. Avisar ahí sería un aviso falso.
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, scanProtectionEnabled: false }, false),
      false
    );
  });

  it("avisa cuando el fotógrafo tocó algo y quedó distinto de lo guardado", () => {
    assert.equal(
      hasUnsavedAlbumConfigChanges(base, { ...base, scanProtectionEnabled: false }, true),
      true
    );
  });

  it("no avisa si tocó algo y volvió al valor guardado", () => {
    assert.equal(hasUnsavedAlbumConfigChanges(base, { ...base }, true), false);
  });
});
