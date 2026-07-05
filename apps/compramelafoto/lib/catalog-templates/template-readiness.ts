import type { CatalogProductType } from "@/lib/prisma";
import {
  parseComponentsPayload,
  validateComponentsForProductType,
  type CatalogComponentInput,
} from "@/lib/catalog-products/components";
import type { AdminTemplateInput } from "@/lib/catalog-templates/admin-validation";
import type { StoredTemplateComponent } from "@/lib/catalog-templates/template-components";
import {
  mapCatalogProductToBenefitInputs,
  type CatalogComponentForMapper,
} from "@/lib/preventa-canjeable/catalog-to-preventa-mapper";

export type CatalogTemplateReadinessSeverity = "ok" | "warning" | "error";

export type CatalogTemplateReadinessItem = {
  id: string;
  severity: CatalogTemplateReadinessSeverity;
  title: string;
  detail?: string;
};

export type CatalogTemplateReadinessStatus = "READY" | "BLOCKED";

export type CatalogTemplateReadinessResult = {
  status: CatalogTemplateReadinessStatus;
  canActivate: boolean;
  canRecommend: boolean;
  headline: string;
  items: CatalogTemplateReadinessItem[];
};

export type CatalogTemplateReadinessInput = Pick<
  AdminTemplateInput,
  | "name"
  | "slug"
  | "description"
  | "fullDescription"
  | "visualCategory"
  | "productType"
  | "components"
  | "suggestedPriceCents"
  | "coverImageUrl"
  | "coverImageKey"
>;

function toCatalogComponentInputs(components: StoredTemplateComponent[]): CatalogComponentInput[] {
  return components.map((c, i) => ({
    name: c.name,
    quantity: c.quantity,
    deliveryType: c.deliveryType,
    sortOrder: i,
    notes: c.notes ?? "",
  }));
}

function toMapperComponents(components: StoredTemplateComponent[]): CatalogComponentForMapper[] {
  return components.map((c, i) => ({
    id: i + 1,
    name: c.name,
    quantity: c.quantity,
    deliveryType: c.deliveryType,
    sortOrder: c.sortOrder ?? i,
    notes: c.notes ?? "",
    requiresDesign: c.deliveryType === "DISEÑO",
    digitalQuantityMode: c.digitalQuantityMode,
  }));
}

/** Diagnóstico de requisitos mínimos para clonar / preventa / marketplace activo. */
export function assessCatalogTemplateReadiness(
  input: CatalogTemplateReadinessInput
): CatalogTemplateReadinessResult {
  const items: CatalogTemplateReadinessItem[] = [];
  const components = input.components ?? [];
  const componentInputs = toCatalogComponentInputs(components);

  if (input.name.trim().length < 2) {
    items.push({
      id: "name",
      severity: "error",
      title: "Nombre insuficiente",
      detail: "El nombre debe tener al menos 2 caracteres.",
    });
  } else {
    items.push({ id: "name", severity: "ok", title: "Nombre definido" });
  }

  if (!input.slug.trim()) {
    items.push({
      id: "slug",
      severity: "error",
      title: "Slug inválido",
      detail: "Definí un slug único para la plantilla.",
    });
  } else {
    items.push({ id: "slug", severity: "ok", title: "Slug válido" });
  }

  if (input.description.trim().length < 2) {
    items.push({
      id: "description",
      severity: "error",
      title: "Descripción corta faltante",
      detail: "Agregá una descripción breve visible para fotógrafos.",
    });
  } else {
    items.push({ id: "description", severity: "ok", title: "Descripción corta definida" });
  }

  if (input.fullDescription.trim().length < 10) {
    items.push({
      id: "full-description",
      severity: "warning",
      title: "Descripción completa breve",
      detail: "Recomendado: ampliá la descripción completa para el detalle del producto.",
    });
  }

  const typeError = validateComponentsForProductType(input.productType, componentInputs);
  if (typeError) {
    items.push({
      id: "components-type",
      severity: "error",
      title: "Componentes incompletos para el tipo",
      detail: typeError,
    });
  }

  if (components.length === 0) {
    items.push({
      id: "components-empty",
      severity: "error",
      title: "Sin componentes",
      detail:
        "Definí al menos un componente (digital, impreso o diseño) para que el pack sea clonable e importable a preventa.",
    });
  } else {
    const emptyNames = components.filter((c) => !c.name.trim());
    if (emptyNames.length > 0) {
      items.push({
        id: "component-names",
        severity: "error",
        title: "Componentes sin nombre",
        detail: "Todos los componentes deben tener un nombre.",
      });
    } else {
      items.push({
        id: "components-count",
        severity: "ok",
        title: `${components.length} componente${components.length === 1 ? "" : "s"} definido${components.length === 1 ? "" : "s"}`,
      });
    }
  }

  if (components.length > 0 && !typeError) {
    try {
      mapCatalogProductToBenefitInputs(toMapperComponents(components));
      items.push({
        id: "preventa-map",
        severity: "ok",
        title: "Compatible con preventa",
        detail: "Los componentes se pueden mapear a beneficios de PackDefinition.",
      });
    } catch (e) {
      items.push({
        id: "preventa-map",
        severity: "error",
        title: "No compatible con preventa",
        detail: e instanceof Error ? e.message : "Error al mapear componentes.",
      });
    }
  }

  if (input.suggestedPriceCents == null || input.suggestedPriceCents <= 0) {
    items.push({
      id: "price",
      severity: "error",
      title: "Precio sugerido faltante",
      detail: "Definí un precio sugerido mayor a cero (en centavos). Al clonar, sin precio se usa un fallback genérico.",
    });
  } else {
    items.push({
      id: "price",
      severity: "ok",
      title: "Precio sugerido definido",
    });
  }

  const hasCoverUrl = Boolean(input.coverImageUrl?.trim());
  const hasCoverKey = Boolean(input.coverImageKey?.trim());
  if (!hasCoverUrl || !hasCoverKey) {
    items.push({
      id: "cover",
      severity: "error",
      title: "Portada incompleta",
      detail: "Subí una imagen de portada cuadrada para mostrar la plantilla en el catálogo.",
    });
  } else {
    items.push({ id: "cover", severity: "ok", title: "Portada definida" });
  }

  const blockingErrors = items.filter((i) => i.severity === "error");
  const canActivate = blockingErrors.length === 0;

  return {
    status: canActivate ? "READY" : "BLOCKED",
    canActivate,
    canRecommend: canActivate,
    headline: canActivate
      ? "Lista para activarse y usarse por fotógrafos."
      : `Faltan ${blockingErrors.length} requisito${blockingErrors.length === 1 ? "" : "s"} antes de activar.`,
    items,
  };
}

export function assertCatalogTemplatePublishable(input: AdminTemplateInput): string | null {
  const readiness = assessCatalogTemplateReadiness(input);
  if (!readiness.canActivate) {
    const first = readiness.items.find((i) => i.severity === "error");
    return first?.detail ?? first?.title ?? "La plantilla no cumple los requisitos mínimos para publicarse.";
  }
  return null;
}

/** Valida flags de publicación en create/update admin. */
export function validateAdminTemplatePublishFlags(input: AdminTemplateInput): string | null {
  if (!input.isActive && !input.isRecommended) {
    return null;
  }
  return assertCatalogTemplatePublishable(input);
}

/** Helper para evaluar payload crudo del formulario admin. */
export function assessCatalogTemplateReadinessFromBody(raw: {
  name?: string;
  slug?: string;
  description?: string;
  fullDescription?: string;
  visualCategory?: string;
  productType?: CatalogProductType;
  components?: unknown;
  suggestedPriceCents?: number | null;
  coverImageUrl?: string | null;
  coverImageKey?: string | null;
}): CatalogTemplateReadinessResult {
  const componentsParsed = parseComponentsPayload(raw.components ?? []);
  const components: StoredTemplateComponent[] =
    typeof componentsParsed === "string"
      ? []
      : componentsParsed.map((c, i) => ({
          name: c.name,
          quantity: c.quantity,
          deliveryType: c.deliveryType,
          sortOrder: i,
          notes: c.notes,
        }));

  return assessCatalogTemplateReadiness({
    name: typeof raw.name === "string" ? raw.name : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    description: typeof raw.description === "string" ? raw.description : "",
    fullDescription: typeof raw.fullDescription === "string" ? raw.fullDescription : "",
    visualCategory:
      typeof raw.visualCategory === "string"
        ? (raw.visualCategory as CatalogTemplateReadinessInput["visualCategory"])
        : "combos",
    productType: raw.productType ?? "PACK",
    components,
    suggestedPriceCents: raw.suggestedPriceCents ?? null,
    coverImageUrl: raw.coverImageUrl ?? null,
    coverImageKey: raw.coverImageKey ?? null,
  });
}
