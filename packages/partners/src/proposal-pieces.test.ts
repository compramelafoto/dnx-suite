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
});
