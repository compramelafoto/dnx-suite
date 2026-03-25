"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "../actions/organizations";
import { FormField, FormSection, inputBase } from "../components/ui/form";

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
    <form onSubmit={handleSubmit} className="space-y-12">
      <FormSection
        title="Información de la organización"
        description="Creá tu primera organización para comenzar a organizar concursos."
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

        <FormField id="description" label="Descripción (opcional)">
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Breve descripción de la organización..."
            className={`${inputBase} min-h-[5rem] resize-y`}
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

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="fr-btn fr-btn-primary w-full">
        {loading ? "Creando..." : "Crear organización"}
      </button>
    </form>
  );
}
