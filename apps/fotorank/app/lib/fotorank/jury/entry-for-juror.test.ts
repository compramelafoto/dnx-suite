/**
 * El objeto que llega a la pantalla del jurado no puede identificar al autor.
 * Esta prueba es la que sostiene el anonimato: si alguien agrega un campo del
 * autor "para mostrarlo en el tooltip", acá se entera.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CAMPOS_PROHIBIDOS, serializeEntryForJuror } from "./entry-for-juror";

const CRUDA = {
  id: "e1",
  entryNumber: 7,
  technicalSummaryStatus: "APPROVED",
  authorUserId: 42,
  clickatonParticipantNumber: "CK-0123",
  externalRegistrationId: "reg-1",
  imageUrl: "https://ejemplo/original.jpg",
  title: "Retrato de mi hermana",
  description: "Tomada en el patio de casa",
  assets: [{ id: "asset-1" }],
  votes: [],
  checks: [{ status: "WARNING" }, { status: "OK" }],
};

const BASE = "https://maratonfotografica.com";

test("expone el código anónimo y no el autor", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.equal(out.anonymousCode, 7);
  const claves = Object.keys(out);
  for (const prohibido of CAMPOS_PROHIBIDOS) {
    assert.ok(!claves.includes(prohibido), `se filtró "${prohibido}"`);
  }
});

test("ningún valor del objeto contiene datos del autor", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  const serializado = JSON.stringify(out);
  for (const rastro of ["CK-0123", "reg-1", "Retrato de mi hermana", "patio de casa"]) {
    assert.ok(!serializado.includes(rastro), `se filtró "${rastro}"`);
  }
});

test("arma el enlace de vista previa apuntando a Clickatón", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.ok(out.previewUrl?.startsWith(`${BASE}/api/jurado/media/asset-1?`));
  assert.ok(out.previewUrl?.includes("sig="));
  assert.ok(out.previewUrl?.includes("exp="));
});

test("sin vista previa el enlace es nulo, no una cadena vacía", () => {
  const out = serializeEntryForJuror({
    entry: { ...CRUDA, assets: [] },
    clickatonBaseUrl: BASE,
  });
  assert.equal(out.previewUrl, null);
});

test("cuenta las advertencias técnicas", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.equal(out.warningCount, 1);
});

test("un concurso propio de FotoRank no necesita base externa", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: null });
  assert.equal(out.previewUrl, null);
});

test("el enlace vence: lleva un exp futuro y acotado", () => {
  const ahora = new Date("2026-09-19T20:00:00.000Z");
  const out = serializeEntryForJuror({
    entry: CRUDA,
    clickatonBaseUrl: BASE,
    now: ahora,
  });
  const exp = Number(new URL(out.previewUrl!).searchParams.get("exp"));
  assert.ok(exp > ahora.getTime(), "el enlace ya nace vencido");
  assert.ok(exp - ahora.getTime() <= 20 * 60 * 1000, "el enlace dura demasiado");
});

/**
 * Vector fijo compartido con Clickatón.
 *
 * La firma se calcula en dos aplicaciones distintas. Si una cambia el propósito,
 * el orden de los campos o la codificación, las pruebas de cada lado seguirían
 * pasando por separado y el jurado no vería una sola foto. Este valor tiene que
 * ser idéntico al de apps/clickaton/lib/jury-media/signed-link.test.ts.
 */
const FIRMA_ESPERADA = "QzkxP6BNKog1A6q1CC11qRChUpcuL17XSit2A1B5e-A";

test("la firma coincide con la que espera Clickatón", () => {
  const exp = 1758312000000;
  const out = serializeEntryForJuror({
    entry: { ...CRUDA, assets: [{ id: "asset-compat" }] },
    clickatonBaseUrl: BASE,
    now: new Date(exp - 15 * 60 * 1000),
  });
  const sig = new URL(out.previewUrl!).searchParams.get("sig");
  assert.equal(
    sig,
    FIRMA_ESPERADA,
    "La firma de FotoRank dejó de coincidir con la que verifica Clickatón",
  );
});
