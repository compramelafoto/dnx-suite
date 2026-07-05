"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Card from "@/components/ui/Card";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import {
  formatStudentIdentificationModeDescription,
  formatStudentIdentificationModeLabel,
  STUDENT_IDENTIFICATION_MODE_VALUES,
  type StudentIdentificationModeValue,
} from "@/lib/school-roster/student-identification-mode-ui";
import { RosterImportChatGptTipPanel } from "@/components/roster/RosterImportChatGptTipPanel";

type RosterStudent = {
  id: number;
  firstName: string;
  lastName: string;
  externalStudentId: string | null;
  dni: string | null;
};

type RosterEnrollment = {
  id: number;
  level: string;
  shift: string;
  courseName: string;
  division: string;
} | null;

type RosterEntryOrderCount = {
  preCompraOrders: number;
};

export type AlbumStudentRosterEntry = {
  id: number;
  createdAt?: string;
  level: string;
  shift: string;
  courseName: string;
  division: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  sourceType: string;
  isManual: boolean;
  isActive: boolean;
  enrollmentId?: number | null;
  lastEnrollmentSyncAt?: string | null;
  syncSourceEnrollmentId?: number | null;
  isOutdatedFromEnrollment?: boolean;
  hasLocalOverrides?: boolean;
  institutionalStaleReason?: string | null;
  student: RosterStudent;
  enrollment: RosterEnrollment;
  _count?: RosterEntryOrderCount;
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function sourceLabel(sourceType: string, isManual: boolean): string {
  const m: Record<string, string> = {
    IMPORT: "Importación CSV",
    MANUAL_PHOTOGRAPHER: "Manual (fotógrafo)",
    MANUAL_ORGANIZER: "Organizador",
    MANUAL_PARENT_FALLBACK: "Carga familia (preventa)",
    SYNC_FROM_PREVIOUS_YEAR: "Año anterior",
    SCHOOL_ENROLLMENT_SYNC: "Matrícula institucional",
  };
  const base = m[sourceType] ?? sourceType;
  return isManual ? `${base} · manual` : base;
}

type InstitutionalSyncPreviewPayload = {
  counts: {
    sincronizados: number;
    pendienteActualizacion: number;
    nuevos: number;
    desactualizados: number;
    protegidosPedidos: number;
    protegidosManual: number;
    protegidosOverride: number;
    consideradosInstitucionales: number;
  };
  rows: Array<
    | {
        kind: "new_enrollment";
        enrollmentId: number;
        studentId: number;
        displayName: string;
        institutionalSlotLabel: string;
        status: string;
        recommendedAction: string;
        badges: string[];
      }
    | {
        kind: "roster_row";
        rosterEntryId: number;
        studentId: number;
        displayName: string;
        institutionalSlotLabel?: string | null;
        rosterSlotLabel?: string | null;
        status: string;
        recommendedAction: string;
        badges: string[];
        staleReason?: string | null;
      }
  >;
};

function BadgePills({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {badges.map((b) => (
        <span
          key={b}
          className="inline-flex items-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2 py-0.5 text-[11px] font-semibold text-[#4b5563]"
        >
          {b}
        </span>
      ))}
    </span>
  );
}

function deriveRowBadgesFromEntry(entry: AlbumStudentRosterEntry): string[] {
  const out: string[] = [];
  if (entry.isManual) out.push("manual");
  if (entry.hasLocalOverrides) out.push("override local");
  const ord = entry._count?.preCompraOrders ?? 0;
  if (ord > 0) out.push("protegido");
  const institutionalHint =
    entry.sourceType === "SCHOOL_ENROLLMENT_SYNC" ||
    entry.enrollmentId != null ||
    entry.syncSourceEnrollmentId != null;
  if (entry.isOutdatedFromEnrollment) {
    out.push("desactualizado");
  } else if (!(entry.hasLocalOverrides ?? false) && !entry.isManual && ord === 0 && institutionalHint) {
    out.push("sincronizado");
  }
  return [...new Set(out)].filter(Boolean);
}

function formatPreviewStatusSpanish(status: string): string {
  const map: Record<string, string> = {
    sincronizado: "Sincronizado",
    pendiente_actualizacion: "Pendiente de actualización",
    desactualizado_removido: "Fuera del curso vinculado",
    desactualizado_curso: "Curso institucional distinto",
    protegido_pedidos: "Protegido (preventa)",
    protegido_manual: "Protegido (manual)",
    protegido_override: "Protegido (override)",
    nuevo: "Nuevo en institución",
  };
  return map[status] ?? status;
}

const MODE_OPTIONS: { value: StudentIdentificationModeValue; label: string }[] = [
  { value: null, label: "Predeterminado (sin definir)" },
  ...STUDENT_IDENTIFICATION_MODE_VALUES.map((mode) => ({
    value: mode,
    label: formatStudentIdentificationModeLabel(mode),
  })),
];

const ROSTER_IMPORT_SECTION_ID = "escuela-roster-import-csv";

/** Columnas esperadas en la primera fila del CSV (mismo orden que el import en servidor). */
const ROSTER_CSV_COLUMNS = [
  "level",
  "shift",
  "courseName",
  "division",
  "firstName",
  "lastName",
  "externalStudentId",
  "dni",
] as const;

const ROSTER_CSV_HEADER_LINE = ROSTER_CSV_COLUMNS.join(",");

/** Fila de ejemplo (opcional en plantilla); los dos últimos campos pueden ir vacíos. */
const ROSTER_CSV_EXAMPLE_ROW = "Primaria,Mañana,3ro,A,Juan,Pérez,,";

function downloadRosterCsvTemplate() {
  if (typeof window === "undefined") return;
  const content = `\uFEFF${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}\n`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-importacion-alumnos.csv";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type AlbumStudentRosterSectionProps = {
  albumId: number;
  schoolId: number | null | undefined;
  /** Nombre del evento / álbum (cabecera) */
  eventTitle?: string;
  eventLocation?: string | null;
  /** Álbum en modo prueba (no visible como producción para clientes) */
  isTestMode?: boolean;
  studentIdentificationMode: StudentIdentificationModeValue;
  allowManualStudentFallback: boolean;
  onAlbumConfigSaved?: (patch: {
    studentIdentificationMode: string | null;
    allowManualStudentFallback: boolean;
  }) => void;
};

function scrollToRosterImport() {
  if (typeof document === "undefined") return;
  document.getElementById(ROSTER_IMPORT_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function AlbumStudentRosterSection({
  albumId,
  schoolId,
  eventTitle,
  eventLocation,
  isTestMode,
  studentIdentificationMode,
  allowManualStudentFallback,
  onAlbumConfigSaved,
}: AlbumStudentRosterSectionProps) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);

  const [entries, setEntries] = useState<AlbumStudentRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [identMode, setIdentMode] = useState<StudentIdentificationModeValue>(studentIdentificationMode);
  const [allowFallback, setAllowFallback] = useState(allowManualStudentFallback);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [csvText, setCsvText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importAcademicYearId, setImportAcademicYearId] = useState("");
  const [rosterInstitutional, setRosterInstitutional] = useState<{
    academicYears: Array<{ id: number; label: string; isCurrent: boolean }>;
    currentMarkedYear: { id: number; label: string; isCurrent: boolean } | null;
  } | null>(null);
  const [institutionSync, setInstitutionSync] = useState<{
    academicYearId: number | null;
    academicYear: { id: number; label: string; isCurrent: boolean } | null;
    selectedCourseKeys: string[];
    rosterStudentsInSyncedCourses: number;
  } | null>(null);
  const [institutionSyncRunning, setInstitutionSyncRunning] = useState(false);
  const [institutionSyncBanner, setInstitutionSyncBanner] = useState<string | null>(null);
  const [institutionalPreview, setInstitutionalPreview] = useState<InstitutionalSyncPreviewPayload | null>(
    null
  );
  const [institutionalPreviewLoading, setInstitutionalPreviewLoading] = useState(false);
  const [showSyncDiffModal, setShowSyncDiffModal] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    matched: number;
    skipped: number;
    errors: number;
    enrollmentsCreated?: number;
    enrollmentsReused?: number;
    rosterLinksCreated?: number;
    rosterLinksExisting?: number;
    rosterLinksUpdated?: number;
    duplicateDniWarnings?: number;
    rosterSkippedDueToOrders?: number;
    rosterSkippedManual?: number;
    rosterSkippedLocalOverrides?: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    firstName: "",
    lastName: "",
    level: "",
    shift: "",
    courseName: "",
    division: "",
    externalStudentId: "",
    dni: "",
  });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualOk, setManualOk] = useState<string | null>(null);

  useEffect(() => {
    setIdentMode(studentIdentificationMode);
  }, [studentIdentificationMode]);

  useEffect(() => {
    setAllowFallback(allowManualStudentFallback);
  }, [allowManualStudentFallback]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    return sp.toString();
  }, [debouncedQ]);

  const loadRoster = useCallback(async () => {
    if (!schoolId) return;
    setRosterLoading(true);
    setRosterError(null);
    try {
      const url = `/api/dashboard/albums/${albumId}/student-roster${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar la lista");
      }
      const list = Array.isArray(data.entries) ? data.entries : [];
      setEntries(list as AlbumStudentRosterEntry[]);
      const inst = data.schoolRosterInstitutional as
        | {
            academicYears?: Array<{ id: number; label: string; isCurrent: boolean }>;
            currentMarkedYear?: { id: number; label: string; isCurrent: boolean } | null;
          }
        | undefined;
      if (inst && Array.isArray(inst.academicYears)) {
        setRosterInstitutional({
          academicYears: inst.academicYears,
          currentMarkedYear: inst.currentMarkedYear ?? null,
        });
      } else {
        setRosterInstitutional(null);
      }
      const rawAlbum = data.album as Record<string, unknown> | undefined;
      if (rawAlbum && typeof rawAlbum === "object") {
        const ay = rawAlbum.academicYear as { id: number; label: string; isCurrent: boolean } | null | undefined;
        const keys = rawAlbum.selectedCourseKeys;
        setInstitutionSync({
          academicYearId:
            typeof rawAlbum.academicYearId === "number" && Number.isFinite(rawAlbum.academicYearId)
              ? rawAlbum.academicYearId
              : null,
          academicYear: ay && typeof ay.id === "number" ? ay : null,
          selectedCourseKeys: Array.isArray(keys) ? keys.filter((x): x is string => typeof x === "string") : [],
          rosterStudentsInSyncedCourses: Number(rawAlbum.rosterStudentsInSyncedCourses) || 0,
        });
      } else {
        setInstitutionSync(null);
      }
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Error al cargar");
      setEntries([]);
    } finally {
      setRosterLoading(false);
    }
  }, [albumId, schoolId, queryString]);

  const loadInstitutionalPreview = useCallback(async () => {
    setInstitutionalPreviewLoading(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/school-roster/sync-preview`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.available === false || data?.preview == null) {
        setInstitutionalPreview(null);
        return;
      }
      setInstitutionalPreview(data.preview as InstitutionalSyncPreviewPayload);
    } catch {
      setInstitutionalPreview(null);
    } finally {
      setInstitutionalPreviewLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    if (!schoolId || !institutionSync?.academicYearId || institutionSync.selectedCourseKeys.length === 0) {
      setInstitutionalPreview(null);
      return;
    }
    void loadInstitutionalPreview();
  }, [schoolId, institutionSync?.academicYearId, institutionSync?.selectedCourseKeys.length, loadInstitutionalPreview]);

  useEffect(() => {
    if (!schoolId) return;
    loadRoster();
  }, [schoolId, loadRoster]);

  async function saveAlbumConfig() {
    setConfigSaving(true);
    setConfigError(null);
    setConfigMessage(null);
    try {
      const body: Record<string, unknown> = {
        allowManualStudentFallback: allowFallback,
      };
      if (identMode === null) {
        body.studentIdentificationMode = null;
      } else {
        body.studentIdentificationMode = identMode;
      }
      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      }
      setConfigMessage("Cambios guardados.");
      onAlbumConfigSaved?.({
        studentIdentificationMode: data.studentIdentificationMode ?? null,
        allowManualStudentFallback: Boolean(data.allowManualStudentFallback),
      });
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setConfigSaving(false);
    }
  }

  async function resyncRosterFromInstitutional() {
    setInstitutionSyncRunning(true);
    setRosterError(null);
    setInstitutionSyncBanner(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/school-roster/sync-from-enrollments`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo sincronizar");
      }
      const s = data.summary as {
        rosterCreated?: number;
        rosterUpdated?: number;
        blockedOrders?: number;
        blockedManual?: number;
        blockedLocalOverrides?: number;
        markedRemoved?: number;
        markedCourseDrift?: number;
      } | undefined;
      const msgParts: string[] = [];
      if (s?.rosterCreated) msgParts.push(`${s.rosterCreated} altas`);
      if (s?.rosterUpdated) msgParts.push(`${s.rosterUpdated} actualizaciones de snapshot`);
      if (s?.markedRemoved) msgParts.push(`${s.markedRemoved} marcados como fuera de selección institucional`);
      if (s?.markedCourseDrift) msgParts.push(`${s.markedCourseDrift} con advertencia de cambio de curso`);
      const blocked =
        (s?.blockedOrders ?? 0) + (s?.blockedManual ?? 0) + (s?.blockedLocalOverrides ?? 0);
      if (blocked > 0) msgParts.push(`${blocked} omitidos por protección (preventa/manual/override)`);
      setInstitutionSyncBanner(
        msgParts.length > 0
          ? `Sincronización: ${msgParts.join(" · ")}.`
          : "Sincronización ejecutada sin cambios efectivos pendientes para las filas consideradas."
      );
      await loadRoster();
      await loadInstitutionalPreview();
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      setInstitutionSyncRunning(false);
    }
  }

  async function runImport() {
    setImportLoading(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const ayRaw = importAcademicYearId.trim();
      const ayParsed = ayRaw === "" ? NaN : parseInt(ayRaw, 10);
      const ay =
        ayRaw !== "" && Number.isInteger(ayParsed) && ayParsed > 0 ? ayParsed : undefined;
      const res = await fetch(`/api/dashboard/albums/${albumId}/student-roster/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvText,
          ...(ay != null ? { academicYearId: ay } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Error en la importación");
      }
      setImportSummary({
        total: Number(data.total) || 0,
        created: Number(data.created) || 0,
        matched: Number(data.matched) || 0,
        skipped: Number(data.skipped) || 0,
        errors: Number(data.errors) || 0,
        enrollmentsCreated: Number(data.enrollmentsCreated) || 0,
        enrollmentsReused: Number(data.enrollmentsReused) || 0,
        rosterLinksCreated: Number(data.rosterLinksCreated) || 0,
        rosterLinksExisting: Number(data.rosterLinksExisting) || 0,
        rosterLinksUpdated: Number(data.rosterLinksUpdated) || 0,
        duplicateDniWarnings: Number(data.duplicateDniWarnings) || 0,
        rosterSkippedDueToOrders: Number(data.rosterSkippedDueToOrders) || 0,
        rosterSkippedManual: Number(data.rosterSkippedManual) || 0,
        rosterSkippedLocalOverrides: Number(data.rosterSkippedLocalOverrides) || 0,
      });
      await loadRoster();
      void loadInstitutionalPreview();
    } finally {
      setImportLoading(false);
    }
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    setManualLoading(true);
    setManualError(null);
    setManualOk(null);
    try {
      const body = {
        firstName: manual.firstName.trim(),
        lastName: manual.lastName.trim(),
        level: manual.level.trim(),
        shift: manual.shift.trim(),
        courseName: manual.courseName.trim(),
        division: manual.division.trim(),
        externalStudentId: manual.externalStudentId.trim() || undefined,
        dni: manual.dni.trim() || undefined,
      };
      const res = await fetch(`/api/dashboard/albums/${albumId}/student-roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo dar de alta");
      }
      setManualOk("Listo: el alumno quedó en la lista de este álbum.");
      setManual({
        firstName: "",
        lastName: "",
        level: "",
        shift: "",
        courseName: "",
        division: "",
        externalStudentId: "",
        dni: "",
      });
      setShowManual(false);
      await loadRoster();
      void loadInstitutionalPreview();
    } finally {
      setManualLoading(false);
    }
  }

  if (!schoolId) {
    return null;
  }

  const inputLgClass = "w-full min-h-11 text-[15px]";

  return (
    <div className="w-full max-w-full min-w-[min(100%,20rem)] sm:max-w-6xl mx-auto ds-stack-section gap-10">
      <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-6 sm:!p-8 border border-sky-200/80 bg-sky-50/70">
        <div className="ds-stack-section w-full min-w-[min(100%,20rem)] gap-3">
          <p className="ds-readable-text ds-readable-text--fluid text-sm font-semibold text-sky-950 m-0">
            Este álbum usa el padrón institucional de la escuela.
          </p>
          {rosterInstitutional?.currentMarkedYear ? (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-sky-900 m-0">
              <span className="font-semibold text-sky-950">Padrón escolar:</span>{" "}
              {rosterInstitutional.currentMarkedYear.label}
            </p>
          ) : rosterInstitutional && rosterInstitutional.academicYears.length === 0 ? (
            <div
              role="note"
              className="w-full min-w-[min(100%,20rem)] rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950 m-0">
                No hay año lectivo configurado para esta escuela todavía. Podés importar igual, pero recomendamos definir
                el año lectivo para alinear las inscripciones y reducir duplicados.
              </p>
            </div>
          ) : rosterInstitutional &&
            rosterInstitutional.academicYears.length > 0 &&
            !rosterInstitutional.currentMarkedYear ? (
            <div
              role="note"
              className="w-full min-w-[min(100%,20rem)] rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950 m-0">
                No hay año lectivo actual configurado para esta escuela. Podés importar igual, pero recomendamos marcar
                el ciclo lectivo actual para evitar duplicados.
              </p>
            </div>
          ) : null}
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-sky-900/95 m-0">
            Los alumnos cargados aquí también pertenecen a la escuela. Por compatibilidad con preventa y pedidos, el
            padrón operativo sigue asociado al álbum.
          </p>
        </div>
      </Card>

      {institutionSync &&
        institutionSync.academicYearId != null &&
        institutionSync.selectedCourseKeys.length > 0 && (
          <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-6 sm:!p-8 border border-emerald-200/80 bg-emerald-50/50 space-y-6">
            <div className="w-full min-w-[min(100%,20rem)] space-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-emerald-950">Cursos sincronizados</h3>
              <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-emerald-950/90 m-0">
                Año lectivo y cursos institucionales que actúan como ventana sobre el padrón. La sincronización suma altas,
                corrige snapshots seguros y marca advertencias; no borra historial ni pis filas protegidas por preventa ni
                manuales.
              </p>
            </div>
            <ul className="ds-readable-text ds-readable-text--fluid text-sm text-emerald-950 space-y-1.5 list-disc list-inside m-0 pl-0">
              <li>
                <span className="font-semibold">Año lectivo:</span>{" "}
                {institutionSync.academicYear?.label ?? `ID ${institutionSync.academicYearId}`}
                {institutionSync.academicYear?.isCurrent ? (
                  <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                    Actual
                  </span>
                ) : null}
              </li>
              <li>
                <span className="font-semibold">Cursos / divisiones vinculados:</span>{" "}
                {institutionSync.selectedCourseKeys.length}
              </li>
              <li>
                <span className="font-semibold">Filas activas que coinciden con ese curso:</span>{" "}
                {institutionSync.rosterStudentsInSyncedCourses}
              </li>
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className="w-full sm:w-auto min-h-11 text-[15px]"
                disabled={institutionSyncRunning}
                onClick={() => void resyncRosterFromInstitutional()}
              >
                {institutionSyncRunning ? "Sincronizando…" : "Sincronizar ahora"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto min-h-11 text-[15px]"
                disabled={institutionalPreviewLoading}
                onClick={() => setShowSyncDiffModal(true)}
              >
                {institutionalPreviewLoading ? "Cargando diferencias…" : "Ver diferencias"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto min-h-11 text-[15px]"
                disabled={institutionalPreviewLoading}
                onClick={() => void loadInstitutionalPreview()}
              >
                Actualizar vista previa
              </Button>
            </div>

            {institutionSyncBanner ? (
              <p className="ds-readable-text ds-readable-text--fluid rounded-xl border border-emerald-300/70 bg-emerald-100/50 px-4 py-3 text-sm text-emerald-950 leading-relaxed m-0">
                {institutionSyncBanner}
              </p>
            ) : null}

            <div className="w-full min-w-[min(100%,20rem)] border-t border-emerald-200/90 pt-5 space-y-4">
              <div className="w-full min-w-[min(100%,20rem)]">
                <h4 className="text-base font-bold text-emerald-950">Estado de sincronización institucional</h4>
                <p className="ds-readable-text ds-readable-text--fluid mt-1 text-sm text-emerald-950/85 m-0">
                  Resumen operativo antes de ejecutar cambios — las filas con pedidos preventa siguen intactas incluso tras
                  actualizar institución de origen.
                </p>
              </div>

              {institutionalPreviewLoading && !institutionalPreview ? (
                <p className="ds-readable-text ds-readable-text--fluid text-sm text-emerald-900/70 m-0">
                  Calculando diferencias contra matrícula…
                </p>
              ) : institutionalPreview ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Sincronizados</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">
                        {institutionalPreview.counts.sincronizados}
                      </p>
                      <p className="mt-2 text-[11px] leading-snug text-emerald-950/75">
                        Alineadas con institución dentro de esta selección · considerados institucionalmente:{" "}
                        {institutionalPreview.counts.consideradosInstitucionales}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Nuevos</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">{institutionalPreview.counts.nuevos}</p>
                      <p className="mt-2 text-[11px] leading-snug text-emerald-950/75">
                        Matricula en institución sin fila equivalente en el álbum aún · «Sincronizar ahora» puede darlos de alta.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Desactualizados</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">
                        {institutionalPreview.counts.desactualizados}
                      </p>
                      <p className="mt-2 text-[11px] leading-snug text-emerald-950/75">
                        Fuera del curso vinculado o curso institucional distinto al snapshot conservado · la fila no se borra.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Protegidos por pedidos</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">
                        {institutionalPreview.counts.protegidosPedidos}
                      </p>
                      <p className="mt-2 text-[11px] leading-snug text-emerald-950/75">
                        Con preventa enlazada: no pisado automático. Manual:{" "}
                        {institutionalPreview.counts.protegidosManual} · override local:{" "}
                        {institutionalPreview.counts.protegidosOverride}
                      </p>
                    </div>
                  </div>

                  {(institutionalPreview.counts.protegidosManual > 0 ||
                    institutionalPreview.counts.protegidosOverride > 0 ||
                    institutionalPreview.counts.pendienteActualizacion > 0) && (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-amber-200/70 bg-amber-50/40 px-4 py-2.5 text-xs text-amber-950">
                      {institutionalPreview.counts.pendienteActualizacion > 0 ? (
                        <span>
                          Pendientes para actualización segura:{" "}
                          <strong className="tabular-nums">{institutionalPreview.counts.pendienteActualizacion}</strong>
                        </span>
                      ) : null}
                      {institutionalPreview.counts.protegidosManual > 0 ? (
                        <span>
                          Omitidos como manual institucional:{" "}
                          <strong className="tabular-nums">{institutionalPreview.counts.protegidosManual}</strong>
                        </span>
                      ) : null}
                      {institutionalPreview.counts.protegidosOverride > 0 ? (
                        <span>
                          Omitidos por override local:{" "}
                          <strong className="tabular-nums">{institutionalPreview.counts.protegidosOverride}</strong>
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="ds-table-scroll w-full min-w-[min(100%,20rem)] rounded-xl border border-emerald-200/70 bg-white/80 shadow-inner">
                    <table className="min-w-[720px] w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-emerald-100/70 text-left text-xs text-emerald-900 uppercase tracking-wide">
                          <th className="px-3 py-2.5 font-semibold">Alumno</th>
                          <th className="px-3 py-2.5 font-semibold">Estado</th>
                          <th className="px-3 py-2.5 font-semibold min-w-[14rem]">Acción recomendada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {institutionalPreview.rows.slice(0, 12).map((row, idx) => (
                          <tr key={`pv-${idx}`} className="border-t border-emerald-100">
                            <td className="px-3 py-2.5 whitespace-nowrap text-emerald-950 font-medium">{row.displayName}</td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="space-y-2">
                                <span className="block text-[13px] font-semibold leading-snug text-emerald-900">
                                  {formatPreviewStatusSpanish(row.status)}
                                </span>
                                <BadgePills badges={row.badges} />
                              </div>
                              {row.kind === "new_enrollment" ? (
                                <p className="mt-1 text-[11px] leading-relaxed text-emerald-950/75">
                                  Curso: {row.institutionalSlotLabel}
                                </p>
                              ) : (
                                <div className="mt-1 max-w-xl space-y-0.5 text-[11px] leading-relaxed text-emerald-950/75">
                                  {row.institutionalSlotLabel ? (
                                    <p>Institución: {row.institutionalSlotLabel}</p>
                                  ) : null}
                                  {row.rosterSlotLabel ? <p>Snapshot álbum: {row.rosterSlotLabel}</p> : null}
                                  {row.staleReason ? (
                                    <p className="text-amber-900">Marcador: {row.staleReason}</p>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] leading-snug text-emerald-950/95">
                              {row.recommendedAction}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {institutionalPreview.rows.length > 12 ? (
                      <p className="ds-readable-text ds-readable-text--fluid border-t border-emerald-100 px-4 py-2 text-xs text-emerald-900/75 m-0">
                        Mostramos las primeras 12 filas. Abrí «Ver diferencias» para el listado completo (
                        {institutionalPreview.rows.length} ítems).
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="ds-readable-text ds-readable-text--fluid text-sm text-emerald-900/70 m-0">
                  Todavía no hay vista previa disponible para esta combinación año/cursos — probá refrescar después de cargar la
                  lista.
                </p>
              )}
            </div>
          </Card>
        )}

      {/* A. Cabecera del evento */}
      <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-[min(100%,20rem)] flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Evento</p>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827] leading-tight break-words">
              {eventTitle?.trim() || "Álbum"}
            </h2>
            <p className="text-sm sm:text-[15px] text-[#4b5563]">
              {eventLocation?.trim() ? (
                <span className="inline-flex items-start gap-2">
                  <span className="text-[#9ca3af] shrink-0" aria-hidden>
                    ·
                  </span>
                  <span>{eventLocation.trim()}</span>
                </span>
              ) : (
                <span className="text-[#9ca3af]">Ubicación no indicada</span>
              )}
            </p>
          </div>
          {isTestMode ? (
            <div className="shrink-0">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                Modo prueba
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* B. Lista de alumnos */}
      <section aria-labelledby="roster-list-heading" className="w-full min-w-[min(100%,20rem)] space-y-0">
        <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-8">
          <div className="w-full min-w-[min(100%,20rem)] space-y-2">
            <h3 id="roster-list-heading" className="text-lg sm:text-xl font-bold text-[#111827]">
              Lista de alumnos
            </h3>
            <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
              Buscá en todo el padrón: datos del alumno, curso, notas del padrón y datos de pedidos preventa
              (comprador, mail, teléfono / WhatsApp del pedido), aunque no se vean en la tabla.
            </p>
          </div>

          <div className="w-full min-w-[min(100%,20rem)] space-y-2">
            <label className="flex w-full min-w-[min(100%,20rem)] flex-col gap-2">
              <span className="text-sm font-medium text-[#374151]">Buscar</span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, DNI, curso, mail, teléfono…"
                className={inputLgClass}
                autoComplete="off"
              />
            </label>
            <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#9ca3af] m-0">
              Coincidencias parciales, sin distinguir mayúsculas.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#f3f4f6] pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto justify-center"
              onClick={() => loadRoster()}
              disabled={rosterLoading}
            >
              {rosterLoading ? "Actualizando…" : "Actualizar lista"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto justify-center"
              onClick={scrollToRosterImport}
            >
              Importar CSV
            </Button>
            <Button type="button" className="w-full sm:w-auto justify-center" onClick={() => setShowManual(true)}>
              Agregar alumno
            </Button>
          </div>

          {manualOk && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 m-0">
              {manualOk}
            </p>
          )}

          {rosterError && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 m-0">
              {rosterError}
            </p>
          )}

          {entries.length > 0 && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
              Mostrando <span className="font-semibold text-[#374151]">{entries.length}</span> alumno
              {entries.length === 1 ? "" : "s"}
            </p>
          )}

          <div className="ds-table-scroll w-full min-w-[min(100%,20rem)] rounded-xl border border-[#e5e7eb] bg-white">
            <table className="min-w-[1020px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left text-xs text-[#6b7280] uppercase tracking-wide">
                  <th className="px-4 py-3.5 font-semibold min-w-[12rem]">Apellido y nombre</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[5rem]">Nivel</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[5rem]">Turno</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[6rem]">Curso</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[5rem]">División</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[9rem]">Institucional</th>
                  <th className="px-4 py-3.5 font-semibold min-w-[10rem]">Origen</th>
                  <th className="px-4 py-3.5 font-semibold whitespace-nowrap">Activo</th>
                </tr>
              </thead>
              {entries.length > 0 ? (
              <tbody>
                {entries.map((row) => {
                  const name = `${row.snapshotLastName}, ${row.snapshotFirstName}`;
                  return (
                    <tr key={row.id} className="border-t border-[#e5e7eb]">
                      <td className="px-4 py-3 text-[#1a1a1a] whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3 text-[#374151]">{row.level}</td>
                      <td className="px-4 py-3 text-[#374151]">{row.shift}</td>
                      <td className="px-4 py-3 text-[#374151]">{row.courseName}</td>
                      <td className="px-4 py-3 text-[#374151]">{row.division}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="max-w-[12rem] space-y-1.5">
                          <BadgePills badges={deriveRowBadgesFromEntry(row)} />
                          {row.isOutdatedFromEnrollment && row.institutionalStaleReason?.trim() ? (
                            <p className="text-[10px] font-medium leading-snug text-amber-900">
                              {row.institutionalStaleReason}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#374151] text-xs leading-snug">{sourceLabel(row.sourceType, row.isManual)}</td>
                      <td className="px-4 py-3">{row.isActive ? "Sí" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
              ) : null}
            </table>
            {entries.length === 0 && !rosterLoading ? (
              <div className="ds-catalog-empty-shell w-full border-t border-[#e5e7eb]">
                <div className="ds-empty-state ds-empty-state--tight">
                  <p className="ds-empty-state__title text-base text-[#374151]">No hay alumnos para mostrar</p>
                  <p className="ds-empty-state__body text-[#9ca3af]">
                    Cambiá la búsqueda o los filtros, importá un archivo o agregá un alumno.
                  </p>
                </div>
              </div>
            ) : null}
            {rosterLoading && entries.length === 0 ? (
              <div className="ds-catalog-empty-shell w-full border-t border-[#e5e7eb]">
                <div className="ds-empty-state ds-empty-state--tight">
                  <p className="ds-empty-state__body text-[#6b7280] m-0">Cargando lista…</p>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      {/* D. Importación CSV */}
      <Card id={ROSTER_IMPORT_SECTION_ID} className="scroll-mt-6 w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9">
        <div className="flex w-full min-w-[min(100%,20rem)] flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-[min(100%,20rem)] flex-1 space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Importar o actualizar padrón institucional</h3>
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] leading-relaxed m-0">
                Usá coma como separador. La primera fila debe ser los encabezados; una fila por alumno. Los datos
                alimentan el padrón de la escuela: los alumnos importados podrán utilizarse en cualquier álbum de la
                misma institución. Excel puede guardar en .csv.
              </p>
            </div>
            <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={downloadRosterCsvTemplate}>
              Descargar plantilla CSV
            </Button>
          </div>

          <div className="w-full min-w-[min(100%,20rem)] rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-4 sm:px-5">
            <p className="ds-readable-text ds-readable-text--fluid text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-3 m-0">
              Columnas (orden fijo)
            </p>
            <div className="flex flex-wrap gap-2">
              {ROSTER_CSV_COLUMNS.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-mono text-[#374151] shadow-sm ring-1 ring-[#e5e7eb]"
                >
                  {col}
                </span>
              ))}
            </div>
            <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#9ca3af] mt-3 m-0">
              La plantilla descargable incluye encabezados y una fila de ejemplo; podés borrarla y pegar tus datos.
            </p>
          </div>

          <RosterImportChatGptTipPanel className="w-full min-w-[min(100%,20rem)] border-violet-200/80 bg-violet-50/40" />

          <div className="w-full min-w-[min(100%,20rem)] space-y-2">
            <label className="text-sm font-medium text-[#374151]">Año lectivo (opcional)</label>
            <select
              className="w-full min-w-0 min-h-11 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-[15px]"
              value={importAcademicYearId}
              onChange={(e) => setImportAcademicYearId(e.target.value)}
            >
              <option value="">Usar año lectivo actual de la escuela</option>
              {(rosterInstitutional?.academicYears ?? []).map((y) => (
                <option key={y.id} value={String(y.id)}>
                  {y.label}
                  {y.isCurrent ? " · actual" : ""}
                </option>
              ))}
            </select>
            <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#9ca3af] m-0">
              Vacío = mismo criterio que siempre: el año marcado como actual en la escuela.
            </p>
          </div>

          <div className="w-full min-w-[min(100%,20rem)] space-y-5">
            <label className="flex w-full min-w-[min(100%,20rem)] flex-col gap-2">
              <span className="text-sm font-medium text-[#374151]">Pegar CSV aquí</span>
              <Textarea
                className="min-h-[180px] text-sm font-mono leading-relaxed"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}`}
                spellCheck={false}
              />
            </label>
            <label className="flex w-full min-w-[min(100%,20rem)] flex-col gap-2">
              <span className="text-sm font-medium text-[#374151]">O subir archivo .csv</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full min-w-0 text-sm text-[#374151] file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3f4f6] file:px-4 file:py-2.5 file:text-sm file:font-semibold"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await f.text();
                  setCsvText(text);
                }}
              />
            </label>
          </div>

          {importError && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 m-0">
              {importError}
            </p>
          )}
          {importSummary && (
            <div className="ds-readable-text ds-readable-text--fluid w-full min-w-[min(100%,20rem)] rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm space-y-1.5">
              <p className="font-semibold text-[#111827]">Resultado de la importación</p>
              <ul className="text-[#374151] list-disc list-inside space-y-0.5">
                <li>Filas procesadas: {importSummary.total}</li>
                <li>Alumnos creados: {importSummary.created}</li>
                <li>Alumnos reutilizados: {importSummary.matched}</li>
                <li>Inscripciones creadas: {importSummary.enrollmentsCreated ?? 0}</li>
                <li>Inscripciones reutilizadas: {importSummary.enrollmentsReused ?? 0}</li>
                <li>Vínculos al álbum creados: {importSummary.rosterLinksCreated ?? 0}</li>
                <li>Vínculos existentes (sin cambio / omitidos): {importSummary.rosterLinksExisting ?? 0}</li>
                <li>Vínculos actualizados en álbum: {importSummary.rosterLinksUpdated ?? 0}</li>
                <li>Filas omitidas (resumen): {importSummary.skipped}</li>
                <li>Omitidos por pedidos en álbum: {importSummary.rosterSkippedDueToOrders ?? 0}</li>
                <li>Omitidos (entrada manual): {importSummary.rosterSkippedManual ?? 0}</li>
                <li>Omitidos (override local preservado): {importSummary.rosterSkippedLocalOverrides ?? 0}</li>
                <li>Advertencias DNI ambiguo: {importSummary.duplicateDniWarnings ?? 0}</li>
                <li>Filas con error: {importSummary.errors}</li>
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" disabled={importLoading || !csvText.trim()} onClick={runImport}>
              {importLoading ? "Importando…" : "Importar"}
            </Button>
          </div>
        </div>
      </Card>

      {/* E. Configuración de preventa */}
      <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9">
        <div className="flex w-full min-w-[min(100%,20rem)] flex-col gap-6">
          <div className="w-full min-w-[min(100%,20rem)] space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Configuración de preventa</h3>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] leading-relaxed m-0">
              Cómo elige la familia al alumno en la página pública y si puede cargar datos a mano.
            </p>
          </div>
          <label className="flex w-full min-w-[min(100%,20rem)] flex-col gap-2">
            <span className="text-sm font-medium text-[#374151]">Modo de selección de alumno</span>
            <select
              className="w-full min-w-0 rounded-xl border border-[#e5e7eb] px-4 py-3 text-[15px] bg-white min-h-11"
              value={identMode === null ? "" : identMode}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setIdentMode(null);
                else setIdentMode(v as StudentIdentificationModeValue);
              }}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={String(o.value ?? "default")} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#6b7280] m-0">
              {formatStudentIdentificationModeDescription(identMode)}
            </p>
          </label>
          <label className="flex w-full min-w-[min(100%,20rem)] cursor-pointer items-start gap-3 rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3.5">
            <input
              type="checkbox"
              className="mt-0.5 size-[18px] shrink-0 rounded border-[#d1d5db]"
              checked={allowFallback}
              onChange={(e) => setAllowFallback(e.target.checked)}
            />
            <span className="ds-readable-text ds-readable-text--fluid flex-1 text-left text-sm leading-relaxed text-[#374151]">
              Permitir carga manual si no encuentra al alumno en la lista
            </span>
          </label>
          {configError && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 m-0">
              {configError}
            </p>
          )}
          {configMessage && (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 m-0">
              {configMessage}
            </p>
          )}
          <div className="pt-0.5">
            <Button type="button" variant="secondary" disabled={configSaving} onClick={saveAlbumConfig}>
              {configSaving ? "Guardando…" : "Guardar configuración"}
            </Button>
          </div>
        </div>
      </Card>

      {showSyncDiffModal ? (
        <AppModal
          open={showSyncDiffModal}
          onClose={() => setShowSyncDiffModal(false)}
          size="xl"
          title="Diferencias respecto del padrón institucional"
          titleId="sync-diff-modal-title"
          description="Lista completa proyectada antes de ejecutar cambios."
          panelClassName="overflow-hidden border-[#e5e7eb] shadow-xl"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {!institutionalPreview ? (
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
                No hay datos de vista previa todavía. Probá «Actualizar vista previa».
              </p>
            ) : (
              <>
                <p className="ds-readable-text ds-readable-text--fluid mb-4 text-xs text-[#6b7280] m-0">
                  Ítems: <span className="font-semibold text-[#111827]">{institutionalPreview.rows.length}</span>.
                </p>
                <div className="ds-table-scroll w-full min-w-[min(100%,20rem)] rounded-xl border border-[#e5e7eb] bg-white">
                  <table className="min-w-[720px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#f9fafb] text-left text-xs text-[#6b7280] uppercase tracking-wide">
                        <th className="px-3 py-2.5 font-semibold">Alumno</th>
                        <th className="px-3 py-2.5 font-semibold">Estado</th>
                        <th className="px-3 py-2.5 font-semibold min-w-[16rem]">Acción recomendada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {institutionalPreview.rows.map((row, idx) => (
                        <tr key={`mod-${idx}`} className="border-t border-[#e5e7eb] align-top">
                          <td className="px-3 py-3 whitespace-nowrap text-[#111827]">{row.displayName}</td>
                          <td className="px-3 py-3">
                            <div className="space-y-2">
                              <span className="block text-[13px] font-semibold text-[#374151]">
                                {formatPreviewStatusSpanish(row.status)}
                              </span>
                              <BadgePills badges={row.badges} />
                            </div>
                            {row.kind === "new_enrollment" ? (
                              <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[#6b7280]">
                                Curso: {row.institutionalSlotLabel}
                              </p>
                            ) : (
                              <div className="mt-2 max-w-xl space-y-1 text-[11px] leading-relaxed text-[#6b7280]">
                                {row.institutionalSlotLabel ? <p>Institución: {row.institutionalSlotLabel}</p> : null}
                                {row.rosterSlotLabel ? <p>Snapshot álbum: {row.rosterSlotLabel}</p> : null}
                                {row.staleReason ? (
                                  <p className="text-amber-900">Marcador: {row.staleReason}</p>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[13px] leading-relaxed text-[#374151]">{row.recommendedAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </AppModal>
      ) : null}

      {showManual ? (
        <AppModal
          open={showManual}
          onClose={() => {
            if (manualLoading) return;
            setShowManual(false);
          }}
          size="lg"
          title="Agregar alumno a mano"
          titleId="manual-student-modal-title"
          description="Completá nivel, turno, curso y división como los use el colegio."
          closeOnBackdrop={!manualLoading}
          closeOnEscape={!manualLoading}
          panelClassName="overflow-hidden border-[#e5e7eb] shadow-xl"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8">
            <form onSubmit={submitManual} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">Nombre</span>
                  <Input
                    required
                    value={manual.firstName}
                    onChange={(e) => setManual((m) => ({ ...m, firstName: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">Apellido</span>
                  <Input
                    required
                    value={manual.lastName}
                    onChange={(e) => setManual((m) => ({ ...m, lastName: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">Nivel</span>
                  <Input
                    required
                    value={manual.level}
                    onChange={(e) => setManual((m) => ({ ...m, level: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">Turno</span>
                  <Input
                    required
                    value={manual.shift}
                    onChange={(e) => setManual((m) => ({ ...m, shift: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-[#6b7280]">Curso</span>
                  <Input
                    required
                    value={manual.courseName}
                    onChange={(e) => setManual((m) => ({ ...m, courseName: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-[#6b7280]">División</span>
                  <Input
                    required
                    value={manual.division}
                    onChange={(e) => setManual((m) => ({ ...m, division: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">ID externo (opcional)</span>
                  <Input
                    value={manual.externalStudentId}
                    onChange={(e) => setManual((m) => ({ ...m, externalStudentId: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#6b7280]">DNI (opcional)</span>
                  <Input
                    value={manual.dni}
                    onChange={(e) => setManual((m) => ({ ...m, dni: e.target.value }))}
                    disabled={manualLoading}
                  />
                </label>
              </div>
              {manualError && (
                <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">{manualError}</p>
              )}
              <div className="flex flex-wrap gap-3 justify-end pt-3 border-t border-[#f3f4f6] mt-1">
                <Button type="button" variant="secondary" disabled={manualLoading} onClick={() => setShowManual(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={manualLoading}>
                  {manualLoading ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}
