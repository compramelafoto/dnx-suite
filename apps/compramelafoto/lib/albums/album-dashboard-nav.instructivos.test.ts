import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAlbumWorkspaceNavAreas, parsePublicationPanelFromQuery } from "./album-dashboard-nav";

describe("navegación de Publicación", () => {
  it("incluye Instructivos y Canjes al final", () => {
    const areas = buildAlbumWorkspaceNavAreas({
      videoMvpEnabled: false,
      schoolLinked: false,
    });
    const publicacion = areas.find((a) => a.id === "publicacion");
    assert.ok(publicacion);
    assert.deepEqual(
      publicacion.subtabs.map((s) => s.label),
      ["Compartir", "Visibilidad", "Protección", "Portada", "Instructivos", "Canjes"]
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

describe("subpestaña Canjes", () => {
  it("apunta a su propio panel y se puede abrir con link directo", () => {
    const areas = buildAlbumWorkspaceNavAreas({ videoMvpEnabled: false, schoolLinked: false });
    const publicacion = areas.find((a) => a.id === "publicacion");
    const canjes = publicacion?.subtabs.find((s) => s.label === "Canjes");
    assert.equal(canjes?.publicationPanel, "canjes");
    assert.equal(parsePublicationPanelFromQuery("canjes"), "canjes");
    assert.equal(parsePublicationPanelFromQuery("instructivos"), "instructivos");
  });
});
