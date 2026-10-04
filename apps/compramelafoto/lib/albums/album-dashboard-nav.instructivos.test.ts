import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAlbumWorkspaceNavAreas } from "./album-dashboard-nav";

describe("navegación de Publicación", () => {
  it("incluye Instructivos como última subpestaña", () => {
    const areas = buildAlbumWorkspaceNavAreas({
      videoMvpEnabled: false,
      schoolLinked: false,
    });
    const publicacion = areas.find((a) => a.id === "publicacion");
    assert.ok(publicacion);
    assert.deepEqual(
      publicacion.subtabs.map((s) => s.label),
      ["Compartir", "Visibilidad", "Protección", "Portada", "Instructivos"]
    );
  });

  it("la subpestaña de instructivos apunta a su propio panel", () => {
    const areas = buildAlbumWorkspaceNavAreas({
      videoMvpEnabled: false,
      schoolLinked: false,
    });
    const publicacion = areas.find((a) => a.id === "publicacion");
    const instructivos = publicacion?.subtabs.find((s) => s.label === "Instructivos");
    assert.equal(instructivos?.publicationPanel, "instructivos");
    assert.equal(instructivos?.navKey, "publicacion-instructivos");
  });
});
