/**
 * Tests Selector Editorial de Fotografías.
 * pnpm --filter infospot test:editorial-photos
 */

import assert from "node:assert/strict";
import {
  buildEditorialPhotoCredit,
  buildEditorialPhotoCopyright,
  parseEditorialPhotoCredit,
  resolvePhotographerCompanyHref,
  resolvePhotographerCredit,
} from "./credit";
import { splitDisplayName, joinDisplayName } from "../display-name";
import {
  evaluateEditorialPhotosForPublish,
} from "./checklist";
import {
  mapClfAvailabilityToEditorialCommercial,
  resolveEditorialCommercialFromAlbum,
} from "./commercial";
import { isSafeExternalRedirect } from "../distribution/metrics";
import { prisma } from "@repo/db";

const EDITORIAL_VARIANT_WIDTHS = [640, 960, 1280, 1920] as const;

function getEditorialPhotoDelivery(
  variants: Array<{ width: number; format: string; url: string }>,
) {
  const webps = variants
    .filter((v) => v.format === "webp")
    .sort((a, b) => a.width - b.width);
  const master = webps[webps.length - 1] || variants[variants.length - 1] || null;
  return {
    src: master?.url ?? "",
    srcSet: webps.map((v) => `${v.url} ${v.width}w`).join(", ") || undefined,
  };
}

async function main() {
  // Crédito
  {
    const credit = buildEditorialPhotoCredit({ photographerName: "Juan Pérez" });
    assert.equal(credit, "Foto: Juan Pérez / ComprameLaFoto");
    assert.ok(buildEditorialPhotoCopyright("Juan").includes("Juan"));

    const withCompany = buildEditorialPhotoCredit({
      photographerName: "Juan Pérez",
      companyName: "Estudio Norte",
    });
    assert.equal(withCompany, "Foto: Juan Pérez - /Estudio Norte");
    const parsed = parseEditorialPhotoCredit(withCompany);
    assert.equal(parsed.companyName, "Estudio Norte");
    assert.equal(parsed.beforeCompany, "Foto: Juan Pérez - /");

    assert.equal(
      resolvePhotographerCompanyHref({ instagram: "@estudio.norte" }),
      "https://instagram.com/estudio.norte",
    );
    assert.equal(
      resolvePhotographerCompanyHref({
        instagram: "https://www.instagram.com/estudio.norte/",
        website: "https://estudio.example",
      }),
      "https://www.instagram.com/estudio.norte/",
    );
    assert.equal(
      resolvePhotographerCompanyHref({ website: "estudio.example" }),
      "https://estudio.example/",
    );
    assert.equal(
      resolvePhotographerCompanyHref({ instagram: "javascript:alert(1)" }),
      null,
    );

    const resolved = resolvePhotographerCredit({
      id: 1,
      name: "Juan Pérez",
      email: "juan@example.com",
      companyName: "Estudio Norte",
      instagram: "@estudio.norte",
      website: "https://estudio.example",
    });
    assert.equal(resolved.credit, "Foto: Juan Pérez - /Estudio Norte");
    assert.equal(resolved.companyHref, "https://instagram.com/estudio.norte");

    assert.deepEqual(splitDisplayName("Ayelén Fernandez Landeira"), {
      firstName: "Ayelén",
      lastName: "Fernandez Landeira",
    });
    assert.equal(joinDisplayName("Ayelén", "Fernandez Landeira"), "Ayelén Fernandez Landeira");
  }

  // Comercial mapping
  {
    assert.equal(mapClfAvailabilityToEditorialCommercial("AVAILABLE"), "AVAILABLE");
    assert.equal(mapClfAvailabilityToEditorialCommercial("REACTIVATABLE"), "HIDDEN");
    assert.equal(mapClfAvailabilityToEditorialCommercial("UNAVAILABLE"), "DELETED");

    const available = resolveEditorialCommercialFromAlbum({
      publicSlug: "test-album",
      isPublic: true,
      isHidden: false,
      deletedAt: null,
      firstPhotoDate: new Date(),
      createdAt: new Date(),
      expirationExtensionDays: 0,
      cleanupStatus: "NONE",
    });
    assert.equal(available.status, "AVAILABLE");
    assert.equal(available.canShowPurchaseCta, true);

    const hidden = resolveEditorialCommercialFromAlbum({
      publicSlug: "test-album",
      isPublic: true,
      isHidden: true,
      deletedAt: null,
      firstPhotoDate: new Date(),
      createdAt: new Date(),
      expirationExtensionDays: 0,
      cleanupStatus: "NONE",
    });
    assert.equal(hidden.status, "HIDDEN");
    assert.equal(hidden.canShowPurchaseCta, false);

    const deleted = resolveEditorialCommercialFromAlbum({
      publicSlug: "test-album",
      isPublic: false,
      isHidden: false,
      deletedAt: new Date(),
      firstPhotoDate: new Date(),
      createdAt: new Date(),
      expirationExtensionDays: 0,
      cleanupStatus: "NONE",
    });
    assert.equal(deleted.status, "DELETED");
    assert.equal(deleted.purchaseUrl, null);
  }

  // Checklist
  {
    const blockedProcessing = evaluateEditorialPhotosForPublish([
      {
        processStatus: "PROCESSING",
        photographerName: "Ana",
        credit: "Foto: Ana / ComprameLaFoto",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "INLINE",
        altText: "Carrera",
      },
    ]);
    assert.ok(blockedProcessing.some((i) => i.id === "clf-photos-ready" && !i.ok));

    const blockedLicense = evaluateEditorialPhotosForPublish([
      {
        processStatus: "READY",
        photographerName: "Ana",
        credit: "Foto: Ana / ComprameLaFoto",
        editorialLicenseStatus: "PENDING",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "COVER",
        altText: "Portada",
      },
    ]);
    assert.ok(blockedLicense.some((i) => i.id === "clf-photos-license" && !i.ok));

    const blockedCredit = evaluateEditorialPhotosForPublish([
      {
        processStatus: "READY",
        photographerName: "Ana",
        credit: "",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "GALLERY",
        altText: "Galería",
      },
    ]);
    assert.ok(blockedCredit.some((i) => i.id === "clf-photos-credit" && !i.ok));

    const blockedAlt = evaluateEditorialPhotosForPublish([
      {
        processStatus: "READY",
        photographerName: "Ana",
        credit: "Foto: Ana / ComprameLaFoto",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "INLINE",
        altText: "",
      },
    ]);
    assert.ok(blockedAlt.some((i) => i.id === "clf-photos-alt" && !i.ok));

    const ok = evaluateEditorialPhotosForPublish([
      {
        processStatus: "READY",
        photographerName: "Ana",
        credit: "Foto: Ana / ComprameLaFoto",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "INLINE",
        altText: "Largada",
      },
      {
        processStatus: "READY",
        photographerName: "Bruno",
        credit: "Foto: Bruno / ComprameLaFoto",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "HIDDEN",
        usageType: "GALLERY",
        altText: "Meta",
      },
    ]);
    assert.ok(ok.every((i) => i.ok));
  }

  // Delivery / variants contract
  {
    assert.deepEqual([...EDITORIAL_VARIANT_WIDTHS], [640, 960, 1280, 1920]);
    const delivery = getEditorialPhotoDelivery([
      { width: 640, format: "webp", url: "https://cdn.example/w640.webp" },
      { width: 1280, format: "webp", url: "https://cdn.example/w1280.webp" },
    ]);
    assert.ok(delivery.src.includes("1280"));
    assert.ok(delivery.srcSet?.includes("640w"));
  }

  // Open redirect
  {
    assert.equal(
      isSafeExternalRedirect("https://compramelafoto.com/album/x", [
        "https://compramelafoto.com",
      ]),
      true,
    );
    assert.equal(
      isSafeExternalRedirect("https://evil.example/phish", ["https://compramelafoto.com"]),
      false,
    );
  }

  // Persistence smoke (si el modelo existe)
  const hasModel =
    typeof (prisma as { infoSpotEditorialPhoto?: { findMany?: unknown } })
      .infoSpotEditorialPhoto?.findMany === "function";

  if (hasModel) {
    // Idempotencia de unique constraint conceptual: unique sourcePhotoExternalId
    const fakeId = `test-photo-${Date.now()}`;
    const created = await prisma.infoSpotEditorialPhoto.create({
      data: {
        sourcePhotoExternalId: fakeId,
        sourceAlbumExternalId: "999001",
        photographerName: "Test Photographer",
        credit: buildEditorialPhotoCredit({ photographerName: "Test Photographer" }),
        processStatus: "PENDING",
        commercialStatus: "AVAILABLE",
        editorialLicenseStatus: "AUTHORIZED",
      },
    });
    let duplicateFailed = false;
    try {
      await prisma.infoSpotEditorialPhoto.create({
        data: {
          sourcePhotoExternalId: fakeId,
          sourceAlbumExternalId: "999001",
          photographerName: "Test Photographer",
          credit: "x",
        },
      });
    } catch {
      duplicateFailed = true;
    }
    assert.equal(duplicateFailed, true);

    const author = await prisma.user.findFirst({ select: { id: true } });
    if (author) {
      const article = await prisma.infoSpotArticle.create({
        data: {
          title: "Test editorial photo usage",
          slug: `test-ed-photo-${Date.now()}`,
          content: "Cuerpo de prueba suficientemente largo para tests.",
          excerpt: "Bajada de prueba",
          authorId: author.id,
          status: "DRAFT",
          contentTag: "REAL",
        },
      });
      const usageA = await prisma.infoSpotEditorialPhotoUsage.create({
        data: {
          articleId: article.id,
          photoId: created.id,
          usageType: "COVER",
          isCover: true,
          createdByUserId: author.id,
        },
      });
      const articleB = await prisma.infoSpotArticle.create({
        data: {
          title: "Segundo artículo misma foto",
          slug: `test-ed-photo-b-${Date.now()}`,
          content: "Cuerpo de prueba suficientemente largo para tests.",
          excerpt: "Bajada de prueba",
          authorId: author.id,
          status: "DRAFT",
          contentTag: "REAL",
        },
      });
      await prisma.infoSpotEditorialPhotoUsage.create({
        data: {
          articleId: articleB.id,
          photoId: created.id,
          usageType: "INLINE",
          createdByUserId: author.id,
        },
      });
      const usages = await prisma.infoSpotEditorialPhotoUsage.count({
        where: { photoId: created.id },
      });
      assert.equal(usages, 2);

      await prisma.infoSpotEditorialPhotoUsage.deleteMany({
        where: { photoId: created.id },
      });
      await prisma.infoSpotArticle.deleteMany({
        where: { id: { in: [article.id, articleB.id] } },
      });
      void usageA;
    }

    await prisma.infoSpotEditorialPhoto.delete({ where: { id: created.id } });
  }

  console.log("editorial-photos tests: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
