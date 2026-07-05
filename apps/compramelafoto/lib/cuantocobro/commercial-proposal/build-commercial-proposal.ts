import {
  formatBusinessProfileAddress,
  getBusinessProfileDisplayName,
  getBusinessProfileResponsibleName,
  type CuantoCobroBusinessProfile,
} from "../business-profile";
import {
  resolveBrandingLogoUrl,
} from "../quote/quote-branding-snapshot";
import {
  buildCommercialQuoteGroups,
  CC_TOTAL_ONLY_LINE_LABEL,
  getEffectiveCommercialNote,
} from "../commercial-presentation";
import { formatCuantoCobroCurrency } from "../calculate-cuanto-cobro";
import {
  buildPaymentOptionsSnapshot,
  parsePaymentOptionsSnapshot,
  resolvePhotographerCountryCode,
} from "../payment";
import type { CuantoCobroPaymentOptionsSnapshot } from "../payment/payment-options-types";
import type { CuantoCobroCalculationComplete, CuantoCobroQuoteInput } from "../types";
import { CC_GREEN_PRIMARY } from "../theme";
import { buildCommercialPaymentCards } from "./build-commercial-payment-cards";
import type {
  CommercialProposalContactLine,
  CommercialProposalIncludeItem,
  CommercialProposalMetaItem,
  CommercialProposalModel,
} from "./commercial-proposal-types";

const JOB_TYPE_LABELS: Record<string, string> = {
  boda: "Boda",
  evento: "Evento",
  retrato: "Retrato / sesión",
  producto: "Producto / comercial",
  escolar: "Fotografía escolar",
  otro: "Otro",
};

const CC_DEFAULT_CLOSING_MESSAGE =
  "Muchas gracias por confiar en nosotros. Será un placer acompañarte.";

export function buildCommercialProposalIntro(clientName: string): string {
  const trimmed = clientName.trim();
  const firstName = trimmed.split(/\s+/)[0] || "";
  const greeting = firstName ? `Hola ${firstName}.` : "Hola.";

  return `${greeting} Gracias por confiar en nosotros. Preparamos esta propuesta teniendo en cuenta las características de tu evento. A continuación encontrarás el detalle de la cobertura y las opciones de contratación disponibles.`;
}

function formatJobDate(value: string): string {
  if (!value) return "";
  try {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatClientDisplayName(client: CuantoCobroQuoteInput["client"]): string {
  const name = client.name.trim();
  const company = client.company.trim();
  if (name && company) return `${name} · ${company}`;
  return name || company;
}

function extractValidityLabel(commercialNote: string): string | null {
  const match = commercialNote.match(/v[aá]lid[oa]\s+por\s+(\d+)\s+d[ií]as/i);
  if (!match) return null;
  return `${match[1]} días`;
}

function normalizeWebsiteHref(website: string): string | undefined {
  const trimmed = website.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeInstagramHref(instagram: string): string | undefined {
  const trimmed = instagram.trim().replace(/^@/, "");
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://instagram.com/${trimmed}`;
}

function buildBusinessContactLines(profile: CuantoCobroBusinessProfile | null): CommercialProposalContactLine[] {
  if (!profile) return [];

  const lines: CommercialProposalContactLine[] = [];

  if (profile.commercialEmail.trim()) {
    lines.push({
      label: "Email",
      value: profile.commercialEmail.trim(),
      href: `mailto:${profile.commercialEmail.trim()}`,
    });
  }

  if (profile.phone.trim()) {
    const phone = profile.phone.trim();
    const digits = phone.replace(/\D/g, "");
    lines.push({
      label: "Teléfono",
      value: phone,
      href: digits ? `https://wa.me/${digits}` : undefined,
    });
  }

  if (profile.instagram.trim()) {
    const handle = profile.instagram.trim();
    lines.push({
      label: "Instagram",
      value: handle.startsWith("@") ? handle : `@${handle.replace(/^@/, "")}`,
      href: normalizeInstagramHref(handle),
    });
  }

  if (profile.website.trim()) {
    lines.push({
      label: "Web",
      value: profile.website.trim(),
      href: normalizeWebsiteHref(profile.website),
    });
  }

  const address = formatBusinessProfileAddress(profile);
  if (address) {
    lines.push({ label: "Dirección", value: address });
  }

  return lines;
}

function buildGroupsFromConceptTypes(quote: CuantoCobroQuoteInput): CommercialProposalIncludeItem[] {
  const TYPE_LABELS: Record<string, string> = {
    "own-service": "Servicios fotográficos",
    "physical-product": "Productos físicos",
    outsourced: "Servicios tercerizados",
    expense: "Viáticos y logística",
  };

  const types = new Set(quote.concepts.map((concept) => concept.itemType));
  return Array.from(types).map((type) => ({
    id: `group-${type}`,
    title: TYPE_LABELS[type] ?? "Servicios contratados",
  }));
}

function buildIncludes(input: {
  quote: CuantoCobroQuoteInput;
  calculation: CuantoCobroCalculationComplete;
}): CommercialProposalIncludeItem[] {
  const { quote, calculation } = input;
  const displayMode = quote.commercialDisplayMode;
  const items: CommercialProposalIncludeItem[] = [];
  const seen = new Set<string>();

  function pushItem(id: string, title: string, description?: string) {
    const key = `${title}::${description ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id, title, description });
  }

  if (displayMode === "total-only") {
    pushItem("total-only", CC_TOTAL_ONLY_LINE_LABEL);
    return items;
  }

  if (displayMode === "grouped") {
    const quoteSummary = calculation.quoteSummary;
    const groups = quoteSummary
      ? buildCommercialQuoteGroups({
          clientManagementAmount: calculation.clientSummary?.suggestedPrice ?? 0,
          subtotalOwnService: quoteSummary.subtotalOwnService,
          subtotalPhysicalProduct: quoteSummary.subtotalPhysicalProduct,
          subtotalOutsourced: quoteSummary.subtotalOutsourced,
          subtotalExpense: quoteSummary.subtotalExpense,
        })
      : [];

    if (groups.length > 0) {
      for (const group of groups) {
        pushItem(`group-${group.id}`, group.label);
      }
      return items;
    }

    const fallbackGroups = buildGroupsFromConceptTypes(quote);
    if (fallbackGroups.length > 0) return fallbackGroups;

    pushItem("service", "Servicio fotográfico personalizado");
    return items;
  }

  const hasOwnService = quote.concepts.some((concept) => concept.itemType === "own-service");
  if (hasOwnService) {
    pushItem("coverage", "Cobertura fotográfica profesional");
    pushItem("editing", "Edición profesional de las imágenes seleccionadas");
    pushItem("gallery", "Galería privada y descarga en alta resolución");
  }

  if ((calculation.clientSummary?.suggestedPrice ?? 0) > 0) {
    pushItem("coordination", "Coordinación y gestión del servicio");
  }

  for (const concept of quote.concepts) {
    const title = concept.name.trim();
    if (!title) continue;
    pushItem(
      concept.id,
      title,
      concept.description.trim() || undefined,
    );
  }

  if (items.length === 0) {
    pushItem("service", "Servicio fotográfico personalizado según tu evento");
  }

  return items;
}

export function buildCommercialProposalModel(input: {
  quote: CuantoCobroQuoteInput;
  calculation: CuantoCobroCalculationComplete;
  businessProfile?: CuantoCobroBusinessProfile | null;
  paymentOptionsSnapshot?: CuantoCobroPaymentOptionsSnapshot | unknown | null;
  quoteNumber?: string | null;
  versionNumber?: number | null;
  introMessage?: string;
  accentColor?: string | null;
}): CommercialProposalModel {
  const { quote, calculation, businessProfile = null } = input;
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, calculation.currency);
  const client = quote.client;
  const clientDisplayName = formatClientDisplayName(client);
  const jobTypeLabel = JOB_TYPE_LABELS[client.jobType] ?? client.jobType;
  const commercialNote = getEffectiveCommercialNote(quote.commercialNote);
  const validity = extractValidityLabel(commercialNote);

  const frozenPaymentSnapshot = parsePaymentOptionsSnapshot(input.paymentOptionsSnapshot);
  const paymentSnapshot =
    frozenPaymentSnapshot ??
    buildPaymentOptionsSnapshot({
      basePrice: calculation.chosenPriceEffective,
      currency: calculation.currency,
      countryCode: resolvePhotographerCountryCode({
        businessCountry: businessProfile?.country,
        profileCurrency: calculation.currency,
      }),
      paymentOptions: quote.paymentOptions,
    });

  const meta: CommercialProposalMetaItem[] = [];
  if (clientDisplayName) meta.push({ label: "Cliente", value: clientDisplayName });
  if (client.jobType) meta.push({ label: "Tipo de trabajo", value: jobTypeLabel });
  if (client.jobDate) meta.push({ label: "Fecha del evento", value: formatJobDate(client.jobDate) });
  if (input.quoteNumber) meta.push({ label: "N.º de propuesta", value: input.quoteNumber });
  if (input.versionNumber) meta.push({ label: "Revisión", value: `V${input.versionNumber}` });
  if (validity) meta.push({ label: "Vigencia", value: validity });

  const displayName = businessProfile ? getBusinessProfileDisplayName(businessProfile) : "";
  const responsibleName = businessProfile ? getBusinessProfileResponsibleName(businessProfile) : "";
  const signatureName = displayName || responsibleName || "Tu fotógrafo";
  const signatureContact = businessProfile
    ? [businessProfile.commercialEmail.trim(), businessProfile.phone.trim()].filter(Boolean).join(" · ") || null
    : null;

  return {
    currency: calculation.currency,
    accentColor: input.accentColor?.trim() || CC_GREEN_PRIMARY,
    business: {
      logoUrl: resolveBrandingLogoUrl(businessProfile) || businessProfile?.logoUrl.trim() || null,
      displayName,
      responsibleName: responsibleName && responsibleName !== displayName ? responsibleName : null,
      contactLines: buildBusinessContactLines(businessProfile),
    },
    documentTitle: "Propuesta personalizada",
    meta,
    introMessage: input.introMessage ?? buildCommercialProposalIntro(client.name),
    includesTitle: "Tu propuesta incluye",
    includes: buildIncludes({ quote, calculation }),
    investmentLabel: "Inversión",
    investmentAmount: fmt(calculation.chosenPriceEffective),
    paymentCards: buildCommercialPaymentCards(paymentSnapshot, fmt),
    conditionsTitle: "Condiciones",
    conditionsText: commercialNote,
    closingMessage: CC_DEFAULT_CLOSING_MESSAGE,
    signatureName,
    signatureContact,
  };
}

export function commercialProposalModelExposesInternalData(model: CommercialProposalModel): boolean {
  const serialized = JSON.stringify({
    includes: model.includes,
    investmentAmount: model.investmentAmount,
    paymentCards: model.paymentCards,
    conditionsText: model.conditionsText,
    introMessage: model.introMessage,
    meta: model.meta,
  }).toLowerCase();
  const forbidden = [
    "minimumsustainableprice",
    "hourlyrate",
    "monthlyneed",
    "estimatedmargin",
    "profitability",
    "laborcost",
    "vhh",
  ];
  return forbidden.some((needle) => serialized.includes(needle));
}
