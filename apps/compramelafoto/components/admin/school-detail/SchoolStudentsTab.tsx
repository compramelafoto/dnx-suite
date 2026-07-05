"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import type { DetailResponse, StudentFormState, StudentImportSummary, StudentRow } from "@/components/admin/school-detail/types";
import {
  ROSTER_CSV_EXAMPLE_ROW,
  ROSTER_CSV_HEADER_LINE,
} from "@/components/admin/school-detail/types";
import { formatSensitiveRelationsTooltip } from "@/lib/admin/school-detail-diagnostics";
import { RosterImportChatGptTipPanel } from "@/components/roster/RosterImportChatGptTipPanel";

const selectClass =
  "w-full min-h-[42px] rounded-xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]";

export type SchoolStudentsTabProps = {
  detail: DetailResponse;
  importAlbumId: string;
  setImportAlbumId: (v: string) => void;
  importFile: File | null;
  setImportFile: (v: File | null) => void;
  importCsvText: string;
  setImportCsvText: (v: string) => void;
  importLoading: boolean;
  importError: string | null;
  importSummary: StudentImportSummary | null;
  setImportSummary: Dispatch<SetStateAction<StudentImportSummary | null>>;
  handleImportStudents: () => void | Promise<void>;
  studentSearch: string;
  setStudentSearch: (v: string) => void;
  studentFilterCourse: string;
  setStudentFilterCourse: (v: string) => void;
  studentFilterDivision: string;
  setStudentFilterDivision: (v: string) => void;
  studentFilterShift: string;
  setStudentFilterShift: (v: string) => void;
  studentsFiltered: StudentRow[];
  studentPage: number;
  setStudentPage: Dispatch<SetStateAction<number>>;
  studentPageSize: number;
  albumTitleById: Map<number, string>;
  studentFormMode: "create" | "edit" | null;
  studentForm: StudentFormState | null;
  setStudentForm: Dispatch<SetStateAction<StudentFormState | null>>;
  studentSaveError: string | null;
  studentSaveLoading: boolean;
  editingStudentHasSensitiveRelations: boolean;
  startCreateStudent: () => void;
  cancelStudentForm: () => void;
  handleSaveStudent: () => void | Promise<void>;
  startEditStudent: (row: StudentRow) => void;
  handleDeleteStudent: (row: StudentRow) => void | Promise<void>;
  deletingStudentId: number | null;
};

function downloadCsvTemplate() {
  const body = `${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}\n`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-alumnos-escuela.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SchoolStudentsTab(p: SchoolStudentsTabProps) {
  const [importDragActive, setImportDragActive] = useState(false);

  const filterOptions = useMemo(() => {
    const courses = new Set<string>();
    const divisions = new Set<string>();
    const shifts = new Set<string>();
    for (const s of p.detail.students) {
      if (s.course.trim()) courses.add(s.course.trim());
      if (s.division.trim()) divisions.add(s.division.trim());
      if (s.shift.trim()) shifts.add(s.shift.trim());
    }
    return {
      courses: [...courses].sort((a, b) => a.localeCompare(b, "es")),
      divisions: [...divisions].sort((a, b) => a.localeCompare(b, "es")),
      shifts: [...shifts].sort((a, b) => a.localeCompare(b, "es")),
    };
  }, [p.detail.students]);

  const importPreviewLines = useMemo(() => {
    const t = p.importCsvText.trim();
    if (!t) return 0;
    const lines = t.split(/\r?\n/).filter((line) => line.trim() !== "");
    return Math.max(0, lines.length - (lines[0]?.includes("level") ? 1 : 0));
  }, [p.importCsvText]);

  const totalPages = Math.max(1, Math.ceil(p.studentsFiltered.length / p.studentPageSize));
  const pageIdx = Math.min(p.studentPage, totalPages);
  const pageSlice = useMemo(() => {
    const start = (pageIdx - 1) * p.studentPageSize;
    return p.studentsFiltered.slice(start, start + p.studentPageSize);
  }, [p.studentsFiltered, pageIdx, p.studentPageSize]);

  const exportStudentsCsv = useCallback(() => {
    const header = ["firstName", "lastName", "level", "course", "division", "shift", "albumId", "albumTitle"];
    const lines = p.studentsFiltered.map((s) =>
      [
        s.firstName,
        s.lastName,
        s.level,
        s.course,
        s.division,
        s.shift,
        s.albumId,
        (p.albumTitleById.get(s.albumId) || "").replace(/"/g, '""'),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumnos-escuela-${p.detail.school.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [p.albumTitleById, p.detail.school.id, p.studentsFiltered]);

  const onDropFile = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImportDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      p.setImportFile(f);
      p.setImportCsvText("");
    },
    [p]
  );

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden rounded-2xl border border-[#c27b3d]/25 bg-gradient-to-br from-[#fdf8f3] to-white p-0 shadow-sm">
        <div className="border-b border-[#e8dcc8] px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Importar alumnos masivamente</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4b5563]">
                Podés importar alumnos usando Excel (.xlsx), CSV o pegando texto con el mismo formato de columnas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
                <FileSpreadsheet className="mr-2 inline h-4 w-4" aria-hidden />
                Plantilla CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  p.setImportFile(null);
                  p.setImportCsvText("");
                  p.setImportSummary(null);
                }}
              >
                Limpiar importación
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
          <RosterImportChatGptTipPanel />
          {p.detail.albums.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Primero necesitás asociar un álbum escolar para poder importar alumnos.
            </p>
          ) : (
            <>
              <label className="block max-w-xl space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Álbum destino
                </span>
                <select
                  className={selectClass}
                  value={p.importAlbumId}
                  onChange={(e) => p.setImportAlbumId(e.target.value)}
                >
                  {p.detail.albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                    </option>
                  ))}
                </select>
              </label>

              <div
                role="presentation"
                onDragEnter={(e) => {
                  e.preventDefault();
                  setImportDragActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setImportDragActive(false)}
                onDrop={onDropFile}
                className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  importDragActive ? "border-[#c27b3d] bg-[#fdf8f3]" : "border-[#e5e7eb] bg-[#fafafa]"
                }`}
              >
                <UploadCloud className="mx-auto h-10 w-10 text-[#c27b3d]" aria-hidden />
                <p className="mt-3 text-sm font-medium text-[#111827]">Arrastrá un archivo .xlsx o .csv</p>
                <p className="mt-1 text-xs text-[#6b7280]">También podés usar el selector de archivo</p>
                <input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="mt-4 block w-full max-w-md mx-auto text-sm text-[#374151] file:mr-3 file:rounded-xl file:border-0 file:bg-[#c27b3d] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white"
                  onChange={(e) => {
                    p.setImportFile(e.target.files?.[0] || null);
                    if (e.target.files?.[0]) p.setImportCsvText("");
                  }}
                />
                {p.importFile ? (
                  <p className="mt-3 text-xs font-medium text-[#374151]">Archivo: {p.importFile.name}</p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Pegar texto CSV (opcional)
                </label>
                <Textarea
                  value={p.importCsvText}
                  onChange={(e) => {
                    p.setImportCsvText(e.target.value);
                    if (e.target.value.trim()) p.setImportFile(null);
                  }}
                  placeholder={`Ejemplo:\n${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}`}
                  rows={6}
                  className="mt-2 font-mono text-sm"
                />
                <p className="mt-2 text-xs text-[#6b7280]">
                  Filas de datos detectadas (sin encabezado):{" "}
                  <strong className="text-[#111827]">{importPreviewLines}</strong>
                </p>
              </div>

              <Card className="rounded-xl border border-[#f3f4f6] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Formato esperado</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#111827]/5 px-3 py-2 text-xs leading-relaxed text-[#374151]">
                  {`${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}`}
                </pre>
              </Card>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="primary"
                  disabled={p.importLoading || !p.importAlbumId || (!p.importFile && !p.importCsvText.trim())}
                  onClick={() => void p.handleImportStudents()}
                  className="min-h-[44px] px-6"
                >
                  {p.importLoading ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                      Procesando…
                    </>
                  ) : (
                    "Procesar importación"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {p.importError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{p.importError}</p>
      ) : null}

      {p.importSummary ? (
        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-emerald-950">Resultado de importación</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Total filas" value={String(p.importSummary.totalRows)} />
            <Metric label="Creados" value={String(p.importSummary.createdCount)} />
            <Metric label="Actualizados" value={String(p.importSummary.updatedCount)} />
            <Metric label="Omitidos" value={String(p.importSummary.skippedCount)} />
            <Metric label="Errores" value={String(p.importSummary.errorCount)} highlight />
          </div>
          {p.importSummary.rowErrors.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Errores por fila</p>
              <ul className="mt-2 max-h-52 space-y-1 overflow-auto rounded-xl border border-red-100 bg-white p-3 text-sm text-red-800">
                {p.importSummary.rowErrors.map((rowError, index) => (
                  <li key={`${rowError.rowNumber}-${index}`}>
                    Fila {rowError.rowNumber}: {rowError.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ebe8e4] bg-white px-4 py-4 sm:px-6">
        <h3 className="text-base font-semibold text-[#111827]">Acciones rápidas</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportStudentsCsv} disabled={p.studentsFiltered.length === 0}>
            <Download className="mr-2 inline h-4 w-4" aria-hidden />
            Exportar alumnos filtrados
          </Button>
          <Button type="button" variant="primary" onClick={p.startCreateStudent}>
            Agregar alumno manualmente
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Buscar</label>
            <Input
              className="mt-1.5 min-h-[42px]"
              placeholder="Nombre, nivel, curso…"
              value={p.studentSearch}
              onChange={(e) => p.setStudentSearch(e.target.value)}
            />
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:max-w-3xl">
            <FilterSelect label="Curso" value={p.studentFilterCourse} options={filterOptions.courses} onChange={p.setStudentFilterCourse} />
            <FilterSelect
              label="División"
              value={p.studentFilterDivision}
              options={filterOptions.divisions}
              onChange={p.setStudentFilterDivision}
            />
            <FilterSelect label="Turno" value={p.studentFilterShift} options={filterOptions.shifts} onChange={p.setStudentFilterShift} />
          </div>
        </div>
      </Card>

      {p.studentSaveError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{p.studentSaveError}</p>
      ) : null}

      {p.studentFormMode && p.studentForm ? (
        <Card className="rounded-2xl border border-[#c27b3d]/25 bg-[#fdfbf8] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#111827]">
            {p.studentFormMode === "create" ? "Nuevo alumno" : "Editar alumno"}
          </h3>
          {p.studentFormMode === "edit" && p.editingStudentHasSensitiveRelations ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Este alumno tiene preventas/pedidos. Editá sólo datos necesarios para no romper la trazabilidad.
            </p>
          ) : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre *">
              <Input
                value={p.studentForm.firstName}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, firstName: e.target.value } : prev))}
              />
            </Field>
            <Field label="Apellido *">
              <Input
                value={p.studentForm.lastName}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, lastName: e.target.value } : prev))}
              />
            </Field>
            <Field label="Nivel *">
              <Input
                value={p.studentForm.level}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, level: e.target.value } : prev))}
              />
            </Field>
            <Field label="Curso *">
              <Input
                value={p.studentForm.course}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, course: e.target.value } : prev))}
              />
            </Field>
            <Field label="División *">
              <Input
                value={p.studentForm.division}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, division: e.target.value } : prev))}
              />
            </Field>
            <Field label="Turno *">
              <Input
                value={p.studentForm.shift}
                className="min-h-[42px]"
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, shift: e.target.value } : prev))}
              />
            </Field>
            <Field label="Álbum asociado" className="md:col-span-2">
              <select
                value={p.studentForm.albumId}
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, albumId: e.target.value } : prev))}
                className={selectClass}
              >
                <option value="">Sin álbum</option>
                {p.detail.albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notas" className="md:col-span-2">
              <Textarea
                value={p.studentForm.notes}
                rows={3}
                onChange={(e) => p.setStudentForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                className="text-sm"
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={p.cancelStudentForm}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void p.handleSaveStudent()} disabled={p.studentSaveLoading}>
              {p.studentSaveLoading ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#6b7280]">
          Mostrando <strong className="text-[#111827]">{pageSlice.length}</strong> de{" "}
          <strong className="text-[#111827]">{p.studentsFiltered.length}</strong> alumnos (límite back-end:{" "}
          {p.detail.limits.students}).
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pageIdx <= 1} onClick={() => p.setStudentPage((x) => Math.max(1, x - 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="text-sm tabular-nums text-[#374151]">
            {pageIdx} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIdx >= totalPages}
            onClick={() => p.setStudentPage((x) => Math.min(totalPages, x + 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-[#fafafa]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                <th className="border-b border-[#f3f4f6] px-4 py-4">Nombre</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">Apellido</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">Curso</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">División</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">Turno</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">Álbum</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4">Estado</th>
                <th className="border-b border-[#f3f4f6] px-4 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((student) => (
                <tr key={student.id} className="align-middle">
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 font-medium text-[#111827]">{student.firstName}</td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 font-medium text-[#111827]">{student.lastName}</td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 text-[#374151]">{student.course}</td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 text-[#374151]">{student.division}</td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 text-[#374151]">{student.shift}</td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 text-[#374151]">
                    {p.albumTitleById.get(student.albumId) || `Álbum #${student.albumId}`}
                  </td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5">
                    {student.hasSensitiveRelations ? (
                      <span
                        className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200"
                        title={formatSensitiveRelationsTooltip(student)}
                      >
                        Con pedidos
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                        Libre
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[#f9fafb] px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => p.startEditStudent(student)}>
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={p.deletingStudentId === student.studentId || student.hasSensitiveRelations}
                        title={
                          student.hasSensitiveRelations
                            ? `${formatSensitiveRelationsTooltip(student)} Podés editar pero no eliminar.`
                            : undefined
                        }
                        onClick={() => void p.handleDeleteStudent(student)}
                      >
                        {student.hasSensitiveRelations ? "No eliminable" : p.deletingStudentId === student.studentId ? "…" : "Eliminar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? "border-red-100 bg-red-50/50" : "border-[#f3f4f6] bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-[#6b7280]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-[140px]">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{label}</span>
      <select className={`${selectClass} mt-1.5`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
