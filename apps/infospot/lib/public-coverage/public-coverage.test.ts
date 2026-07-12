/**
 * Tests Etapa 10 — Publicación pública de coberturas editoriales.
 * pnpm --filter infospot test:public-coverage
 */

import assert from "node:assert/strict";
import { toPublicEditorialPhoto } from "./photo-mapper";
import { buildTrackedHref } from "./tracking-href";
import { isSafeExternalRedirect } from "../distribution/metrics";
import {
  getEventTemporalState,
  temporalStateLabel,
} from "../distribution/temporal";
import { evaluateEditorialPhotosForPublish } from "../editorial-photos/checklist";

function basePhoto(overrides: Partial<{
  commercialStatus: string;
  editorialLicenseStatus: string;
  processStatus: string;
  purchaseUrl: string | null;
  albumUrl: string | null;
  variants: Array<{ width: number; format: string; url: string }>;
}> = {}) {
  return {
    id: "photo-1",
    photographerName: "Ana López",
    credit: "Foto: Ana López / ComprameLaFoto",
    commercialStatus: overrides.commercialStatus ?? "AVAILABLE",
    editorialLicenseStatus: overrides.editorialLicenseStatus ?? "AUTHORIZED",
    processStatus: overrides.processStatus ?? "READY",
    purchaseUrl: overrides.purchaseUrl ?? null,
    albumUrl: overrides.albumUrl ?? "https://compramelafoto.com/a/test",
    photographerProfileUrl: null as string | null,
    variants: overrides.variants ?? [
      { width: 640, format: "webp", url: "https://cdn.example/w640.webp" },
      { width: 1280, format: "webp", url: "https://cdn.example/w1280.webp" },
    ],
  };
}

function usage(
  photo = basePhoto(),
  opts: Partial<{
    usageType: "COVER" | "INLINE" | "GALLERY" | "FEATURED";
    sortOrder: number;
    caption: string | null;
    altText: string | null;
    displaySize: string | null;
  }> = {},
) {
  return {
    usageType: opts.usageType ?? ("INLINE" as const),
    sortOrder: opts.sortOrder ?? 0,
    caption: opts.caption ?? "Epígrafe",
    altText: opts.altText ?? "Alt",
    displaySize: opts.displaySize ?? "wide",
    photo,
  };
}

function main() {
  // 1. Artículo sin cobertura: mapper no se usa; temporal labels ok
  assert.equal(temporalStateLabel("UPCOMING"), "Próximamente");
  assert.equal(temporalStateLabel("FINISHED"), "Finalizado");

  // 2–3. Portada CLF + crédito
  {
    const cover = toPublicEditorialPhoto(
      usage(basePhoto(), { usageType: "COVER", altText: "Portada carrera" }),
      { articleId: "art-1" },
    );
    assert.ok(cover.src);
    assert.ok(cover.srcSet?.includes("640w"));
    assert.equal(cover.credit, "Foto: Ana López / ComprameLaFoto");
    assert.equal(cover.unavailable, false);
  }

  // 4–5. Inline + galería orden
  {
    const g1 = toPublicEditorialPhoto(
      usage(basePhoto({ variants: [{ width: 960, format: "webp", url: "https://cdn.example/a.webp" }] }), {
        usageType: "GALLERY",
        sortOrder: 2,
      }),
      { articleId: "art-1" },
    );
    const g0 = toPublicEditorialPhoto(
      usage(basePhoto({ variants: [{ width: 960, format: "webp", url: "https://cdn.example/b.webp" }] }), {
        usageType: "GALLERY",
        sortOrder: 0,
        altText: "Primera",
      }),
      { articleId: "art-1" },
    );
    const ordered = [g1, g0].sort((a, b) => a.sortOrder - b.sortOrder);
    assert.equal(ordered[0]!.sortOrder, 0);
    assert.equal(ordered[0]!.altText, "Primera");
  }

  // 6–7. Múltiples fotógrafos (nombres distintos en mapa)
  {
    const a = toPublicEditorialPhoto(usage(basePhoto()), { articleId: "a" });
    const b = toPublicEditorialPhoto(
      usage({
        ...basePhoto(),
        id: "photo-2",
        photographerName: "Bruno",
        credit: "Foto: Bruno / ComprameLaFoto",
      }),
      { articleId: "a" },
    );
    assert.notEqual(a.photographerName, b.photographerName);
  }

  // 8. CTA foto AVAILABLE con purchase URL específica
  {
    const p = toPublicEditorialPhoto(
      usage(
        basePhoto({
          purchaseUrl: "https://compramelafoto.com/p/1",
          commercialStatus: "AVAILABLE",
        }),
      ),
      { articleId: "art-1" },
    );
    assert.equal(p.canShowPurchaseCta, true);
    assert.equal(p.hasSpecificPurchaseUrl, true);
    assert.ok(p.purchaseHref?.includes("/api/r?"));
    assert.ok(p.purchaseHref?.includes("PURCHASE_CLICK"));
  }

  // 9. Solo álbum → buscar en álbum, sin purchaseHref específico
  {
    const p = toPublicEditorialPhoto(
      usage(basePhoto({ purchaseUrl: null, albumUrl: "https://compramelafoto.com/a/x" })),
      { articleId: "art-1" },
    );
    assert.equal(p.hasSpecificPurchaseUrl, false);
    assert.equal(p.purchaseHref, null);
    assert.ok(p.albumHref?.includes("ALBUM_CLICK"));
    assert.equal(p.canShowPurchaseCta, true);
  }

  // 10–12. HIDDEN / UNPUBLISHED / DELETED — sin CTA
  for (const status of ["HIDDEN", "UNPUBLISHED", "DELETED"] as const) {
    const p = toPublicEditorialPhoto(
      usage(basePhoto({ commercialStatus: status })),
      { articleId: "art-1" },
    );
    assert.equal(p.canShowPurchaseCta, false, status);
    assert.equal(p.purchaseHref, null, status);
    assert.equal(p.albumHref, null, status);
  }

  // 13. Imagen AUTHORIZED + DELETED comercial puede seguir mostrando derivado
  {
    const p = toPublicEditorialPhoto(
      usage(
        basePhoto({
          commercialStatus: "DELETED",
          editorialLicenseStatus: "AUTHORIZED",
          processStatus: "READY",
        }),
      ),
      { articleId: "art-1" },
    );
    assert.ok(p.src);
    assert.equal(p.canShowPurchaseCta, false);
  }

  // 14. REVOKED → placeholder (unavailable)
  {
    const p = toPublicEditorialPhoto(
      usage(basePhoto({ editorialLicenseStatus: "REVOKED" })),
      { articleId: "art-1" },
    );
    assert.equal(p.revoked, true);
    assert.equal(p.unavailable, true);
    assert.equal(p.src, null);
  }

  // 15–16. TipTap map por ID (simulación sin N+1)
  {
    const photoById: Record<string, ReturnType<typeof toPublicEditorialPhoto>> = {};
    const p = toPublicEditorialPhoto(usage(basePhoto()), { articleId: "art-1" });
    photoById[p.id] = p;
    assert.equal(photoById["photo-1"]?.id, "photo-1");
    assert.equal(Object.keys(photoById).length, 1);
  }

  // 17–18. Responsive + lazy hints
  {
    const cover = toPublicEditorialPhoto(
      usage(basePhoto(), { usageType: "COVER" }),
      { articleId: "a" },
    );
    assert.ok(cover.srcSet);
    assert.ok(cover.sizes);
    const inline = toPublicEditorialPhoto(usage(), { articleId: "a" });
    assert.ok(inline.src);
  }

  // 20. Lightbox no expone original — solo URL de variante en src
  {
    const p = toPublicEditorialPhoto(usage(), { articleId: "a" });
    assert.ok(p.src?.includes("cdn.example"));
    assert.ok(!p.src?.includes("original"));
  }

  // 22–24. Ciclo temporal
  {
    const now = new Date("2026-07-12T15:00:00.000Z");
    assert.equal(
      getEventTemporalState({
        startAt: new Date("2026-07-20T15:00:00.000Z"),
        now,
      }),
      "UPCOMING",
    );
    assert.equal(
      getEventTemporalState({
        startAt: new Date("2026-06-01T15:00:00.000Z"),
        endAt: new Date("2026-06-02T15:00:00.000Z"),
        now,
      }),
      "FINISHED",
    );
  }

  // 27–29. Tracking href + open redirect
  {
    const href = buildTrackedHref({
      to: "https://compramelafoto.com/a/1",
      kind: "PURCHASE_CLICK",
      articleId: "art-1",
    });
    assert.ok(href.startsWith("/api/r?"));
    assert.ok(href.includes("kind=PURCHASE_CLICK"));
    assert.equal(
      isSafeExternalRedirect("https://evil.com/x", ["https://compramelafoto.com"]),
      false,
    );
    assert.equal(
      isSafeExternalRedirect("https://compramelafoto.com/a/1", [
        "https://compramelafoto.com",
      ]),
      true,
    );
  }

  // 36–37. Checklist alt + PROCESSING
  {
    const missingAlt = evaluateEditorialPhotosForPublish([
      {
        processStatus: "READY",
        photographerName: "Ana",
        credit: "Foto: Ana",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: true,
        commercialStatus: "AVAILABLE",
        usageType: "COVER",
        altText: "",
      },
    ]);
    assert.ok(missingAlt.some((i) => i.id === "clf-photos-alt" && !i.ok));

    const processing = evaluateEditorialPhotosForPublish([
      {
        processStatus: "PROCESSING",
        photographerName: "Ana",
        credit: "Foto: Ana",
        editorialLicenseStatus: "AUTHORIZED",
        hasDerivative: false,
        commercialStatus: "AVAILABLE",
        usageType: "COVER",
        altText: "x",
      },
    ]);
    assert.ok(processing.some((i) => i.id === "clf-photos-ready" && !i.ok));
  }

  // 38. PROCESSING/PENDING → unavailable públicamente
  {
    const p = toPublicEditorialPhoto(
      usage(basePhoto({ processStatus: "PROCESSING" })),
      { articleId: "a" },
    );
    assert.equal(p.unavailable, true);
    assert.equal(p.src, null);
  }

  console.log("public-coverage tests: ok");
}

main();
