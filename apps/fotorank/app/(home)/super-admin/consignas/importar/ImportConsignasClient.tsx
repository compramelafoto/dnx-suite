"use client";

import { useState, useTransition } from "react";
import { importConsignasAction, previewImportAction } from "../actions";

export function ImportConsignasClient() {
  const [json, setJson] = useState(
    `[\n  {\n    "title": "Ejemplo",\n    "description": "Descripción de la consigna",\n    "themeSlug": "luz",\n    "difficulty": "MEDIUM",\n    "universal": true,\n    "language": "es",\n    "tags": ["ejemplo"]\n  }\n]`,
  );
  const [preview, setPreview] = useState<{
    count: number;
    titles: string[];
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6" data-testid="import-consignas-client">
      <label className="block space-y-2 text-sm">
        <span className="text-fr-muted">JSON (array de consignas)</span>
        <textarea
          name="json"
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setPreview(null);
            setError(null);
          }}
          rows={16}
          className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5 font-mono text-xs"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="fr-recuadro space-y-3 border border-fr-border bg-fr-card text-sm">
          <p className="font-semibold text-fr-primary">
            Vista previa: {preview.count} consignas como borrador
          </p>
          <ul className="list-disc space-y-1 pl-5 text-fr-muted">
            {preview.titles.map((t) => (
              <li key={t}>{t}</li>
            ))}
            {preview.count > preview.titles.length ? (
              <li>… y {preview.count - preview.titles.length} más</li>
            ) : null}
          </ul>
          {preview.warnings.length > 0 ? (
            <ul className="space-y-1 text-amber-100/90">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          className="fr-btn fr-btn-secondary px-5 py-2.5 text-sm"
          onClick={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("json", json);
              const result = await previewImportAction(fd);
              if (!result.ok) {
                setError(result.error);
                setPreview(null);
                return;
              }
              setError(null);
              setPreview({
                count: result.count,
                titles: result.titles,
                warnings: result.warnings,
              });
            });
          }}
        >
          Vista previa
        </button>

        {preview ? (
          <form action={importConsignasAction}>
            <input type="hidden" name="json" value={json} />
            <button
              type="submit"
              disabled={pending}
              className="fr-btn fr-btn-primary px-5 py-2.5 text-sm"
            >
              Confirmar importación
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
