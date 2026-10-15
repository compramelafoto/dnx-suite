import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDiplomaRankingVariables,
  computeGeneralRanking,
  formatDiplomaScore,
} from "@/lib/diplomas/diploma-ranking";

const foto = (score: number, category: string | null = "Titanic") => ({ score, category });

describe("computeGeneralRanking", () => {
  it("ordena por el promedio de las fotos, de mayor a menor", () => {
    const r = computeGeneralRanking([
      { registrationId: "a", photos: [foto(6), foto(7)] },
      { registrationId: "b", photos: [foto(9), foto(8)] },
      { registrationId: "c", photos: [foto(5)] },
    ]);
    assert.equal(r.get("b")?.position, 1);
    assert.equal(r.get("a")?.position, 2);
    assert.equal(r.get("c")?.position, 3);
    assert.equal(r.get("a")?.score, 6.5);
    assert.equal(r.get("a")?.total, 3);
  });

  it("la categoría es la consigna de su mejor foto", () => {
    const r = computeGeneralRanking([
      {
        registrationId: "a",
        photos: [foto(6, "Aromas"), foto(9.25, "Titanic"), foto(7, "Claroscuro")],
      },
    ]);
    assert.equal(r.get("a")?.category, "Titanic");
  });

  it("dos personas con la misma calificación impresa comparten puesto", () => {
    const r = computeGeneralRanking([
      { registrationId: "a", photos: [foto(8)] },
      { registrationId: "b", photos: [foto(7.121)] },
      { registrationId: "c", photos: [foto(7.118)] },
      { registrationId: "d", photos: [foto(6)] },
    ]);
    assert.equal(r.get("b")?.position, 2);
    assert.equal(r.get("c")?.position, 2);
    assert.equal(r.get("d")?.position, 4);
  });

  it("quien no tiene fotos calificadas no entra al ranking ni cuenta en el total", () => {
    const r = computeGeneralRanking([
      { registrationId: "a", photos: [foto(8)] },
      { registrationId: "b", photos: [] },
    ]);
    assert.equal(r.has("b"), false);
    assert.equal(r.get("a")?.total, 1);
  });
});

describe("variables del ranking", () => {
  it("formatea con coma decimal y dos decimales", () => {
    assert.equal(formatDiplomaScore(7.2), "7,20");
    assert.equal(formatDiplomaScore(7.666), "7,67");
  });

  it("arma puesto, ordinal, total, calificación y categoría", () => {
    assert.deepEqual(
      buildDiplomaRankingVariables({ position: 4, total: 26, score: 7.2, category: "Titanic" }),
      {
        position: "4",
        positionOrdinal: "4.º",
        rankingTotal: "26",
        score: "7,20",
        category: "Titanic",
      }
    );
  });

  it("sin ranking, todo en blanco", () => {
    const v = buildDiplomaRankingVariables(null);
    assert.ok(Object.values(v).every((x) => x === ""));
  });
});
