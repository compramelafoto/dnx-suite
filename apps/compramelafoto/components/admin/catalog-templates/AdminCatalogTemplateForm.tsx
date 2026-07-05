"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProductType } from "@/lib/prisma";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsField } from "@/components/ui/DsField";
import Textarea from "@/components/ui/Textarea";
import AdminCatalogTemplateComponentsEditor from "@/components/admin/catalog-templates/AdminCatalogTemplateComponentsEditor";
import AdminCatalogTemplateReadinessPanel, {
  useCatalogTemplateReadiness,
} from "@/components/admin/catalog-templates/AdminCatalogTemplateReadinessPanel";
import AdminCatalogTemplatePreviewCard, {
  adminDetailToPreviewState,
  type AdminTemplateFormPreviewState,
} from "@/components/admin/catalog-templates/AdminCatalogTemplatePreviewCard";
import type { AdminCatalogTemplateDetail } from "@/lib/catalog-templates/admin-serialize";
import {
  ADMIN_TEMPLATE_BADGE_OPTIONS,
  ADMIN_TEMPLATE_COLLECTION_OPTIONS,
} from "@/lib/catalog-templates/admin-serialize";
import { slugifyTemplateName } from "@/lib/catalog-templates/slugify-template";
import type { CatalogTemplateBadgeId } from "@/lib/catalog-templates/template-badges";
import {
  getVisualCategoryList,
  type VisualCatalogCategoryId,
} from "@/lib/catalog-templates/visual-categories";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";

type Props = {
  mode: "create" | "edit";
  initial?: AdminCatalogTemplateDetail | null;
};

type FormSection = "general" | "media" | "commercial" | "publish" | "components";

const FORM_SECTIONS: { id: FormSection; label: string }[] = [
  { id: "general", label: "Contenido" },
  { id: "media", label: "Portada" },
  { id: "commercial", label: "Comercial" },
  { id: "publish", label: "Publicación" },
  { id: "components", label: "Componentes" },
];

const PRODUCT_TYPES: CatalogProductType[] = ["SIMPLE", "PACK", "COMBO"];
const visualCategories = getVisualCategoryList();

function defaultFormState() {
  return {
    name: "",
    slug: "",
    description: "",
    fullDescription: "",
    visualCategory: "combos" as VisualCatalogCategoryId,
    productType: "PACK" as CatalogProductType,
    coverImageUrl: null as string | null,
    coverImageKey: null as string | null,
    suggestedPriceCents: null as number | null,
    currency: "ARS",
    tagsInput: "",
    badges: [] as CatalogTemplateBadgeId[],
    components: [] as AdminTemplateFormPreviewState["components"],
    isActive: false,
    isRecommended: false,
    featured: false,
    collection: "",
    editableByPhotographer: true,
    sortOrder: 0,
    version: 1,
    bumpVersion: false,
  };
}

function detailToForm(template: AdminCatalogTemplateDetail) {
  return {
    ...adminDetailToPreviewState(template),
    fullDescription: template.fullDescription,
    isActive: template.isActive,
    featured: template.featured,
    collection: template.collection ?? "",
    editableByPhotographer: template.editableByPhotographer,
    sortOrder: template.sortOrder,
    version: template.version,
    coverImageKey: template.coverImageKey,
    tagsInput: template.tags.join(", "),
    bumpVersion: false,
  };
}

export default function AdminCatalogTemplateForm({ mode, initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Partial<Record<FormSection, HTMLElement | null>>>({});
  const [activeSection, setActiveSection] = useState<FormSection>("general");
  const [form, setForm] = useState(() =>
    initial ? detailToForm(initial) : defaultFormState()
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  const previewState: AdminTemplateFormPreviewState = {
    id: initial?.id,
    name: form.name,
    slug: form.slug,
    description: form.description,
    visualCategory: form.visualCategory,
    productType: form.productType,
    coverImageUrl: form.coverImageUrl,
    suggestedPriceCents: form.suggestedPriceCents,
    currency: form.currency,
    tags: form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    badges: form.badges,
    isRecommended: form.isRecommended,
    components: form.components,
  };

  const patch = useCallback(
    (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next })),
    []
  );

  function scrollToSection(id: FormSection) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNameChange(name: string) {
    const next: Partial<typeof form> = { name };
    if (!slugTouched) next.slug = slugifyTemplateName(name);
    patch(next);
  }

  function toggleBadge(id: CatalogTemplateBadgeId) {
    patch({
      badges: form.badges.includes(id)
        ? form.badges.filter((b) => b !== id)
        : [...form.badges, id],
    });
  }

  async function handleCoverUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/catalog-templates/upload-cover", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo subir la portada.");
        return;
      }
      patch({
        coverImageUrl: data.coverImageUrl ?? null,
        coverImageKey: data.coverImageKey ?? null,
      });
    } finally {
      setUploading(false);
    }
  }

  const readiness = useCatalogTemplateReadiness({
    name: form.name,
    slug: form.slug,
    description: form.description,
    fullDescription: form.fullDescription,
    visualCategory: form.visualCategory,
    productType: form.productType,
    components: form.components,
    suggestedPriceCents: form.suggestedPriceCents,
    coverImageUrl: form.coverImageUrl,
    coverImageKey: form.coverImageKey,
  });

  function trySetPublishFlag(field: "isActive" | "isRecommended", next: boolean) {
    if (next && !readiness.canActivate) {
      setError(
        "Completá todos los requisitos del diagnóstico antes de activar o marcar como recomendado."
      );
      return;
    }
    patch({ [field]: next });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      fullDescription: form.fullDescription,
      visualCategory: form.visualCategory,
      productType: form.productType,
      tags,
      badges: form.badges,
      components: form.components,
      isActive: form.isActive,
      isRecommended: form.isRecommended,
      featured: form.featured,
      collection: form.collection || null,
      editableByPhotographer: form.editableByPhotographer,
      sortOrder: form.sortOrder,
      version: form.version,
      suggestedPriceCents: form.suggestedPriceCents,
      currency: form.currency,
      coverImageUrl: form.coverImageUrl,
      coverImageKey: form.coverImageKey,
      bumpVersion: form.bumpVersion,
    };

    if ((form.isActive || form.isRecommended) && !readiness.canActivate) {
      setError("Completá los requisitos del diagnóstico antes de publicar la plantilla.");
      setSaving(false);
      return;
    }

    try {
      const url =
        mode === "create"
          ? "/api/admin/catalog-templates"
          : `/api/admin/catalog-templates/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        return;
      }
      router.push(`/admin/catalog-templates/${data.template.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!initial?.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog-templates/${initial.id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo duplicar.");
        return;
      }
      router.push(`/admin/catalog-templates/${data.template.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ds-admin-form-layout">
      <div className="ds-admin-form-main min-w-0">
        {error ? (
          <div
            className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <nav className="ds-admin-form-nav" aria-label="Secciones del formulario">
          {FORM_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="ds-admin-form-nav__tab"
              aria-selected={activeSection === section.id}
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <section
          id="section-general"
          ref={(el) => {
            sectionRefs.current.general = el;
          }}
          className="ds-admin-form-section scroll-mt-4"
        >
          <div className="ds-admin-form-section__header">
            <h2 className="ds-admin-form-section__title">Contenido</h2>
            <p className="ds-admin-form-section__desc">Nombre, descripciones y clasificación.</p>
          </div>
          <div className="ds-admin-form-section__body">
            <div className="ds-admin-form-grid-2">
              <DsField label="Nombre" htmlFor="tpl-name">
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </DsField>
              <DsField label="Slug" htmlFor="tpl-slug" hint="Único en el sistema.">
                <Input
                  id="tpl-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: e.target.value.toLowerCase() });
                  }}
                  required
                />
              </DsField>
            </div>
            <DsField label="Descripción corta" htmlFor="tpl-desc">
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </DsField>
            <DsField label="Descripción completa" htmlFor="tpl-full">
              <Textarea
                id="tpl-full"
                className="min-h-[7.5rem] text-sm leading-relaxed"
                value={form.fullDescription}
                onChange={(e) => patch({ fullDescription: e.target.value })}
              />
            </DsField>
            <div className="ds-admin-form-grid-2">
              <DsField label="Categoría visual">
                <Select
                  value={form.visualCategory}
                  onChange={(e) =>
                    patch({ visualCategory: e.target.value as VisualCatalogCategoryId })
                  }
                >
                  {visualCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </DsField>
              <DsField label="Tipo de producto">
                <Select
                  value={form.productType}
                  onChange={(e) =>
                    patch({ productType: e.target.value as CatalogProductType })
                  }
                >
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CATALOG_PRODUCT_TYPE_DISPLAY[t]}
                    </option>
                  ))}
                </Select>
              </DsField>
            </div>
            <DsField label="Tags" hint="Separados por coma.">
              <Input
                value={form.tagsInput}
                onChange={(e) => patch({ tagsInput: e.target.value })}
                placeholder="digital, escolar, premium"
              />
            </DsField>
          </div>
        </section>

        <section
          id="section-media"
          ref={(el) => {
            sectionRefs.current.media = el;
          }}
          className="ds-admin-form-section scroll-mt-4"
        >
          <div className="ds-admin-form-section__header">
            <h2 className="ds-admin-form-section__title">Portada</h2>
            <p className="ds-admin-form-section__desc">Imagen principal de la card en el marketplace.</p>
          </div>
          <div className="ds-admin-cover-upload">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCoverUpload(file);
                e.target.value = "";
              }}
            />
            {form.coverImageUrl ? (
              <div className="ds-admin-cover-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.coverImageUrl} alt="Vista previa de portada" />
              </div>
            ) : (
              <div className="ds-admin-cover-empty">
                <span className="ds-admin-cover-empty__icon" aria-hidden>
                  🖼
                </span>
                <p className="ds-admin-cover-empty__text">
                  Sin portada se usa un fallback por categoría. Recomendado: 1000×1000 px, JPG o WebP.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Subiendo…" : form.coverImageUrl ? "Reemplazar" : "Subir portada"}
              </Button>
              {form.coverImageUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => patch({ coverImageUrl: null, coverImageKey: null })}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section
          id="section-commercial"
          ref={(el) => {
            sectionRefs.current.commercial = el;
          }}
          className="ds-admin-form-section scroll-mt-4"
        >
          <div className="ds-admin-form-section__header">
            <h2 className="ds-admin-form-section__title">Comercial</h2>
            <p className="ds-admin-form-section__desc">Precio sugerido y orden en el listado.</p>
          </div>
          <div className="ds-admin-form-section__body">
            <div className="ds-admin-form-grid-3">
              <DsField label="Precio sugerido (centavos)">
                <Input
                  type="number"
                  min={0}
                  value={form.suggestedPriceCents ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    patch({
                      suggestedPriceCents: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0),
                    });
                  }}
                  placeholder="500000"
                />
              </DsField>
              <DsField label="Moneda">
                <Input
                  value={form.currency}
                  onChange={(e) => patch({ currency: e.target.value.toUpperCase() })}
                />
              </DsField>
              <DsField label="Orden">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => patch({ sortOrder: parseInt(e.target.value, 10) || 0 })}
                />
              </DsField>
            </div>
            <DsField label="Colección">
              <Select
                value={form.collection}
                onChange={(e) => patch({ collection: e.target.value })}
              >
                <option value="">— Ninguna —</option>
                {ADMIN_TEMPLATE_COLLECTION_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </DsField>
            <label className="ds-admin-toggle-pill w-fit" aria-pressed={form.editableByPhotographer}>
              <input
                type="checkbox"
                checked={form.editableByPhotographer}
                onChange={(e) => patch({ editableByPhotographer: e.target.checked })}
              />
              Editable por el fotógrafo
            </label>
          </div>
        </section>

        <section
          id="section-publish"
          ref={(el) => {
            sectionRefs.current.publish = el;
          }}
          className="ds-admin-form-section scroll-mt-4"
        >
          <div className="ds-admin-form-section__header">
            <h2 className="ds-admin-form-section__title">Publicación</h2>
            <p className="ds-admin-form-section__desc">Visibilidad, badges y versión.</p>
          </div>
          <div className="ds-admin-form-section__body">
            <div className="ds-admin-toggle-row">
              <label className="ds-admin-toggle-pill" aria-pressed={form.isActive}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => trySetPublishFlag("isActive", e.target.checked)}
                />
                Activo
              </label>
              <label className="ds-admin-toggle-pill" aria-pressed={form.isRecommended}>
                <input
                  type="checkbox"
                  checked={form.isRecommended}
                  onChange={(e) => trySetPublishFlag("isRecommended", e.target.checked)}
                />
                Recomendado
              </label>
              <label className="ds-admin-toggle-pill" aria-pressed={form.featured}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => patch({ featured: e.target.checked })}
                />
                Featured
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-[#374151] m-0 mb-2">Badges en la card</p>
              <div className="ds-admin-badge-picker">
                {ADMIN_TEMPLATE_BADGE_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="ds-admin-badge-option"
                    aria-pressed={form.badges.includes(b.id)}
                    onClick={() => toggleBadge(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ds-admin-form-grid-2 pt-1 border-t border-[#f3f4f6]">
              <DsField label="Versión">
                <Input
                  type="number"
                  min={1}
                  value={form.version}
                  onChange={(e) =>
                    patch({ version: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                />
              </DsField>
              <div className="flex items-end">
                <label className="ds-admin-toggle-pill mb-0.5" aria-pressed={form.bumpVersion}>
                  <input
                    type="checkbox"
                    checked={form.bumpVersion}
                    onChange={(e) => patch({ bumpVersion: e.target.checked })}
                  />
                  +1 al guardar
                </label>
              </div>
            </div>
            {initial?.cloneCount ? (
              <p className="text-xs text-[#9ca3af] m-0 leading-relaxed">
                {initial.cloneCount} clon(es) existente(s). Cambios no afectan productos ya
                agregados por fotógrafos.
              </p>
            ) : null}
          </div>
        </section>

        <section
          id="section-components"
          ref={(el) => {
            sectionRefs.current.components = el;
          }}
          className="ds-admin-form-section scroll-mt-4"
        >
          <div className="ds-admin-form-section__header">
            <h2 className="ds-admin-form-section__title">Componentes</h2>
            <p className="ds-admin-form-section__desc">Ítems incluidos en packs y combos.</p>
          </div>
          <AdminCatalogTemplateComponentsEditor
            components={form.components}
            productType={form.productType}
            onChange={(components) => patch({ components })}
          />
        </section>

        <AdminCatalogTemplateReadinessPanel
          name={form.name}
          slug={form.slug}
          description={form.description}
          fullDescription={form.fullDescription}
          visualCategory={form.visualCategory}
          productType={form.productType}
          components={form.components}
          suggestedPriceCents={form.suggestedPriceCents}
          coverImageUrl={form.coverImageUrl}
          coverImageKey={form.coverImageKey}
          isActive={form.isActive}
          isRecommended={form.isRecommended}
        />

        <div className="ds-admin-form-actions ds-admin-form-actions--sticky">
          <Button type="submit" variant="primary" disabled={saving || uploading}>
            {saving ? "Guardando…" : mode === "create" ? "Crear template" : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/admin/catalog-templates")}
          >
            Cancelar
          </Button>
          {mode === "edit" && initial ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void handleDuplicate()}
            >
              Duplicar
            </Button>
          ) : null}
        </div>
      </div>

      <aside className="ds-admin-form-preview">
        <AdminCatalogTemplatePreviewCard state={previewState} />
      </aside>
    </form>
  );
}
