import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePilotoConfig } from "./config";
import { cargarConfigPiloto, sumarCuentasCompartidas } from "./receptores-clf";

const base = resolvePilotoConfig({} as NodeJS.ProcessEnv);

test("el usuario compartido cobra en el receptor del dueño", () => {
  const config = { ...base, receiverByUserId: new Map([[166, "rx-suan"]]) };
  const r = sumarCuentasCompartidas(config, new Map([[570, 166]]));
  assert.equal(r.receiverByUserId.get(570), "rx-suan");
  assert.equal(r.receiverByUserId.get(166), "rx-suan");
});

test("si el dueño no aceptó, el compartido tampoco cobra por split", () => {
  const r = sumarCuentasCompartidas({ ...base, receiverByUserId: new Map() }, new Map([[570, 166]]));
  assert.equal(r.receiverByUserId.has(570), false);
});

test("no pisa un receptor propio del usuario compartido", () => {
  const config = { ...base, receiverByUserId: new Map([[166, "rx-suan"], [570, "rx-propio"]]) };
  const r = sumarCuentasCompartidas(config, new Map([[570, 166]]));
  assert.equal(r.receiverByUserId.get(570), "rx-propio");
});

test("cargarConfigPiloto aplica FOTOLAB MIDI → Suan con los receptores de la base", async () => {
  const env = {
    DNX_CLF_SPLIT_1N_PILOTO_ENABLED: "true",
    DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true",
    DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID: "97484805",
  } as unknown as NodeJS.ProcessEnv;
  const r = await cargarConfigPiloto(env, async () => new Map([[166, "rx-suan"]]));
  assert.equal(r.receiverByUserId.get(570), "rx-suan");
});
