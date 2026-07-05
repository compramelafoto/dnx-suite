/**
 * Diagnóstico operativo de configuración de un álbum (admin / debug / API).
 * Reutiliza isAlbumComplete / isAlbumPubliclyAccessible de album-helpers.
 */

import { prisma } from "@/lib/prisma";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { buildSalesPolicyDiagnosticItems } from "@/lib/sales/album-sales-policy-readiness";
import { resolveAlbumSalesPolicy } from "@/lib/sales/resolve-album-sales-policy";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import type {
  AlbumDiagnosticsExecutiveStatus,
  AlbumDiagnosticsResult,
  DiagnosticItem,
  DiagnosticSeverity,
} from "@/lib/album-diagnostics-types";

export type {
  AlbumDiagnosticsExecutiveStatus,
  AlbumDiagnosticsResult,
  DiagnosticItem,
  DiagnosticSeverity,
} from "@/lib/album-diagnostics-types";
export { formatDiagnosticsForCopy } from "@/lib/album-diagnostics-types";

function push(
  dest: DiagnosticItem[],
  id: string,
  severity: DiagnosticSeverity,
  title: string,
  detail?: string
) {
  dest.push({ id, severity, title, detail });
}

function mergeChecks(sections: AlbumDiagnosticsResult["sections"]): DiagnosticItem[] {
  return [
    ...sections.general.items,
    ...sections.publication.items,
    ...sections.commercial.items,
    ...sections.terms.items,
    ...sections.payments.items,
    ...sections.collaborative.items,
  ];
}

export async function runAlbumConfigurationDiagnostics(
  albumId: number
): Promise<{ ok: true; data: AlbumDiagnosticsResult } | { ok: false; error: string; code: string }> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      createdAt: true,
      deletedAt: true,
      userId: true,
      creatorId: true,
      eventId: true,
      type: true,
      schoolId: true,
      isHidden: true,
      isPublic: true,
      showComingSoonMessage: true,
      firstPhotoDate: true,
      expirationExtensionDays: true,
      hiddenPhotosEnabled: true,
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
      digitalPhotoPriceCents: true,
      includeDigitalWithPrint: true,
      digitalWithPrintDiscountPercent: true,
      albumProfitMarginPercent: true,
      selectedLabId: true,
      pickupBy: true,
      printPricingSource: true,
      termsAcceptedAt: true,
      termsVersion: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          mpAccessToken: true,
          mpUserId: true,
          mpConnectedAt: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          shareSlug: true,
          creatorId: true,
          archivedAt: true,
          visibility: true,
        },
      },
      school: {
        select: { id: true, name: true },
      },
    },
  });

  if (!album) {
    return { ok: false, error: "Álbum no encontrado", code: "NOT_FOUND" };
  }

  const photosCount = await prisma.photo.count({
    where: { albumId: album.id, isRemoved: false },
  });

  const albumForHelpers = {
    isPublic: album.isPublic,
    isHidden: album.isHidden,
    enablePrintedPhotos: album.enablePrintedPhotos,
    enableDigitalPhotos: album.enableDigitalPhotos,
    selectedLabId: album.selectedLabId,
    albumProfitMarginPercent: album.albumProfitMarginPercent,
    pickupBy: album.pickupBy as string | null | undefined,
    digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    printPricingSource: album.printPricingSource,
    termsAcceptedAt: album.termsAcceptedAt,
    termsVersion: album.termsVersion,
  };

  const complete = isAlbumComplete(albumForHelpers);
  const publiclyAccessible = isAlbumPubliclyAccessible(albumForHelpers);

  const now = new Date();
  const hasPhotos = photosCount > 0;
  const activePacks = await listActivePacksForPublicCatalog(album.id, now, { hasPhotos });
  const hasActivePreventaPacks = activePacks.length > 0;

  const extensionDays = album.expirationExtensionDays ?? 0;
  const baseDate = album.firstPhotoDate ?? album.createdAt;
  const visibleUntil = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const visibleWindowExpired = visibleUntil ? now >= visibleUntil : false;

  const owner = album.user;
  const hasMpAccessToken = Boolean(owner?.mpAccessToken);
  const hasMpUserId = Boolean(owner?.mpUserId);
  const mpLinkedUi = hasMpUserId || Boolean(owner?.mpConnectedAt);

  let eventAlbumsCount = 0;
  if (album.eventId) {
    eventAlbumsCount = await prisma.album.count({
      where: { eventId: album.eventId, deletedAt: null },
    });
  }

  const wantsSale =
    Boolean(album.enableDigitalPhotos) ||
    Boolean(album.enablePrintedPhotos);
  const canSellStandardCheckout =
    complete && wantsSale && hasMpAccessToken;

  const wouldAppearInDirectory =
    album.isPublic === true &&
    album.isHidden !== true &&
    album.deletedAt == null;

  const anonymousCanPassPublicGate =
    publiclyAccessible && album.deletedAt == null;

  const general: DiagnosticItem[] = [];
  const publication: DiagnosticItem[] = [];
  const commercial: DiagnosticItem[] = [];
  const terms: DiagnosticItem[] = [];
  const payments: DiagnosticItem[] = [];
  const collaborative: DiagnosticItem[] = [];

  push(
    general,
    "g_id",
    "info",
    `ID ${album.id} · ${album.title}`,
    `Slug público: /${album.publicSlug}`
  );

  push(
    general,
    "g_owner",
    "info",
    `Dueño: ${owner?.name || "—"} (${owner?.email || "sin email"})`,
    `userId ${album.userId} · rol ${owner?.role || "—"}`
  );

  if (album.creatorId != null && album.creatorId !== album.userId) {
    push(
      general,
      "g_creator",
      "info",
      `creatorId distinto de userId (${album.creatorId})`,
      "Álbum creado en nombre de otro usuario (flujo colaborativo o delegación)."
    );
  }

  if (album.type) {
    push(general, "g_type", "info", `Tipo de evento (álbum): ${album.type}`, undefined);
  }

  push(
    general,
    "g_flags_pub",
    publiclyAccessible ? "ok" : "warning",
    publiclyAccessible
      ? "Marcado como público y no oculto (isPublic + isHidden OK)"
      : !album.isPublic
        ? "No es público (isPublic = false)"
        : "Está oculto (isHidden = true)"
  );

  push(
    general,
    "g_photos",
    photosCount > 0 ? "ok" : "warning",
    photosCount > 0
      ? `Fotos visibles: ${photosCount}`
      : "Sin fotos visibles todavía",
    !hasPhotos && hasActivePreventaPacks
      ? "Hay packs de preventa activos: la landing puede mostrar flujo de preventa sin fotos."
      : undefined
  );

  if (album.deletedAt) {
    push(
      general,
      "g_deleted",
      "error",
      "Álbum eliminado (soft delete)",
      "No debería mostrarse; los pedidos históricos pueden conservarse."
    );
  }

  if (album.hiddenPhotosEnabled) {
    push(
      general,
      "g_hidden_mode",
      "info",
      "Modo fotos ocultas / selfie activado",
      "Las fotos pueden requerir verificación antes de verse."
    );
  }

  // —— Publicación / visibilidad ——
  let pubExpectation: AlbumDiagnosticsResult["sections"]["publication"]["expectation"] =
    "CANNOT_APPEAR_PUBLICLY";
  let pubExpectationLabel = "No puede aparecer públicamente (revisar motivos abajo)";

  if (!wouldAppearInDirectory) {
    pubExpectation = "CANNOT_APPEAR_PUBLICLY";
    pubExpectationLabel = "No cumple condiciones para el directorio público de álbumes.";
  } else {
    pubExpectation = "CAN_APPEAR_PUBLICLY";
    pubExpectationLabel =
      album.eventId != null && album.event
        ? "Elegible para `/api/public/albums` y para la galería unificada del evento."
        : "Cumple filtros del listado público (público, no oculto, no borrado).";
  }

  if (wouldAppearInDirectory) {
    push(
      publication,
      "p_directory",
      "ok",
      "Elegible para `/api/public/albums` (público, visible)",
      album.eventId != null
        ? "También accesible desde la galería del evento (`/g/...`)."
        : "Otras pantallas pueden filtrar además por fotos o datos de usuario."
    );
  } else {
    push(
      publication,
      "p_directory_block",
      "warning",
      "No aparecerá en el listado público de álbumes",
      !album.isPublic
        ? "Motivo: isPublic = false"
        : album.isHidden
          ? "Motivo: isHidden = true"
          : album.deletedAt
            ? "Motivo: álbum eliminado (soft delete)"
            : "Revisar flags de visibilidad."
    );
  }

  if (anonymousCanPassPublicGate && visibleWindowExpired) {
    push(
      publication,
      "p_expired_window",
      "warning",
      "Ventana de visualización vencida (30 días + extensión desde primera foto / creación)",
      "Visitantes sin rol pueden ver la página bloqueada salvo que seas dueño/admin o tengas grant."
    );
    pubExpectationLabel += " · Posible bloqueo por expiración de galería.";
  } else if (visibleUntil && !visibleWindowExpired) {
    push(
      publication,
      "p_visible_until",
      "info",
      `Ventana de visualización hasta aprox. ${visibleUntil.toISOString().slice(0, 10)}`,
      undefined
    );
  }

  if (anonymousCanPassPublicGate && !hasPhotos && !hasActivePreventaPacks) {
    push(
      publication,
      "p_coming_soon",
      "info",
      "Con acceso público pero sin fotos ni packs: la landing muestra “próximamente” / aviso",
      "No es un error de routing; falta contenido o preventa."
    );
  }

  if (anonymousCanPassPublicGate && !complete) {
    push(
      publication,
      "p_incomplete_public",
      "warning",
      "El álbum es público pero la configuración comercial no está completa",
      "Los visitantes pueden ver la galería; el checkout puede rechazar pedidos hasta completar venta (isAlbumComplete)."
    );
  }

  if (!anonymousCanPassPublicGate && !album.deletedAt) {
    push(
      publication,
      "p_gate",
      "info",
      "Visitante anónimo: no supera la regla isAlbumPubliclyAccessible (isPublic y no oculto)",
      "Dueño, invitados con AlbumAccess o admin siguen pudiendo entrar según reglas de /album/[slug]."
    );
  }

  // —— Comercial ——
  if (!wantsSale) {
    push(
      commercial,
      "c_no_sale",
      "warning",
      "Ventas digitales e impresas deshabilitadas",
      "isAlbumComplete será false hasta habilitar al menos un canal (comportamiento actual del helper)."
    );
  }

  if (album.enableDigitalPhotos) {
    const v = Number(album.digitalPhotoPriceCents);
    const ok = Number.isFinite(v) && v > 0;
    push(
      commercial,
      "c_digital_price",
      ok ? "ok" : "error",
      ok
        ? `Precio digital configurado (${v} centavos)`
        : "Fotos digitales habilitadas pero sin precio válido",
      ok ? undefined : "Definí digitalPhotoPriceCents > 0."
    );
  }

  if (album.enablePrintedPhotos) {
    const margin = Number(album.albumProfitMarginPercent);
    const hasMargin = Number.isFinite(margin) && margin >= 0;
    push(
      commercial,
      "c_margin",
      hasMargin ? "ok" : "error",
      hasMargin
        ? `Margen configurado (${margin}%)`
        : "Falta margen comercial (albumProfitMarginPercent)",
      undefined
    );
    if ((album as { includeDigitalWithPrint?: boolean | null }).includeDigitalWithPrint) {
      const discount = Number(
        (album as { digitalWithPrintDiscountPercent?: number | null }).digitalWithPrintDiscountPercent ?? 0
      );
      push(
        commercial,
        "c_print_digital_bundle",
        "ok",
        "Incluye archivo digital al comprar impresa",
        Number.isFinite(discount) && discount > 0
          ? `Descuento sobre el digital incluido: ${discount}%`
          : "Sin descuento adicional sobre el digital incluido."
      );
    }
    if (album.selectedLabId != null) {
      const hasPickup = Boolean(album.pickupBy);
      push(
        commercial,
        "c_lab_pickup",
        hasPickup ? "ok" : "error",
        hasPickup
          ? "Laboratorio seleccionado y retiro/entrega definidos (pickupBy)"
          : "Impresión con laboratorio pero falta pickupBy",
        undefined
      );
      const lab = await prisma.lab.findUnique({
        where: { id: album.selectedLabId },
        select: { id: true, name: true },
      });
      push(
        commercial,
        "c_lab_name",
        "info",
        `Laboratorio: ${lab?.name || `#${album.selectedLabId}`}`,
        undefined
      );
    } else {
      push(
        commercial,
        "c_print_photo",
        "info",
        "Impresión sin laboratorio seleccionado (flujo a cargo del fotógrafo / Fase 1)",
        "Solo se exige margen; no pickupBy obligatorio si selectedLabId es null."
      );
    }
  }

  push(
    commercial,
    "c_complete",
    complete ? "ok" : "error",
    complete
      ? "Configuración comercial mínima OK (isAlbumComplete)"
      : "Configuración comercial incompleta (isAlbumComplete = false)",
    "Esta es la misma regla que usa el checkout en /api/a/[id]/orders."
  );

  const salesPolicy = await resolveAlbumSalesPolicy(album.id);
  if (salesPolicy) {
    for (const item of buildSalesPolicyDiagnosticItems(salesPolicy)) {
      commercial.push(item);
    }
    if (salesPolicy.divergence.hasAny) {
      push(
        commercial,
        "c_policy_divergence",
        "warning",
        "Divergencia entre modelo legacy y capabilities (resolver Fase 1)",
        salesPolicy.divergence.summaryLines.join(" · ")
      );
    }
  } else {
    push(
      commercial,
      "c_policy_resolver",
      "warning",
      "No se pudo resolver la política de ventas unificada",
      undefined
    );
  }

  // —— Términos ——
  const termsOk =
    Boolean(album.termsAcceptedAt) && album.termsVersion === TERMS_VERSION;
  push(
    terms,
    "t_version",
    termsOk ? "ok" : "error",
    termsOk
      ? `Términos aceptados (versión ${TERMS_VERSION})`
      : "Faltan términos o versión desactualizada",
    termsOk
      ? undefined
      : `Se requiere termsAcceptedAt y termsVersion = ${TERMS_VERSION} (ver lib/terms/photographerTerms).`
  );

  // —— Pagos ——
  if (!wantsSale || !complete) {
    push(
      payments,
      "pay_skip",
      "info",
      !wantsSale
        ? "Sin ventas activas: Mercado Pago no es requisito para “completitud” de álbum"
        : "Con ventas incompletas: resolvé primero la configuración comercial",
      undefined
    );
  }

  if (wantsSale && complete) {
    push(
      payments,
      "pay_mp_token",
      hasMpAccessToken ? "ok" : "error",
      hasMpAccessToken
        ? "OAuth Mercado Pago presente (mpAccessToken) — listo para crear preferencias de cobro"
        : "Falta conexión Mercado Pago del dueño (mpAccessToken)",
      hasMpAccessToken
        ? undefined
        : "Misma condición que /api/payments/mp/create-preference para ALBUM_ORDER."
    );
    if (!hasMpAccessToken && mpLinkedUi) {
      push(
        payments,
        "pay_mp_partial",
        "warning",
        "Hay señal de cuenta MP (mpUserId / mpConnectedAt) pero sin token OAuth en BD",
        "Reconectar Mercado Pago desde configuración del fotógrafo."
      );
    }
  }

  // —— Colaborativo ——
  if (!album.eventId) {
    push(
      collaborative,
      "col_none",
      "info",
      "Álbum independiente (sin eventId)",
      "No es subálbum de evento colaborativo."
    );
  } else if (!album.event) {
    push(
      collaborative,
      "col_broken",
      "error",
      "Relación rota: eventId está definido pero el evento no existe",
      "Revisar integridad de datos o migraciones."
    );
  } else {
    const ev = album.event;
    const isOrganizerAlbum = album.userId === ev.creatorId;

    push(
      collaborative,
      "col_event",
      "info",
      `Evento: ${ev.title} (id ${ev.id})`,
      ev.shareSlug
        ? `Galería pública típica: /g/${ev.shareSlug} (y flujos /e/ según producto)`
        : "Evento sin shareSlug: puede impedir enlaces públicos del evento."
    );

    if (ev.archivedAt) {
      push(
        collaborative,
        "col_archived",
        "warning",
        "Evento archivado o marcado como archivado",
        "Puede afectar visibilidad en listados de eventos."
      );
    }

    if (ev.shareSlug) {
      push(
        collaborative,
        "col_gallery",
        "info",
        `Galería pública agregada del evento: ruta /g/${ev.shareSlug}`,
        "Las fotos de cada álbum del evento se combinan en esa vista cuando cada álbum cumple reglas por foto."
      );
    }

    push(
      collaborative,
      "col_role",
      "info",
      isOrganizerAlbum
        ? "Álbum del organizador del evento (userId = creatorId del evento)"
        : "Subálbum de fotógrafo / colaborador dentro del evento (userId ≠ creatorId)",
      "En la galería unificada del evento se agregan fotos de álbumes que cumplen reglas por foto (isAlbumComplete + acceso público por álbum)."
    );

    push(
      collaborative,
      "col_count",
      "info",
      `Álbumes activos vinculados al evento: ${eventAlbumsCount}`,
      undefined
    );

    if (!isOrganizerAlbum) {
      pubExpectation = "SHOULD_NOT_BY_DESIGN";
      pubExpectationLabel =
        "Por diseño, el listado global de álbumes no muestra subálbumes de evento; lo público suele ser la galería del evento.";
    }
  }

  if (album.schoolId && album.school) {
    push(
      collaborative,
      "col_school",
      "info",
      `Álbum escolar vinculado a escuela: ${album.school.name || album.school.id}`,
      "Pueden aplicar reglas adicionales de preventa / packs escolares."
    );
  }

  const sections: AlbumDiagnosticsResult["sections"] = {
    general: { title: "1. Estado general", items: general },
    publication: {
      title: "2. Publicación y visibilidad",
      expectation: pubExpectation,
      expectationLabel: pubExpectationLabel,
      items: publication,
    },
    commercial: { title: "3. Configuración comercial", items: commercial },
    terms: { title: "4. Términos y publicación", items: terms },
    payments: { title: "5. Mercado Pago / cobro", items: payments },
    collaborative: { title: "6. Eventos colaborativos / contexto", items: collaborative },
  };

  const checks = mergeChecks(sections);
  const errors = checks.filter((c) => c.severity === "error");
  const warnings = checks.filter((c) => c.severity === "warning");

  let status: AlbumDiagnosticsExecutiveStatus = "READY";
  if (album.eventId && album.event && album.userId !== album.event.creatorId) {
    status = "SUBALBUM_EVENT_CONTEXT";
  } else if (errors.length > 0 || album.deletedAt) {
    status = "BLOCKED";
  } else if (warnings.length > 0 || !complete || (wantsSale && complete && !hasMpAccessToken)) {
    status = "READY_WITH_WARNINGS";
  }

  if (album.eventId && !album.event) {
    status = "NEEDS_REVIEW";
  }

  const primaryReasons: string[] = [];
  if (album.deletedAt) primaryReasons.push("Álbum eliminado (soft delete)");
  if (!publiclyAccessible) primaryReasons.push("No accesible como público (isPublic / isHidden)");
  if (!complete) primaryReasons.push("Configuración comercial o términos incompletos");
  if (wantsSale && complete && !hasMpAccessToken) primaryReasons.push("Falta mpAccessToken para cobrar con MP");
  if (album.eventId && album.event && album.userId !== album.event.creatorId) {
    primaryReasons.push("Contexto: subálbum de evento colaborativo");
  }
  if (primaryReasons.length === 0) primaryReasons.push("No se detectaron bloqueos graves con las reglas actuales");

  let headline = "Diagnóstico generado";
  if (status === "BLOCKED") headline = "Bloqueado o con errores críticos";
  else if (status === "SUBALBUM_EVENT_CONTEXT") headline = "Subálbum de evento colaborativo";
  else if (status === "READY_WITH_WARNINGS") headline = "Operativo con observaciones";
  else if (status === "READY") headline = "Sin problemas detectados por reglas automáticas";

  const data: AlbumDiagnosticsResult = {
    albumId: album.id,
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      canAppearInPublicDirectory: wouldAppearInDirectory,
      canSellStandardCheckout,
      anonymousCanPassPublicGate,
      headline,
      primaryReasons,
    },
    sections,
    checks,
    technicalDetail: {
      album: {
        id: album.id,
        title: album.title,
        publicSlug: album.publicSlug,
        userId: album.userId,
        creatorId: album.creatorId,
        eventId: album.eventId,
        schoolId: album.schoolId,
        type: album.type ? String(album.type) : null,
        isPublic: album.isPublic,
        isHidden: album.isHidden,
        deletedAt: album.deletedAt?.toISOString() ?? null,
        createdAt: album.createdAt.toISOString(),
        photosCount,
        isAlbumComplete: complete,
        isAlbumPubliclyAccessible: publiclyAccessible,
      },
      owner: {
        id: owner?.id ?? album.userId,
        name: owner?.name ?? null,
        email: owner?.email ?? null,
        role: String(owner?.role ?? ""),
        hasMpAccessToken,
        hasMpUserId,
        mpConnectedAt: owner?.mpConnectedAt?.toISOString() ?? null,
      },
      event: album.event
        ? {
            id: album.event.id,
            title: album.event.title,
            shareSlug: album.event.shareSlug,
            creatorId: album.event.creatorId,
            archivedAt: album.event.archivedAt?.toISOString() ?? null,
            visibility: String(album.event.visibility),
            albumsInEventCount: eventAlbumsCount,
          }
        : null,
      school: album.school ? { id: album.school.id, name: album.school.name } : null,
      flags: {
        hasActivePreventaPacks,
        visibleWindowExpired,
        firstPhotoDateIso: album.firstPhotoDate?.toISOString() ?? null,
      },
    },
  };

  return { ok: true, data };
}
