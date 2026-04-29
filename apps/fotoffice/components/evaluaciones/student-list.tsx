"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MockStudent, StudentProgressStatus } from "./types";

type StudentProgressItem = {
  done: number;
  status: StudentProgressStatus;
  reviewed: boolean;
};

export type StudentQuickFilter = "all" | "pending" | "partial" | "complete" | "reviewed";

type StudentListProps = {
  students: MockStudent[];
  selectedStudentId: string;
  progressByStudent: Record<string, StudentProgressItem>;
  totalCriteria: number;
  searchQuery: string;
  quickFilter: StudentQuickFilter;
  onSearchQueryChange: (value: string) => void;
  onQuickFilterChange: (value: StudentQuickFilter) => void;
  onSelectStudent: (studentId: string) => void;
};

function getStatusPill(status: StudentProgressStatus) {
  if (status === "complete") {
    return {
      label: "Completo",
      className: "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
    };
  }
  if (status === "partial") {
    return {
      label: "Parcial",
      className: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)] border-[var(--fo-warning-border)]",
    };
  }
  return {
    label: "Sin corregir",
    className: "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)] border-[var(--fo-border)]",
  };
}

export function StudentList({
  students,
  selectedStudentId,
  progressByStudent,
  totalCriteria,
  searchQuery,
  quickFilter,
  onSearchQueryChange,
  onQuickFilterChange,
  onSelectStudent,
}: StudentListProps) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const quickFilters = useMemo(
    () =>
      [
        { id: "all", label: "Todos" },
        { id: "pending", label: "Pendientes" },
        { id: "partial", label: "Parciales" },
        { id: "complete", label: "Completos" },
        { id: "reviewed", label: "Revisados" },
      ] as Array<{ id: StudentQuickFilter; label: string }>,
    [],
  );

  useEffect(() => {
    if (!selectedStudentId) return;
    const node = itemRefs.current[selectedStudentId];
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedStudentId, students]);

  return (
    <aside className="fo-card space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Alumnos</p>
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Corrección masiva</h2>
      </div>
      <div className="space-y-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Buscar alumno por nombre"
          className="fo-input min-h-9"
          aria-label="Buscar alumno por nombre"
        />
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onQuickFilterChange(filter.id)}
              className={[
                "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                quickFilter === filter.id
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
                  : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]",
              ].join(" ")}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {students.length === 0 ? (
          <li className="rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-3 py-4 text-center text-sm text-[var(--fo-muted)]">
            No hay alumnos para este filtro.
          </li>
        ) : null}
        {students.map((student) => {
          const selected = student.id === selectedStudentId;
          const progress = progressByStudent[student.id] ?? { done: 0, status: "empty", reviewed: false };
          const statusPill = getStatusPill(progress.status);
          return (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onSelectStudent(student.id)}
                ref={(node) => {
                  itemRefs.current[student.id] = node;
                }}
                className={[
                  "w-full rounded-[var(--fo-radius-sm)] border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)]"
                    : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] hover:bg-[var(--fo-surface-hover)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--fo-text)]">{student.fullName}</p>
                  {progress.reviewed ? (
                    <span className="rounded-full border border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--fo-success)]">
                      Revisado
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--fo-muted)]">
                    {progress.done}/{totalCriteria} criterios
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPill.className}`}>
                    {statusPill.label}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
