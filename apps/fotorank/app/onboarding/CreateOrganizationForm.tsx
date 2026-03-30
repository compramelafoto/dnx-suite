"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "../actions/organizations";
import {
  FormActions,
  FormField,
  FormSection,
  inputBase,
  textareaBase,
} from "../components/ui/form";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createOrganization(formData);
    setLoading(false);
    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    const slugInput = document.getElementById("slug") as HTMLInputElement | null;
    if (slugInput && !slugInput.dataset.manual) {
      slugInput.value = slugFromName(name);
    }
  }

  function handleSlugFocus() {
    const slugInput = document.getElementById("slug") as HTMLInputElement | null;
    if (slugInput) slugInput.dataset.manual = "true";
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-0">
      <FormSection
        title="Información de la organización"
        description="Creá tu primera organización para comenzar a organizar concursos. Los datos se pueden editar después en configuración."
      >
        <FormField id="name" label="Nombre de la organización" required>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ej: Asociación de Fotógrafos de Buenos Aires"
            onChange={handleNameChange}
            className={inputBase}
          />
        </FormField>

        <FormField
          id="slug"
          label="Slug (identificador único)"
          required
          hint="Solo letras minúsculas, números y guiones. Se genera automáticamente desde el nombre."
        >
          <input
            id="slug"
            name="slug"
            type="text"
            required
            placeholder="asociacion-fotografos-buenos-aires"
            onFocus={handleSlugFocus}
            className={inputBase}
          />
        </FormField>

        <FormField
          id="description"
          label="Descripción (opcional)"
          hint="Opcional. Aparece en contextos públicos o internos según la función que habilites más adelante."
        >
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Ej.: Comunidad de fotógrafos de la región..."
            className={textareaBase}
          />
        </FormField>

        <FormField id="website" label="Sitio web (opcional)">
          <input
            id="website"
            name="website"
            type="url"
            placeholder="https://..."
            className={inputBase}
          />
        </FormField>
      </FormSection>

      {error ? (
        <div
          className="fr-form-error-text mb-8 rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <FormActions>
        <button
          type="submit"
          disabled={loading}
          className="fr-btn fr-btn-primary w-full min-h-[3.25rem] sm:w-auto sm:min-w-[12rem]"
        >
          {loading ? "Creando..." : "Crear organización"}
        </button>
      </FormActions>
    </form>
  );
}
