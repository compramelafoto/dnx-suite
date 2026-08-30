import assert from "node:assert/strict";
import { test } from "node:test";

import { isAlbumTermsAccepted } from "./album-sales-readiness";
import {
  TERMS_VERSION,
  TERMS_VERSIONS_VALIDAS_PARA_VENTA,
} from "../terms/photographerTerms";

/**
 * Regresión del cutover (2026-08-30): la comparación era por igualdad exacta contra
 * TERMS_VERSION. Legacy grabó "2026-01-26" en los 805 álbumes con términos aceptados
 * y el monorepo compilaba "2026-07-21", así que ninguno pasaba el control: 765 álbumes
 * públicos con venta digital habrían dejado de vender el día 1.
 *
 * Ver docs/clf-migration/14-bloqueante-terminos-corta-la-venta.md
 */

const ACEPTADO = new Date("2026-03-01T12:00:00Z");

test("un álbum con la versión de legacy sigue vendiendo", () => {
  assert.equal(
    isAlbumTermsAccepted({ termsAcceptedAt: ACEPTADO, termsVersion: "2026-01-26" }),
    true
  );
});

test("un álbum con la versión actual vende", () => {
  assert.equal(
    isAlbumTermsAccepted({ termsAcceptedAt: ACEPTADO, termsVersion: TERMS_VERSION }),
    true
  );
});

test("toda versión de la lista habilita la venta", () => {
  for (const version of TERMS_VERSIONS_VALIDAS_PARA_VENTA) {
    assert.equal(
      isAlbumTermsAccepted({ termsAcceptedAt: ACEPTADO, termsVersion: version }),
      true,
      `la versión ${version} debería habilitar la venta`
    );
  }
});

test("la versión de legacy está contemplada", () => {
  assert.ok(
    TERMS_VERSIONS_VALIDAS_PARA_VENTA.includes("2026-01-26"),
    "sacar 2026-01-26 corta la venta de los álbumes migrados: sólo con decisión legal explícita"
  );
});

test("sin fecha de aceptación no vende, aunque la versión sea válida", () => {
  assert.equal(
    isAlbumTermsAccepted({ termsAcceptedAt: null, termsVersion: TERMS_VERSION }),
    false
  );
});

test("sin versión no vende, aunque tenga fecha", () => {
  assert.equal(
    isAlbumTermsAccepted({ termsAcceptedAt: ACEPTADO, termsVersion: null }),
    false
  );
});

test("una versión desconocida no vende", () => {
  assert.equal(
    isAlbumTermsAccepted({ termsAcceptedAt: ACEPTADO, termsVersion: "1999-01-01" }),
    false
  );
});
