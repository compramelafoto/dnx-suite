import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAlbumWorkspaceNavAreas,
  parseLegacyAlbumTabFromQuery,
  parsePublicationPanelFromQuery,
  resolveAlbumWorkspaceAreaFromLegacyTab,
  resolveLegacyTabForWorkspaceAreaClick,
} from "./album-dashboard-nav";

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

describe("subpestaña Mosaico", () => {
  it("aparece entre Escuela y Operativo escolar sólo si el álbum tiene escuela", () => {
    const conEscuela = buildAlbumWorkspaceNavAreas({ videoMvpEnabled: false, schoolLinked: true });
    assert.deepEqual(
      conEscuela.find((a) => a.id === "pedidos")?.subtabs.map((s) => s.id),
      ["escuela", "mosaico", "operativo"]
    );
    const sinEscuela = buildAlbumWorkspaceNavAreas({ videoMvpEnabled: false, schoolLinked: false });
    assert.equal(sinEscuela.find((a) => a.id === "pedidos"), undefined);
  });

  it("se abre con link directo y queda en el área Pedidos/Escuela", () => {
    const opts = { videoMvpEnabled: false, schoolLinked: true };
    assert.equal(parseLegacyAlbumTabFromQuery("mosaico", opts), "mosaico");
    assert.equal(parseLegacyAlbumTabFromQuery("mosaico", { ...opts, schoolLinked: false }), null);
    assert.equal(resolveAlbumWorkspaceAreaFromLegacyTab("mosaico"), "pedidos");
    assert.equal(resolveLegacyTabForWorkspaceAreaClick("pedidos", "mosaico", opts), "mosaico");
  });
});
