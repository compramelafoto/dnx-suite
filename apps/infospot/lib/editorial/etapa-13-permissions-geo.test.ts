/**
 * Tests Etapa 13 — permisos CLF + georreferenciación editorial.
 * pnpm --filter infospot test:etapa-13
 */

import assert from "node:assert/strict";
import {
  canManageInfoSpotUsers,
  canProvisionClfPhotographerCall,
  canPublishInfoSpotArticle,
  canCreateInfoSpotArticle,
  type InfoSpotPermissionSubject,
} from "@repo/db";
import {
  isValidCoordinatePair,
  validateArticleLocationForPublish,
} from "./article-location";
import { resolveCoverOrigin } from "./cover-priority";

function subject(
  partial: Partial<InfoSpotPermissionSubject> & { role: string },
): InfoSpotPermissionSubject {
  return {
    status: "ACTIVE",
    canPublish: false,
    publicationPolicy: "REQUIRES_APPROVAL",
    canProvisionClfPhotographerCall: false,
    isSuperAdmin: false,
    ...partial,
  };
}

// --- Permisos CLF independientes de publicar ---
{
  const director = subject({
    role: "INFOSPOT_DIRECTOR",
    canPublish: true,
    publicationPolicy: "DIRECT_PUBLISH",
  });
  assert.equal(canProvisionClfPhotographerCall(director), true);
  assert.equal(canPublishInfoSpotArticle(director), true);
  assert.equal(canManageInfoSpotUsers(director), true);

  const redactorPublishNoClf = subject({
    role: "INFOSPOT_REDACTOR",
    canPublish: true,
    publicationPolicy: "DIRECT_PUBLISH",
    canProvisionClfPhotographerCall: false,
  });
  assert.equal(canPublishInfoSpotArticle(redactorPublishNoClf), true);
  assert.equal(canProvisionClfPhotographerCall(redactorPublishNoClf), false);
  assert.equal(canManageInfoSpotUsers(redactorPublishNoClf), false);

  const redactorClfNoPublish = subject({
    role: "INFOSPOT_REDACTOR",
    canPublish: false,
    publicationPolicy: "REQUIRES_APPROVAL",
    canProvisionClfPhotographerCall: true,
  });
  assert.equal(canPublishInfoSpotArticle(redactorClfNoPublish), false);
  assert.equal(canProvisionClfPhotographerCall(redactorClfNoPublish), true);
  assert.equal(canCreateInfoSpotArticle(redactorClfNoPublish), true);

  const colaborador = subject({
    role: "INFOSPOT_COLABORADOR",
    canProvisionClfPhotographerCall: false,
  });
  assert.equal(canProvisionClfPhotographerCall(colaborador), false);
  assert.equal(canCreateInfoSpotArticle(colaborador), true);

  const revoked = subject({
    role: "INFOSPOT_REDACTOR",
    canPublish: true,
    publicationPolicy: "DIRECT_PUBLISH",
    canProvisionClfPhotographerCall: false,
  });
  assert.equal(canProvisionClfPhotographerCall(revoked), false);

  const disabled = subject({
    role: "INFOSPOT_REDACTOR",
    status: "DISABLED",
    canProvisionClfPhotographerCall: true,
  });
  assert.equal(canProvisionClfPhotographerCall(disabled), false);

  // Permiso CLF no implica admin.
  assert.equal(canManageInfoSpotUsers(redactorClfNoPublish), false);
  // Admin conserva acceso.
  assert.equal(canManageInfoSpotUsers(director), true);
}

// --- Georreferenciación ---
{
  assert.equal(isValidCoordinatePair(0, 0), false);
  assert.equal(isValidCoordinatePair(-32.9, -60.6), true);
  assert.equal(isValidCoordinatePair(91, 0), false);
  assert.equal(isValidCoordinatePair(null, null), false);

  assert.ok(
    validateArticleLocationForPublish({ geographicScope: null }).some((e) =>
      /alcance/i.test(e),
    ),
  );

  const localMissing = validateArticleLocationForPublish({
    geographicScope: "LOCAL",
    countryName: "Argentina",
    province: "Santa Fe",
    city: "Rosario",
    latitude: null,
    longitude: null,
  });
  assert.ok(localMissing.some((e) => /coordenadas/i.test(e)));

  const localZero = validateArticleLocationForPublish({
    geographicScope: "LOCAL",
    countryName: "Argentina",
    province: "Santa Fe",
    city: "Rosario",
    latitude: 0,
    longitude: 0,
  });
  assert.ok(localZero.some((e) => /coordenadas/i.test(e)));

  const localOk = validateArticleLocationForPublish({
    geographicScope: "LOCAL",
    countryName: "Argentina",
    province: "Santa Fe",
    city: "Rosario",
    latitude: -32.94,
    longitude: -60.65,
  });
  assert.equal(localOk.length, 0);

  const provincial = validateArticleLocationForPublish({
    geographicScope: "PROVINCIAL",
    countryName: "Argentina",
    province: "Santa Fe",
  });
  assert.equal(provincial.length, 0);

  const national = validateArticleLocationForPublish({
    geographicScope: "NATIONAL",
    countryName: "Argentina",
  });
  assert.equal(national.length, 0);

  const nationalMissing = validateArticleLocationForPublish({
    geographicScope: "NATIONAL",
  });
  assert.ok(nationalMissing.some((e) => /país/i.test(e)));

  const unspecified = validateArticleLocationForPublish({
    geographicScope: "UNSPECIFIED",
  });
  assert.equal(unspecified.length, 0);

  // Borrador incompleto: la validación de publish falla, pero no bloquea el schema de draft.
  assert.ok(validateArticleLocationForPublish({ geographicScope: "LOCAL" }).length > 0);

  // Compat portada (etapa 12) sigue disponible.
  assert.equal(resolveCoverOrigin({ coverImageId: null }).origin, "placeholder");
}

console.log("etapa-13-permissions-geo.test.ts: ok");
