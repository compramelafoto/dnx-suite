import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROPOSAL_PIECES,
  getProposalPiece,
  getProposalPieceLayout,
  type ProposalPiece,
  type ProposalPieceKind,
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

  describe("geometría de cada formato", () => {
    const kinds: ProposalPieceKind[] = ["WELCOME", "BANNER", "MARQUEE"];
    const viewports = ["desktop", "mobile"] as const;

    it("la pieza entra entera en el lienzo", () => {
      for (const kind of kinds) {
        for (const viewport of viewports) {
          const l = getProposalPieceLayout(kind, viewport);
          const arriba = l.centerYRatio - l.heightRatio / 2;
          const abajo = l.centerYRatio + l.heightRatio / 2;
          assert.ok(arriba >= 0, `${kind}/${viewport} se sale por arriba (${arriba})`);
          assert.ok(abajo <= 1, `${kind}/${viewport} se sale por abajo (${abajo})`);
          assert.ok(l.widthRatio > 0 && l.widthRatio <= 1, `${kind}/${viewport}: ancho inválido`);
        }
      }
    });

    it("cada formato ocupa un lugar distinto de la página", () => {
      for (const viewport of viewports) {
        const firmas = kinds.map((kind) => {
          const l = getProposalPieceLayout(kind, viewport);
          return `${l.widthRatio}:${l.heightRatio}:${l.centerYRatio}`;
        });
        assert.equal(
          new Set(firmas).size,
          kinds.length,
          `en ${viewport} hay formatos con la misma geometría: se verían iguales`,
        );
      }
    });

    it("solo la franja de logos comparte el espacio con otras marcas", () => {
      for (const viewport of viewports) {
        assert.ok(getProposalPieceLayout("MARQUEE", viewport).neighbours > 0);
        assert.equal(getProposalPieceLayout("WELCOME", viewport).neighbours, 0);
        assert.equal(getProposalPieceLayout("BANNER", viewport).neighbours, 0);
      }
    });

    it("la placa de bienvenida oscurece la página más que las piezas en línea", () => {
      for (const viewport of viewports) {
        const welcome = getProposalPieceLayout("WELCOME", viewport).veilOpacity;
        assert.ok(welcome > getProposalPieceLayout("BANNER", viewport).veilOpacity);
        assert.ok(welcome > getProposalPieceLayout("MARQUEE", viewport).veilOpacity);
      }
    });
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
