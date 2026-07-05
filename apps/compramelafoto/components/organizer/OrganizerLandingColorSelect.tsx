"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  findColorLabel,
  normalizeOrganizerHexColor,
  type OrganizerLandingColorOption,
} from "@/lib/organizer-landing-colors";

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  options: OrganizerLandingColorOption[];
  defaultHex: string;
};

export default function OrganizerLandingColorSelect({
  label,
  value,
  onChange,
  options,
  defaultHex,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const current = normalizeOrganizerHexColor(value) ?? defaultHex;
  const displayLabel = findColorLabel(current, options);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(hex: string) {
    onChange(hex);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span id={`${listId}-label`} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-[#c27b3d]/50 focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/40"
      >
        <span
          className="h-9 w-9 shrink-0 rounded-md border border-black/10 shadow-inner"
          style={{ backgroundColor: current }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900 truncate">{displayLabel}</span>
          <span className="block text-xs text-gray-500 font-mono truncate">{current}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby={`${listId}-label`}
          className="absolute z-30 mt-1 w-full min-w-[min(100%,16rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <p className="text-xs font-medium text-gray-600 m-0 mb-2">Elegí un color</p>
          <ul className="grid grid-cols-4 gap-2 m-0 p-0 list-none">
            {options.map((opt) => {
              const selected = opt.hex.toLowerCase() === current.toLowerCase();
              const isWhite = opt.hex.toLowerCase() === "#ffffff";
              return (
                <li key={opt.hex}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={`${opt.label} (${opt.hex})`}
                    onClick={() => pick(opt.hex)}
                    className={`relative h-10 w-full rounded-md border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/50 ${
                      selected ? "border-[#c27b3d] ring-1 ring-[#c27b3d]/30" : "border-transparent"
                    } ${isWhite ? "shadow-sm ring-1 ring-gray-200" : ""}`}
                    style={{ backgroundColor: opt.hex }}
                  >
                    <span className="sr-only">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 m-0 mb-2">Otro color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={current}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-0.5"
                aria-label={`Selector personalizado para ${label}`}
              />
              <span className="text-xs text-gray-500 font-mono">{current}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
