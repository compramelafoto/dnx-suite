/**
 * Mapa sugerencia/checklist del Asistente → campo del formulario Info Spot.
 * Los ids de sugerencia vienen de @repo/editorial-intelligence (rule-based).
 */

export type EditorialFocusTarget = {
  /** id del elemento a enfocar / scrollear */
  elementId: string;
  /** Abrir panel Configuración (SEO, slug, fuente…) */
  openConfig?: boolean;
};

const BY_SUGGESTION_ID: Record<string, EditorialFocusTarget> = {
  "geo-missing-scope": { elementId: "geographicScopeSelect" },
  "geo-missing-city": { elementId: "articleCity" },
  "geo-missing-province": { elementId: "articleProvince" },
  "geo-missing-lat": { elementId: "articleLat" },
  "geo-missing-lng": { elementId: "articleLng" },
  "geo-missing-country": { elementId: "articleCountry" },
  "seo-meta-empty": { elementId: "seoDescription", openConfig: true },
  "seo-meta-short": { elementId: "seoDescription", openConfig: true },
  "seo-meta-long": { elementId: "seoDescription", openConfig: true },
  "seo-title-empty": { elementId: "seoTitle", openConfig: true },
  "seo-title-short": { elementId: "title" },
  "seo-title-long": { elementId: "title" },
  "seo-slug-weak": { elementId: "slug", openConfig: true },
};

const BY_CHECKLIST_ID: Record<string, EditorialFocusTarget> = {
  title: { elementId: "title" },
  cover: { elementId: "cover-section-title" },
  category: { elementId: "categoryId" },
  location: { elementId: "geographicScopeSelect" },
  body: { elementId: "article-body-editor" },
  tags: { elementId: "title" },
  seo: { elementId: "seoDescription", openConfig: true },
  author: { elementId: "sourceName", openConfig: true },
  date: { elementId: "publishedAt", openConfig: true },
  source: { elementId: "sourceName", openConfig: true },
  call: { elementId: "cover-section-title" },
};

export function resolveSuggestionFocusTarget(
  suggestionId: string,
): EditorialFocusTarget | null {
  return BY_SUGGESTION_ID[suggestionId] ?? null;
}

export function resolveChecklistFocusTarget(
  checklistId: string,
): EditorialFocusTarget | null {
  return BY_CHECKLIST_ID[checklistId] ?? null;
}

const HIGHLIGHT_CLASS = "is-field-focus-pulse";

/** Abre details padres, hace scroll y enfoca el control. */
export function focusEditorialTarget(target: EditorialFocusTarget): void {
  const run = (attempts: number) => {
    const el = document.getElementById(target.elementId);
    if (!el) {
      if (attempts < 12) {
        window.setTimeout(() => run(attempts + 1), 40);
      }
      return;
    }

    let parent: HTMLElement | null = el;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const focusable =
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement
        ? el
        : el.querySelector<HTMLElement>(
            "input, select, textarea, button, [contenteditable='true']",
          );

    focusable?.focus({ preventScroll: true });

    const pulse = focusable ?? el;
    pulse.classList.add(HIGHLIGHT_CLASS);
    window.setTimeout(() => pulse.classList.remove(HIGHLIGHT_CLASS), 2200);
  };

  // Esperar un frame si hay que montar el drawer de configuración.
  window.setTimeout(() => run(0), target.openConfig ? 80 : 0);
}
