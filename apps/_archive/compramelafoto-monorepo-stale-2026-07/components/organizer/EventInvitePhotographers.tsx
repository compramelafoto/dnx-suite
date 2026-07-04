"use client";

import { useState, useEffect, useCallback } from "react";
import Input from "@/components/ui/Input";

export type PhotographerOption = {
  id: number;
  name?: string;
  email: string;
  companyName?: string;
  companyOwner?: string;
  phone?: string;
  city?: string;
};

type Props = {
  value: PhotographerOption[];
  onChange: (list: PhotographerOption[]) => void;
  disabled?: boolean;
};

export default function EventInvitePhotographers({ value, onChange, disabled }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PhotographerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const searchPhotographers = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/organizer/photographers/search?q=${encodeURIComponent(q)}&limit=15`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.photographers)) {
        const idsInList = new Set(value.map((p) => p.id));
        setResults(
          data.photographers.filter((p: PhotographerOption) => !idsInList.has(p.id))
        );
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchPhotographers(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search, searchPhotographers]);

  const add = (p: PhotographerOption) => {
    if (value.some((x) => x.id === p.id)) return;
    onChange([...value, p]);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const remove = (id: number) => {
    onChange(value.filter((p) => p.id !== id));
  };

  const displayLabel = (p: PhotographerOption) => {
    const parts = [
      p.name || p.companyName || p.companyOwner,
      p.companyName && p.companyName !== p.name ? p.companyName : null,
      p.phone || p.email,
    ].filter(Boolean);
    return parts.join(" · ") || p.email;
  };

  return (
    <div className="space-y-2 w-full min-w-0">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Buscar fotógrafos por nombre, empresa, teléfono o email
      </label>
      <div className="relative min-w-0">
        <Input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ej: Juan, Estudio X, 11 1234..."
          disabled={disabled}
          className="w-full max-w-full box-border"
        />
        {open && (search.length >= 2 || results.length > 0) && (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
              {searching ? (
                <div className="p-3 text-sm text-gray-500">Buscando...</div>
              ) : results.length === 0 && search.length >= 2 ? (
                <div className="p-3 text-sm text-gray-500">
                  No se encontraron fotógrafos. Probá con otro término.
                </div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => add(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm"
                  >
                    <span className="font-medium text-gray-900">
                      {p.name || p.companyName || p.email}
                    </span>
                    {(p.companyName || p.phone) && (
                      <span className="text-gray-500 ml-2">
                        {[p.companyName, p.phone].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {value.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-48 overflow-auto">
          {value.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded bg-white border border-gray-100"
            >
              <span className="truncate min-w-0">{displayLabel(p)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="flex-shrink-0 text-red-600 hover:text-red-700 text-xs"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">
        Solo estos fotógrafos podrán ver e inscribirse al evento privado.
      </p>
    </div>
  );
}
