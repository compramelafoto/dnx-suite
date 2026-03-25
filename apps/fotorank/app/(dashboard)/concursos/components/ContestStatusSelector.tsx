"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDisplayStatus } from "../../../lib/contest-permissions";
import { updateContestStatus } from "../../../actions/contests";

const STATUS_OPTIONS: { value: "DRAFT" | "READY" | "PUBLISHED" | "CLOSED" | "ARCHIVED"; label: string }[] = [
  { value: "DRAFT", label: "Borrador" },
  { value: "READY", label: "Listo para publicar" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
];

interface ContestStatusSelectorProps {
  contestId: string;
  currentDbStatus: string;
}

export function ContestStatusSelector({ contestId, currentDbStatus }: ContestStatusSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const displayStatus = getDisplayStatus(currentDbStatus);

  const handleChange = async (newStatus: "DRAFT" | "READY" | "PUBLISHED" | "CLOSED" | "ARCHIVED") => {
    if (newStatus === displayStatus) {
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(false);
    try {
      const result = await updateContestStatus(contestId, newStatus);
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentLabel = STATUS_OPTIONS.find((o) => o.value === displayStatus)?.label ?? displayStatus;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="fr-btn fr-btn-secondary inline-flex items-center gap-2"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>Estado: {currentLabel}</span>
        <svg
          className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-lg border border-[#262626] bg-[#141414] py-1 shadow-xl"
          >
            {STATUS_OPTIONS.map((opt) => (
              <li key={opt.value} role="option">
                <button
                  type="button"
                  onClick={() => handleChange(opt.value)}
                  className={"block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#1a1a1a] " + (opt.value === displayStatus ? "bg-gold/10 text-gold font-medium" : "text-fr-primary")}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
