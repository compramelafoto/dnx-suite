import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROPOSAL_PIECES,
  getProposalPiece,
  type ProposalPiece,
} from "./proposal-pieces";

describe("catálogo de piezas de propuesta", () => {
  it("tiene exactamente nueve piezas", () => {
    assert.equal(PROPOSAL_PIECES.length, 9);
  });

  it("cubre las tres familias en la proporción esperada", () => {
    const cuenta = (kind: ProposalPiece["kind"]) =>
      PROPOSAL_PIECES.filter((p) => p.kind === kind).length;
    assert.equal(cuenta("WELCOME"), 4);
    assert.equal(cuenta("BANNER"), 2);
    assert.equal(cuenta("MARQUEE"), 3);
  });

  it("no repite identificadores", () => {
    const ids = PROPOSAL_PIECES.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("cada pieza declara un placement montado", () => {
    const montados = new Set([
      "CLICKATON_EVENT_WELCOME",
      "CLICKATON_HOME_MARQUEE",
      "CLICKATON_EVENT_MARQUEE",
      "FOTORANK_CONTEST_WELCOME",
      "INFOSPOT_HOME_WELCOME",
      "INFOSPOT_HOME_TOP",
      "INFOSPOT_HOME_INLINE",
      "INFOSPOT_HOME_MARQUEE",
      "CLF_ALBUM_WELCOME",
      "CLF_HOME_PROMO",
      "CLF_LOGO_MARQUEE",
    ]);
    for (const p of PROPOSAL_PIECES) {
      assert.ok(
        montados.has(p.placementKey),
        `${p.id} apunta a ${p.placementKey}, que no está montado`,
      );
    }
  });

  it("cada pieza nombra un fondo y una plataforma", () => {
    for (const p of PROPOSAL_PIECES) {
      assert.match(p.background, /^bg-(clickaton|fotorank|infospot|clf)\.jpg$/);
      assert.ok(p.platformLabel.length > 0);
    }
  });

  it("getProposalPiece encuentra por id y devuelve undefined si no existe", () => {
    assert.equal(getProposalPiece("infospot-welcome")?.kind, "WELCOME");
    assert.equal(getProposalPiece("no-existe"), undefined);
  });

  it("cada pieza conserva sus valores exactos", () => {
    const esperado: Array<[string, ProposalPieceKind, string, string, string, number]> = [
      // id, kind, placementKey, platformLabel, background, sortOrder
      ["infospot-welcome", "WELCOME", "INFOSPOT_HOME_WELCOME", "InfoSpot", "bg-infospot.jpg", 10],
      ["clickaton-welcome", "WELCOME", "CLICKATON_EVENT_WELCOME", "Clickatón", "bg-clickaton.jpg", 20],
      ["fotorank-welcome", "WELCOME", "FOTORANK_CONTEST_WELCOME", "FotoRank", "bg-fotorank.jpg", 30],
      ["clf-welcome", "WELCOME", "CLF_ALBUM_WELCOME", "ComprameLaFoto", "bg-clf.jpg", 40],
      ["infospot-banner", "BANNER", "INFOSPOT_HOME_TOP", "InfoSpot", "bg-infospot.jpg", 50],
      ["clf-banner", "BANNER", "CLF_HOME_PROMO", "ComprameLaFoto", "bg-clf.jpg", 60],
      ["infospot-marquee", "MARQUEE", "INFOSPOT_HOME_MARQUEE", "InfoSpot", "bg-infospot.jpg", 70],
      ["clickaton-marquee", "MARQUEE", "CLICKATON_HOME_MARQUEE", "Clickatón", "bg-clickaton.jpg", 80],
      ["clf-marquee", "MARQUEE", "CLF_LOGO_MARQUEE", "ComprameLaFoto", "bg-clf.jpg", 90],
    ];

    assert.equal(PROPOSAL_PIECES.length, esperado.length);
    for (const [id, kind, placementKey, platformLabel, background, sortOrder] of esperado) {
      const pieza = getProposalPiece(id);
      assert.ok(pieza, `falta la pieza ${id}`);
      assert.equal(pieza.kind, kind, `${id}: kind`);
      assert.equal(pieza.placementKey, placementKey, `${id}: placementKey`);
      assert.equal(pieza.platformLabel, platformLabel, `${id}: platformLabel`);
      assert.equal(pieza.background, background, `${id}: background`);
      assert.equal(pieza.sortOrder, sortOrder, `${id}: sortOrder`);
    }
  });
});
