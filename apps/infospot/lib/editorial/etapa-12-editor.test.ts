/**
 * Tests Etapa 12 — portada, categorías (ownership) y estados de convocatoria.
 * pnpm --filter infospot test:etapa-12-editor
 *
 * Evita importar módulos con alias `@/` (el runner tsx vía @repo/db no resuelve paths de Next).
 */

import assert from "node:assert/strict";
import {
  pickCoverDisplayUrl,
  resolveCoverOrigin,
} from "./cover-priority";
import { resolvePhotographerCallDisplay } from "../clf-event-provisioning/call-display-status";
import { ARTICLE_FIELD_OWNERSHIP, isEditorialProtected } from "../content-origin/field-ownership";
import { resolvePhotographerCallFromSources } from "../distribution/photographer-call";

// --- Portada: prioridad y origen ---
{
  const none = resolveCoverOrigin({ coverImageId: null });
  assert.equal(none.origin, "placeholder");

  const upload = resolveCoverOrigin({
    coverImageId: "asset-1",
    sourceType: "UPLOAD",
  });
  assert.equal(upload.origin, "upload");
  assert.match(upload.priorityNote, /prioridad/i);

  const clf = resolveCoverOrigin({
    coverImageId: "asset-2",
    sourceType: "CLF_PHOTO",
  });
  assert.equal(clf.origin, "clf");

  // Compat: asset sin sourceType sigue resolviendo a portada asignada (no rompe legacy).
  const legacy = resolveCoverOrigin({ coverImageId: "old-asset" });
  assert.ok(legacy.origin === "upload" || legacy.origin === "placeholder");
  assert.ok(legacy.label.length > 0);

  assert.equal(
    pickCoverDisplayUrl({
      uploadedCoverUrl: "https://cdn/upload.jpg",
      clfCoverUrl: "https://cdn/clf.jpg",
      placeholderUrl: "/placeholder.jpg",
    }),
    "https://cdn/upload.jpg",
  );
  assert.equal(
    pickCoverDisplayUrl({
      uploadedCoverUrl: null,
      clfCoverUrl: "https://cdn/clf.jpg",
      placeholderUrl: "/placeholder.jpg",
    }),
    "https://cdn/clf.jpg",
  );
  assert.equal(
    pickCoverDisplayUrl({
      uploadedCoverUrl: null,
      clfCoverUrl: null,
      placeholderUrl: "/placeholder.jpg",
    }),
    "/placeholder.jpg",
  );

  // Combinar: propia gana sobre CLF; sin propia usa CLF; sin ambas placeholder.
  const combinedPriority = [
    pickCoverDisplayUrl({ uploadedCoverUrl: "u", clfCoverUrl: "c" }),
    pickCoverDisplayUrl({ uploadedCoverUrl: null, clfCoverUrl: "c" }),
    pickCoverDisplayUrl({ uploadedCoverUrl: "", clfCoverUrl: "", placeholderUrl: "p" }),
  ];
  assert.deepEqual(combinedPriority, ["u", "c", "p"]);
}

// --- Categorías: ownership editorial (siempre editable, también importadas) ---
{
  assert.equal(ARTICLE_FIELD_OWNERSHIP.categoryId, "INFOSPOT");
  assert.equal(isEditorialProtected("categoryId", ARTICLE_FIELD_OWNERSHIP), true);
  assert.equal(ARTICLE_FIELD_OWNERSHIP.coverImageId, "INFOSPOT_AFTER_OVERRIDE");
  // Cambiar categoría sugerida no está bloqueado por ownership de origen.
  assert.notEqual(ARTICLE_FIELD_OWNERSHIP.categoryId, "SOURCE");
}

// --- Convocatoria: estados visibles ---
{
  assert.equal(
    resolvePhotographerCallDisplay({ enabled: false, provisioningStatus: "NOT_REQUESTED" })
      .status,
    "NONE",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "BLOCKED",
      missingGeoref: true,
    }).status,
    "PENDING_DATA",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "PENDING",
    }).status,
    "PENDING_DATA",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "PROVISIONED",
      desiredClfStatus: "CLOSED",
      clfEventId: 10,
      publicUrl: "https://clf.example/e/abc",
    }).status,
    "CLOSED",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "PROVISIONED",
      desiredClfStatus: "ACTIVE",
      clfEventId: 10,
      publicUrl: "https://clf.example/e/abc",
    }).status,
    "OPEN",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "FAILED",
    }).status,
    "SYNC_ERROR",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "PROVISIONED",
      desiredClfStatus: "ACTIVE",
      eventEnded: true,
    }).status,
    "FINISHED",
  );
  assert.equal(
    resolvePhotographerCallDisplay({
      enabled: true,
      provisioningStatus: "PENDING",
      clfEventId: 5,
      publicUrl: "https://clf.example/e/x",
    }).status,
    "DRAFT_CLF",
  );
  assert.equal(
    resolvePhotographerCallDisplay({ enabled: false, provisioningStatus: "CLOSED" }).label,
    "Cerrada",
  );
}

// --- Buscan fotógrafos: solo pública/abierta/vigente; CTA a CLF ---
{
  const closed = resolvePhotographerCallFromSources({
    photographerCall: {
      enabled: true,
      provisioningStatus: "PROVISIONED",
      publicUrl: "https://clf.example/e/cerrado",
      clfEventId: 1,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: null,
      desiredClfStatus: "CLOSED",
    },
  });
  assert.equal(closed.eligible, false);

  const open = resolvePhotographerCallFromSources({
    photographerCall: {
      enabled: true,
      provisioningStatus: "PROVISIONED",
      publicUrl: "https://clf.example/e/abierto",
      clfEventId: 2,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: null,
      desiredClfStatus: "ACTIVE",
    },
  });
  assert.equal(open.eligible, true);
  assert.ok(open.joinUrl?.includes("/e/"));

  // Sin convocatoria habilitada: no aparece.
  const none = resolvePhotographerCallFromSources({
    photographerCall: {
      enabled: false,
      provisioningStatus: "NOT_REQUESTED",
      publicUrl: null,
      clfEventId: null,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: null,
      desiredClfStatus: "ACTIVE",
    },
  });
  assert.equal(none.eligible, false);

  // Actividad sin convocatoria: no crea elegibilidad CLF.
  assert.equal(
    resolvePhotographerCallFromSources({ photographerCall: null }).eligible,
    false,
  );
}

console.log("etapa-12-editor.test.ts: ok");
