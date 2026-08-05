import type { ContestRulesConfiguration } from "./types";
import { contestLocalToUtc } from "../timezone/contest-windows";

/** ARS en unidades mínimas: pesos * 100 (centavos). */
export const SFEF_PRIZE_FIRST_MINOR = 500_000 * 100;
export const SFEF_PRIZE_SECOND_MINOR = 400_000 * 100;
export const SFEF_PRIZE_THIRD_MINOR = 300_000 * 100;

const TZ = "America/Argentina/Cordoba";

/** Ventanas en UTC derivadas de wall-clock ART (límite exclusivo 1 oct 00:00). */
function art(localIso: string): string {
  return contestLocalToUtc(localIso, TZ).toISOString();
}

const PIPELINE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const PIPELINE_EXT = ["jpg", "jpeg", "png", "webp"] as const;

/**
 * Configuración oficial Santa Fe en Foco 2026 (P0-09A).
 * Fuente: decisiones confirmadas en el prompt de etapa (no inventar más).
 */
export function buildSantaFeEnFoco2026Configuration(): ContestRulesConfiguration {
  const regOpen = art("2026-08-01T00:00:00");
  const closeExclusive = art("2026-10-01T00:00:00");

  return {
    schemaVersion: 1,
    identity: {
      officialName: "Santa Fe en Foco 2026",
      slug: "santa-fe-en-foco",
      description:
        "Concurso fotográfico sobre el deporte santafesino, con perspectiva documental, cultural, social, territorial o humana. Participación abierta: no se exige residencia en la Provincia de Santa Fe; la fotografía debe haberse tomado en el territorio provincial durante el período oficial.",
      organizers: [
        { name: "Sociedad de Fotógrafos Profesionales de Rosario", role: "organizador" },
        { name: "Cámara de Senadores de la Provincia de Santa Fe", role: "organizador" },
      ],
      participatingInstitutions: [
        "Sociedad de Fotógrafos Profesionales de Rosario",
        "Cámara de Senadores de la Provincia de Santa Fe",
      ],
      territoryScope: "Provincia de Santa Fe",
      country: "Argentina",
      province: "Santa Fe",
      siteUrl: null,
      contactEmail: null,
      language: "es-AR",
      timezone: TZ,
      platformName: "FotoRank",
    },
    schedule: {
      registrationOpensAt: regOpen,
      registrationClosesAtExclusive: closeExclusive,
      submissionOpensAt: regOpen,
      submissionClosesAtExclusive: closeExclusive,
      replaceClosesAtExclusive: closeExclusive,
      judgingStartsAt: null,
      judgingEndsAt: null,
      resultsAt: null,
      awardsAt: null,
      captureWindowStartsAt: regOpen,
      captureWindowEndsExclusiveAt: closeExclusive,
      timezone: TZ,
      publicScheduleNote:
        "Inscripción y carga desde el 1 de agosto de 2026 hasta el 30 de septiembre de 2026 inclusive (cierre exclusivo 1 de octubre 00:00 ART).",
    },
    participation: {
      pricingMode: "FREE",
      priceAmountMinor: 0,
      currency: "ARS",
      platformFeeBps: 0,
      minAge: 16,
      minorsAllowed: true,
      adultAuthorizationRequired: true,
      adultAuthorizationPendingHumanConfirmation: false,
      residencyRequired: false,
      residencyScope: null,
      individualOnly: true,
      maxRegistrationsPerPerson: 1,
      maxCategoriesPerRegistration: 1,
      maxEntriesPerRegistration: 1,
      allowReplaceUntilClose: true,
      allowWithdrawal: true,
    },
    theme: {
      summary: "Deporte santafesino con mirada documental, cultural, social, territorial o humana.",
      geographicScope: "Provincia de Santa Fe",
      temporalScopeNote: "Fotografías tomadas entre el 1 de agosto y el 30 de septiembre de 2026 inclusive.",
      subjectNotes: [
        "Participación abierta sin requisito de residencia del participante.",
        "La fotografía debe haberse tomado dentro de la Provincia de Santa Fe.",
        "La fotografía debe haberse tomado durante el período oficial de captura.",
        "Una fotografía por participante; una única categoría por fotografía.",
        "No exclusivamente relacionadas con los Juegos Suramericanos.",
      ],
    },
    categories: [
      {
        name: "Fotógrafo Profesional",
        slug: "fotografo-profesional",
        description:
          "Para personas que participan como fotógrafos profesionales. La fotografía debe haber sido realizada con una cámara fotográfica. No se admiten fotografías tomadas con teléfono celular.",
        deviceType: "CAMERA",
        particularRequirements:
          "Cámara fotográfica obligatoria (DSLR/mirrorless/compacta/bridge). Celular y dron no permitidos. PENDING_LEGAL_REVIEW para bases definitivas.",
        maxEntries: 1,
        active: true,
        sortOrder: 1,
        membershipRestriction: null,
      },
      {
        name: "Fotógrafo Amateur",
        slug: "fotografo-amateur",
        description:
          "Para fotógrafos aficionados. Se admiten fotografías realizadas con teléfono celular o cámara fotográfica.",
        deviceType: "OPEN",
        particularRequirements: "Celular o cámara. Dron no permitido (usar Fotografía Aérea). PENDING_LEGAL_REVIEW.",
        maxEntries: 1,
        active: true,
        sortOrder: 2,
        membershipRestriction: null,
      },
      {
        name: "Reportero Gráfico",
        slug: "reportero-grafico",
        description:
          "Para reporteros gráficos. Es obligatorio ingresar un número de socio de ARGRA, sujeto a verificación por la organización. PENDING_INSTITUTIONAL_APPROVAL / LEGAL REVIEW REQUIRED — no afirmar asociación oficial.",
        deviceType: "CAMERA",
        particularRequirements:
          "Número de socio ARGRA obligatorio (verificación manual). Sin logos ni patrocinio ARGRA. LEGAL REVIEW REQUIRED.",
        maxEntries: 1,
        active: true,
        sortOrder: 3,
        membershipRestriction: "ARGRA",
      },
      {
        name: "Fotografía Aérea",
        slug: "fotografia-aerea",
        description:
          "Para fotografías realizadas con dron. La organización podrá solicitar información técnica o documentación adicional. LEGAL REVIEW REQUIRED.",
        deviceType: "DRONE",
        particularRequirements:
          "Dron obligatorio. No equivalentes automáticos desde avión/edificio. Cumplimiento normativo declarado por el participante. LEGAL REVIEW REQUIRED.",
        maxEntries: 1,
        active: true,
        sortOrder: 4,
        membershipRestriction: null,
      },
    ],
    file: {
      supportedMimeTypes: [...PIPELINE_MIME],
      supportedExtensions: [...PIPELINE_EXT],
      maxFileSizeBytes: null,
      minWidth: null,
      minHeight: null,
      maxWidth: null,
      maxHeight: null,
      minMegapixels: null,
      aspectRatioRestricted: false,
      orientationFree: true,
      colorAllowed: true,
      blackAndWhiteAllowed: true,
      originalFileRequired: true,
      rawEventuallyRequested: false,
      internalSafetyMaxFileSizeBytes: 50 * 1024 * 1024,
      note: "Sin límites reglamentarios de peso/dimensiones. Solo límites técnicos internos de seguridad.",
    },
    metadata: {
      exifGeneral: { level: "RECOMMENDED", missingAction: "WARN" },
      captureDate: { level: "RECOMMENDED", missingAction: "REQUIRES_REVIEW" },
      gps: { level: "RECOMMENDED", missingAction: "ALLOW" },
      deviceModel: { level: "RECOMMENDED", missingAction: "REQUIRES_REVIEW" },
      lens: { level: "INFORMATIVE", missingAction: "ALLOW" },
      altitude: { level: "INFORMATIVE", missingAction: "ALLOW" },
      editingSoftware: { level: "INFORMATIVE", missingAction: "ALLOW" },
    },
    editing: {
      exposure: "ALLOWED",
      contrast: "ALLOWED",
      highlights: "ALLOWED",
      shadows: "ALLOWED",
      whiteBalance: "ALLOWED",
      color: "ALLOWED",
      saturation: "ALLOWED",
      crop: "ALLOWED",
      rotate: "ALLOWED",
      sharpen: "ALLOWED",
      noiseReduction: "ALLOWED",
      opticalCorrections: "ALLOWED",
      radialMasks: "ALLOWED",
      linearMasks: "ALLOWED",
      subjectMasks: "ALLOWED",
      skyMasks: "ALLOWED",
      hdr: "PROHIBITED",
      panoramas: "PROHIBITED",
      removeElements: "PROHIBITED",
      addElements: "PROHIBITED",
      skyReplacement: "PROHIBITED",
      photomontage: "PROHIBITED",
      multiComposition: "PROHIBITED",
      signatures: "PROHIBITED",
      frames: "PROHIBITED",
      watermarks: "PROHIBITED",
      notes:
        "Máscaras solo para ajustes de revelado. Prohibido alterar el contenido documental de la escena.",
    },
    ai: {
      fullyGeneratedImage: "PROHIBITED",
      generativeFill: "PROHIBITED",
      generativeRemove: "PROHIBITED",
      generativeExpand: "PROHIBITED",
      generativeAdd: "PROHIBITED",
      generativeReplace: "PROHIBITED",
      aiNoiseReduction: "ALLOWED",
      aiSharpen: "ALLOWED",
      smartMasks: "ALLOWED",
      autoSelect: "ALLOWED",
      autoDevelop: "ALLOWED",
      assistedColorCorrection: "ALLOWED",
      notes: "IA asistida de flujo de trabajo permitida; IA generativa de contenido prohibida.",
    },
    rights: {
      authorRetainsOwnership: true,
      authorshipDeclarationRequired: true,
      thirdPartyRightsCleared: true,
      imageAuthorizationRequired: true,
      licenseMandatory: true,
      licenseAppliesToAllWorks: true,
      exclusive: true,
      compensated: false,
      durationMonths: 12,
      territory: "Argentina / usos de los organizadores",
      purposes: [
        "institucional",
        "cultural",
        "educativo",
        "promocional",
        "publicacion",
        "exhibicion",
        "reproduccion",
        "redes",
        "catalogos",
        "productos",
        "comercial",
      ],
      allowReproduction: true,
      allowPublication: true,
      allowExhibition: true,
      allowInstitutional: true,
      allowEducational: true,
      allowCultural: true,
      allowPromotional: true,
      allowCommercial: true,
      allowPrint: true,
      allowCatalog: true,
      allowProducts: true,
      allowSocial: true,
      archivalHeritagePermanentForSelected: true,
      attributionRequired: true,
      sublicenseAllowed: null,
      conserveOriginal: true,
      deletionPolicyNote: null,
      legalReviewFlags: [
        "Revisar contradicción potencial entre licencia exclusiva temporal (todas las obras), titularidad del autor, uso patrimonial permanente de seleccionadas y sublicencia.",
      ],
    },
    jury: {
      minJudges: null,
      maxJudges: 5,
      judgesPendingHumanConfirmation: false,
      perCategory: true,
      decisionFinal: true,
      prizesMayBeDeserted: true,
      conflictOfInterestEnabled: true,
      anonymizedEvaluation: true,
      generalCriteria:
        "Hasta 5 integrantes (cantidad efectiva configurable); asignables por categoría; evaluación anónima; conflicto de interés obligatorio; fallo definitivo e inapelable; menciones especiales posibles.",
    },
    prizes: [
      ...(["fotografo-profesional", "fotografo-amateur", "reportero-grafico", "fotografia-aerea"] as const).flatMap(
        (categorySlug) => [
          {
            categorySlug,
            place: 1,
            amountMinor: SFEF_PRIZE_FIRST_MINOR,
            currency: "ARS",
            inKindDescription: null,
            isMention: false,
          },
          {
            categorySlug,
            place: 2,
            amountMinor: SFEF_PRIZE_SECOND_MINOR,
            currency: "ARS",
            inKindDescription: null,
            isMention: false,
          },
          {
            categorySlug,
            place: 3,
            amountMinor: SFEF_PRIZE_THIRD_MINOR,
            currency: "ARS",
            inKindDescription: null,
            isMention: false,
          },
        ],
      ),
    ],
    disqualifications: [
      { code: "AUTHORSHIP", label: "Autoría", severity: "DISQUALIFY", enabled: true },
      { code: "CATEGORY", label: "Categoría incorrecta", severity: "MANUAL_REVIEW", enabled: true },
      { code: "DATE", label: "Fecha fuera de ventana", severity: "MANUAL_REVIEW", enabled: true },
      { code: "TERRITORY", label: "Fuera del territorio", severity: "MANUAL_REVIEW", enabled: true },
      { code: "EDITING", label: "Edición prohibida", severity: "DISQUALIFY", enabled: true },
      { code: "AI_GENERATIVE", label: "IA generativa", severity: "DISQUALIFY", enabled: true },
      { code: "PHOTOMONTAGE", label: "Fotomontaje", severity: "DISQUALIFY", enabled: true },
      { code: "WATERMARK", label: "Marca de agua / firma", severity: "REQUEST_REPLACE", enabled: true },
      { code: "DUPLICATE", label: "Duplicado", severity: "DISQUALIFY", enabled: true },
      { code: "THIRD_PARTY", label: "Derechos de terceros", severity: "DISQUALIFY", enabled: true },
    ],
  };
}
