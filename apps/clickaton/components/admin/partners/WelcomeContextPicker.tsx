"use client";

import { useCallback, useState, useTransition } from "react";
import type { WelcomeAdminScopeKind } from "@repo/partners";
import { searchWelcomeContextAction } from "@/lib/admin/partners/welcome-admin-mutations";
import type { WelcomeContextSearchHit } from "@/lib/admin/partners/welcome-context-search";

export function WelcomeContextPicker({
  scopeKind,
  name = "contextId",
  defaultValue = "",
}: {
  scopeKind: Extract<WelcomeAdminScopeKind, "EDITION" | "CONTEST" | "ALBUM">;
  name?: string;
  defaultValue?: string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WelcomeContextSearchHit[]>([]);
  const [selected, setSelected] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runSearch = useCallback(() => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scopeKind", scopeKind);
      fd.set("query", query);
      const res = await searchWelcomeContextAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Error");
        setHits([]);
        return;
      }
      setError(null);
      setHits(res.hits);
    });
  }, [query, scopeKind]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected} />
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-ck-border bg-ck-surface px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            scopeKind === "EDITION"
              ? "Buscar evento/edición…"
              : scopeKind === "CONTEST"
                ? "Buscar concurso…"
                : "Buscar álbum…"
          }
          aria-label="Buscar entidad contextual"
        />
        <button
          type="button"
          className="rounded-md border border-ck-border px-3 py-2 text-sm"
          onClick={runSearch}
          disabled={pending || query.trim().length < 1}
        >
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {selected ? (
        <p className="text-xs text-ck-text-secondary">
          Seleccionado: <span className="font-mono text-ck-text">{selected}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-200/80">Seleccioná un resultado (ID canónico interno).</p>
      )}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {hits.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-auto rounded-md border border-ck-border p-2 text-sm">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-ck-surface-elevated"
                onClick={() => setSelected(h.id)}
              >
                <span className="font-medium text-ck-text">{h.label}</span>
                <span className="text-xs text-ck-text-secondary">
                  {h.status}
                  {h.slug ? ` · ${h.slug}` : ""}
                  {h.secondary ? ` · ${h.secondary}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
