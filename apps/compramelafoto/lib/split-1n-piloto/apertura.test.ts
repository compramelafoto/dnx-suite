import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { albumEnPiloto, combinarReceptores, resolvePilotoConfig, type PilotoConfig } from "./config";
import { evaluarElegibilidadPiloto } from "./elegibilidad";
import { cargarConfigPiloto } from "./receptores-clf";

const base: PilotoConfig = {
  enabled: true,
  albumIds: new Set([12]),
  todosLosAlbumes: false,
  receptoresDesdeClf: false,
  planB: false,
  planBSplit: false,
  receiverByUserId: new Map([[35, "aaa"]]),
  ownerUserId: "97484805",
  accessToken: "APP_USR-x",
  publicKey: "APP_USR-pk",
};

describe("apertura: configuración", () => {
  it("«todos los álbumes» y «receptores de CLF» quedan apagados por defecto", () => {
    const c = resolvePilotoConfig({});
    assert.equal(c.todosLosAlbumes, false);
    assert.equal(c.receptoresDesdeClf, false);
  });

  it("sólo se encienden con «true»", () => {
    const c = resolvePilotoConfig({
      DNX_CLF_SPLIT_1N_TODOS_LOS_ALBUMES: " TRUE ",
      DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true",
    });
    assert.equal(c.todosLosAlbumes, true);
    assert.equal(c.receptoresDesdeClf, true);
    const no = resolvePilotoConfig({ DNX_CLF_SPLIT_1N_TODOS_LOS_ALBUMES: "1" });
    assert.equal(no.todosLosAlbumes, false);
  });

  it("con «todos los álbumes» cualquier álbum entra; sin eso, sólo la lista", () => {
    assert.equal(albumEnPiloto(base, 99), false);
    assert.equal(albumEnPiloto(base, 12), true);
    assert.equal(albumEnPiloto({ ...base, todosLosAlbumes: true }, 99), true);
  });

  it("combina receptores de CLF con los del entorno; el entorno gana", () => {
    const c = combinarReceptores(
      base,
      new Map([
        [35, "otro"],
        [53, "bbb"],
      ]),
    );
    assert.equal(c.receiverByUserId.get(35), "aaa");
    assert.equal(c.receiverByUserId.get(53), "bbb");
    // No modifica la config original.
    assert.equal(base.receiverByUserId.has(53), false);
  });
});

describe("apertura: elegibilidad", () => {
  const entrada = {
    albumId: 99,
    photographerUserId: 35,
    referrerUserId: null,
    items: [{ productType: "DIGITAL" }],
    tieneVideos: false,
    esCanje: false,
    esPagoSimulado: false,
    origenEstandar: true,
  };

  it("un álbum fuera de la lista entra si está «todos los álbumes»", () => {
    const r = evaluarElegibilidadPiloto({ ...entrada, config: { ...base, todosLosAlbumes: true } });
    assert.equal(r.ok, true);
  });

  it("pero el fotógrafo sigue necesitando su consentimiento", () => {
    const r = evaluarElegibilidadPiloto({
      ...entrada,
      photographerUserId: 77,
      config: { ...base, todosLosAlbumes: true },
    });
    assert.deepEqual(r, { ok: false, motivo: "fotografo_sin_consentimiento" });
  });
});

describe("apertura: receptores leídos de CLF", () => {
  const env = {
    DNX_CLF_SPLIT_1N_PILOTO_ENABLED: "true",
    DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS: "35:aaa",
    DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID: "97484805",
  };

  it("sin el interruptor, no consulta la base", async () => {
    let consultas = 0;
    const c = await cargarConfigPiloto(env, async () => {
      consultas++;
      return new Map();
    });
    assert.equal(consultas, 0);
    assert.equal(c.receiverByUserId.size, 1);
  });

  it("con el interruptor, suma los ACTIVE de CLF", async () => {
    const c = await cargarConfigPiloto(
      { ...env, DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" },
      async (owner) => {
        assert.equal(owner, "97484805");
        return new Map([[53, "bbb"]]);
      },
    );
    assert.equal(c.receiverByUserId.get(53), "bbb");
    assert.equal(c.receiverByUserId.get(35), "aaa");
  });

  it("si la base falla, sigue con el mapa del entorno y no lanza", async () => {
    const c = await cargarConfigPiloto(
      { ...env, DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" },
      async () => {
        throw new Error("relation does not exist");
      },
    );
    assert.deepEqual([...c.receiverByUserId], [[35, "aaa"]]);
  });

  it("sin cuenta cobradora configurada, no lee la base", async () => {
    let consultas = 0;
    const c = await cargarConfigPiloto(
      { DNX_CLF_SPLIT_1N_PILOTO_ENABLED: "true", DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" },
      async () => {
        consultas++;
        return new Map([[53, "bbb"]]);
      },
    );
    assert.equal(consultas, 0);
    assert.equal(c.receiverByUserId.size, 0);
  });
});
