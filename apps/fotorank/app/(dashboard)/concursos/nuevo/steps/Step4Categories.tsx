"use client";

import { Button, Icon, IconButton } from "@repo/design-system";
import type { ContestCategoryInput } from "../../../../actions/contests";
import type { WizardData } from "../CreateContestWizard";
import { normalizeSlug } from "../../../../lib/fotorank/slug";
import { FormField, inputWizard, textareaWizard } from "../../../../components/ui/form";
import { WizardSection } from "../../../../components/ui/wizard/WizardSection";

interface Step4CategoriesProps {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  fieldErrors?: Record<string, string>;
}

export function Step4Categories({ data, updateData, fieldErrors = {} }: Step4CategoriesProps) {
  const updateCategory = (index: number, updates: Partial<ContestCategoryInput>) => {
    const next = [...data.categories];
    const current = next[index];
    if (!current) return;
    next[index] = {
      name: current.name,
      slug: current.slug,
      description: current.description ?? "",
      maxFiles: current.maxFiles,
      sortOrder: current.sortOrder,
      ...updates,
    } as ContestCategoryInput;
    updateData({ categories: next });
  };

  const addCategory = () => {
    updateData({
      categories: [
        ...data.categories,
        {
          name: "",
          slug: "",
          description: "",
          maxFiles: 1,
          sortOrder: data.categories.length,
        } as ContestCategoryInput,
      ],
    });
  };

  const removeCategory = (index: number) => {
    if (data.categories.length <= 1) return;
    const next = data.categories.filter((_, i) => i !== index);
    next.forEach((c, i) => (c.sortOrder = i));
    updateData({ categories: next });
  };

  const handleNameChange = (index: number, name: string) => {
    const slug = normalizeSlug(name);
    const currentSlug = data.categories[index]?.slug ?? "";
    updateCategory(index, { name, slug: slug || currentSlug });
  };

  return (
    <WizardSection variant="plain">
      <div className="space-y-6">
        {fieldErrors.categories ? (
          <p className="text-sm font-medium text-red-400" role="alert" aria-live="polite">
            {fieldErrors.categories}
          </p>
        ) : null}
        {data.categories.map((cat, i) => (
          <div
            key={i}
            className="mx-auto w-[86%] max-w-full rounded-xl border border-[#333] bg-[#080808] p-5 shadow-inner transition-colors hover:border-[#3d3d3d] md:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#262626] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fr-primary sm:text-xs">
                Categoría {i + 1}
              </span>
              <IconButton
                type="button"
                variant="destructive"
                size="sm"
                icon="delete"
                aria-label={`Eliminar categoría ${i + 1}`}
                disabled={data.categories.length <= 1}
                onClick={() => removeCategory(i)}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
              <FormField
                id={`cat-name-${i}`}
                label="Nombre"
                required
                variant="wizard"
                error={fieldErrors[`categoryName-${i}`]}
                microcopy="Ej. Retrato, Paisaje, fauna urbana."
              >
                <input
                  id={`cat-name-${i}`}
                  type="text"
                  required
                  value={cat.name}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder="Ej. Paisajes"
                  className={inputWizard}
                  aria-invalid={!!fieldErrors[`categoryName-${i}`]}
                />
              </FormField>

              <FormField
                id={`cat-slug-${i}`}
                label="Slug"
                required
                variant="wizard"
                error={fieldErrors[`categorySlug-${i}`]}
                microcopy="Identificador corto en URL o filtros internos."
                hint="Minúsculas y guiones. Se genera desde el nombre."
              >
                <input
                  id={`cat-slug-${i}`}
                  type="text"
                  required
                  value={cat.slug}
                  onChange={(e) => updateCategory(i, { slug: e.target.value.toLowerCase() })}
                  placeholder="paisajes"
                  className={inputWizard}
                  aria-invalid={!!fieldErrors[`categorySlug-${i}`]}
                />
              </FormField>

              <FormField label="Descripción (opcional)" className="sm:col-span-2" variant="wizard">
                <textarea
                  rows={2}
                  value={cat.description || ""}
                  onChange={(e) => updateCategory(i, { description: e.target.value })}
                  placeholder="Opcional: reglas específicas de esta categoría."
                  className={textareaWizard}
                />
              </FormField>

              <FormField
                label="Máximo de archivos por participante"
                variant="wizard"
                microcopy="Cuántas fotos puede subir una persona en esta categoría."
              >
                <input
                  type="number"
                  min={1}
                  value={cat.maxFiles}
                  onChange={(e) =>
                    updateCategory(i, { maxFiles: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className={inputWizard}
                />
              </FormField>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={addCategory}
          className="flex w-full min-h-[3.25rem] items-center justify-center gap-3 border-2 border-dashed border-[#333] bg-transparent py-5 hover:border-gold/45 hover:bg-gold/[0.06]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-current">
            <Icon name="plus" size="sm" aria-hidden />
          </span>
          Agregar otra categoría
        </Button>
      </div>
    </WizardSection>
  );
}
