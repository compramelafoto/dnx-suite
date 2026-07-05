"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import SchoolOrganizerHeader from "@/components/school-organizer/SchoolOrganizerHeader";
import { RosterImportChatGptTipPanel } from "@/components/roster/RosterImportChatGptTipPanel";
import { ensureSchoolOrganizerSession } from "@/lib/school-organizer-session-client";

type SchoolDetailResponse = {
  school: {
    id: number;
    name: string;
    city: string | null;
    province: string | null;
    logoUrl: string | null;
    owner: { id: number; name: string | null; email: string };
  };
  summary: {
    albumsCount: number;
    studentsCount: number;
    ordersCount: number;
  };
};

type SchoolAlbum = {
  id: number;
  title: string;
  description: string | null;
  publicSlug: string | null;
  eventDate: string | null;
  isTest: boolean;
  status: "ACTIVO" | "OCULTO" | "TEST";
  owner: {
    id: number;
    name: string | null;
    email: string;
  };
  studentsCount: number;
  photosCount: number;
  ordersCount: number;
  commissionConfig: {
    enabled: boolean;
    percentage: number | null;
    appliesTo: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
    disclaimer: string;
  };
  links: {
    album: string | null;
    preventa: string | null;
    precompra: string | null;
  };
};

type SchoolOrganizerCommission = {
  id: number;
  amount: number;
  percentage: number;
  baseAmount: number;
  status: "PENDING" | "REQUESTED" | "PAID" | "REJECTED" | "CANCELLED";
  createdAt: string;
  requestedAt: string | null;
  paidAt: string | null;
  album: { id: number; title: string };
  order: { id: number };
};

type SchoolStudentRow = {
  id: number;
  firstName: string;
  lastName: string;
  level: string | null;
  shift: string | null;
  course: string | null;
  division: string | null;
  rosterEntryId: number | null;
  albumId: number | null;
  hasSensitiveRelations: boolean;
  sensitiveRelationsSummary: {
    preCompraOrdersCount: number;
    rosterPreCompraOrdersCount: number;
  };
};

type SchoolStudentImportSummary = {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  rowErrors: Array<{
    rowNumber: number;
    message: string;
    rawLine: string;
  }>;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatCommissionAppliesTo(value: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">): string {
  if (!value.length) return "No configurado";
  return value
    .map((item) =>
      item === "PREVENTA" ? "Preventa" : item === "POST_EVENT" ? "Post evento" : "Extras"
    )
    .join(" · ");
}

export default function EscuelaDetailPage() {
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId;

  const [session, setSession] = useState<{
    userId: number;
    name?: string | null;
    email?: string | null;
  } | null>(null);
  const [detail, setDetail] = useState<SchoolDetailResponse | null>(null);
  const [albums, setAlbums] = useState<SchoolAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<SchoolOrganizerCommission[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<{
    acumulado: number;
    pendiente: number;
    solicitado: number;
    pagado: number;
  }>({ acumulado: 0, pendiente: 0, solicitado: 0, pagado: 0 });
  const [requestPayoutLoading, setRequestPayoutLoading] = useState(false);
  const [students, setStudents] = useState<SchoolStudentRow[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilterCourse, setStudentFilterCourse] = useState("");
  const [studentFilterDivision, setStudentFilterDivision] = useState("");
  const [studentFilterShift, setStudentFilterShift] = useState("");
  const [studentFilterOptions, setStudentFilterOptions] = useState<{
    courses: string[];
    divisions: string[];
    shifts: string[];
  }>({
    courses: [],
    divisions: [],
    shifts: [],
  });
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [studentSaveLoading, setStudentSaveLoading] = useState(false);
  const [studentDeleteLoadingId, setStudentDeleteLoadingId] = useState<number | null>(null);
  const [studentResetLoading, setStudentResetLoading] = useState(false);
  const [showImportStudents, setShowImportStudents] = useState(false);
  const [studentImportText, setStudentImportText] = useState("");
  const [studentImportAlbumId, setStudentImportAlbumId] = useState("");
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportSummary, setStudentImportSummary] = useState<SchoolStudentImportSummary | null>(
    null
  );
  const [studentActionMessage, setStudentActionMessage] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<{
    firstName: string;
    lastName: string;
    course: string;
    division: string;
    shift: string;
    level: string;
    albumId: string;
    rosterEntryId: string;
  }>({
    firstName: "",
    lastName: "",
    course: "",
    division: "",
    shift: "",
    level: "",
    albumId: "",
    rosterEntryId: "",
  });

  useEffect(() => {
    let active = true;
    async function init() {
      const s = await ensureSchoolOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      if (!schoolId) return;
      try {
        const [detailRes, albumsRes, commissionsRes] = await Promise.all([
          fetch(`/api/school-organizer/schools/${schoolId}`, { credentials: "include" }),
          fetch(`/api/school-organizer/schools/${schoolId}/albums`, { credentials: "include" }),
          fetch(`/api/school-organizer/schools/${schoolId}/commissions`, {
            credentials: "include",
          }),
        ]);
        const detailData = await detailRes.json().catch(() => ({}));
        const albumsData = await albumsRes.json().catch(() => ({}));
        const commissionsData = await commissionsRes.json().catch(() => ({}));
        if (!detailRes.ok) {
          throw new Error(detailData?.error || "No se pudo cargar la escuela");
        }
        if (!albumsRes.ok) {
          throw new Error(albumsData?.error || "No se pudieron cargar los álbumes");
        }
        if (!commissionsRes.ok) {
          throw new Error(commissionsData?.error || "No se pudieron cargar las comisiones");
        }
        setDetail(detailData as SchoolDetailResponse);
        setAlbums(Array.isArray(albumsData) ? (albumsData as SchoolAlbum[]) : []);
        setCommissions(
          Array.isArray(commissionsData?.commissions)
            ? (commissionsData.commissions as SchoolOrganizerCommission[])
            : []
        );
        setCommissionSummary(
          commissionsData?.summary ?? {
            acumulado: 0,
            pendiente: 0,
            solicitado: 0,
            pagado: 0,
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la escuela");
      } finally {
        setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [router, schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const params = new URLSearchParams();
        const q = studentSearch.trim();
        if (q) params.set("q", q);
        if (studentFilterCourse) params.set("course", studentFilterCourse);
        if (studentFilterDivision) params.set("division", studentFilterDivision);
        if (studentFilterShift) params.set("shift", studentFilterShift);
        params.set("pageSize", "500");
        const url = `/api/school-organizer/schools/${schoolId}/students?${params.toString()}`;
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar los alumnos");
        }
        setStudents(Array.isArray(data?.students) ? (data.students as SchoolStudentRow[]) : []);
        setStudentsTotal(typeof data?.total === "number" ? data.total : 0);
        setStudentFilterOptions({
          courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
          divisions: Array.isArray(data?.filters?.divisions) ? data.filters.divisions : [],
          shifts: Array.isArray(data?.filters?.shifts) ? data.filters.shifts : [],
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStudents([]);
        setStudentsTotal(0);
        setStudentsError(err instanceof Error ? err.message : "No se pudieron cargar los alumnos");
      } finally {
        setStudentsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [schoolId, studentFilterCourse, studentFilterDivision, studentFilterShift, studentSearch]);

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const albumsWithAbsoluteLinks = useMemo(
    () =>
      albums.map((album) => ({
        ...album,
        publicAlbumUrl: album.links.album ? `${origin}${album.links.album}` : null,
      })),
    [albums, origin]
  );

  const albumsWithShareData = useMemo(
    () =>
      albumsWithAbsoluteLinks.map((album) => {
        const referredUrl = album.publicAlbumUrl
          ? `${album.publicAlbumUrl}${album.publicAlbumUrl.includes("?") ? "&" : "?"}ref=school_${detail?.school.id ?? schoolId}`
          : null;
        const commissionText =
          album.commissionConfig.enabled && album.commissionConfig.percentage != null
            ? `\n\nLa escuela recibe una comisión del ${album.commissionConfig.percentage}% sobre las ventas generadas desde este enlace, calculada sobre el valor del servicio sin incluir el costo de plataforma.`
            : "";
        const whatsappMessage = referredUrl
          ? `Hola familias 👋 Ya está disponible el álbum de fotos de ${detail?.school.name || "la escuela"} / ${album.title}. Pueden ingresar desde este link: ${referredUrl}. Las compras realizadas desde este enlace ayudan a la escuela, ya que generan una comisión acordada con el fotógrafo.${commissionText}`
          : null;
        return {
          ...album,
          referredUrl,
          whatsappMessage,
        };
      }),
    [albumsWithAbsoluteLinks, detail?.school.name, detail?.school.id, schoolId]
  );

  async function copyText(text: string | null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copiá este enlace:", text);
    }
  }

  async function handleRequestPayout() {
    if (!schoolId) return;
    setRequestPayoutLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/school-organizer/schools/${schoolId}/commissions/request-payout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo solicitar cobro");
      }
      const refresh = await fetch(`/api/school-organizer/schools/${schoolId}/commissions`, {
        credentials: "include",
      });
      const refreshData = await refresh.json().catch(() => ({}));
      if (refresh.ok) {
        setCommissions(
          Array.isArray(refreshData?.commissions)
            ? (refreshData.commissions as SchoolOrganizerCommission[])
            : []
        );
        setCommissionSummary(
          refreshData?.summary ?? {
            acumulado: 0,
            pendiente: 0,
            solicitado: 0,
            pagado: 0,
          }
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar cobro");
    } finally {
      setRequestPayoutLoading(false);
    }
  }

  function openCreateStudentForm() {
    setEditingStudentId(null);
    setStudentActionMessage(null);
    setStudentForm({
      firstName: "",
      lastName: "",
      course: "",
      division: "",
      shift: "",
      level: "",
      albumId: albums.length === 1 ? String(albums[0].id) : "",
      rosterEntryId: "",
    });
    setIsCreatingStudent(true);
  }

  function openEditStudentForm(student: SchoolStudentRow) {
    setIsCreatingStudent(false);
    setEditingStudentId(student.id);
    setStudentActionMessage(null);
    setStudentForm({
      firstName: student.firstName,
      lastName: student.lastName,
      course: student.course || "",
      division: student.division || "",
      shift: student.shift || "",
      level: student.level || "",
      albumId: student.albumId != null ? String(student.albumId) : "",
      rosterEntryId: student.rosterEntryId != null ? String(student.rosterEntryId) : "",
    });
  }

  function closeStudentForm() {
    setIsCreatingStudent(false);
    setEditingStudentId(null);
  }

  async function reloadStudents() {
    if (!schoolId) return;
    const params = new URLSearchParams();
    const q = studentSearch.trim();
    if (q) params.set("q", q);
    if (studentFilterCourse) params.set("course", studentFilterCourse);
    if (studentFilterDivision) params.set("division", studentFilterDivision);
    if (studentFilterShift) params.set("shift", studentFilterShift);
    params.set("pageSize", "500");
    const url = `/api/school-organizer/schools/${schoolId}/students?${params.toString()}`;
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "No se pudieron cargar los alumnos");
    }
    setStudents(Array.isArray(data?.students) ? (data.students as SchoolStudentRow[]) : []);
    setStudentsTotal(typeof data?.total === "number" ? data.total : 0);
    setStudentFilterOptions({
      courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
      divisions: Array.isArray(data?.filters?.divisions) ? data.filters.divisions : [],
      shifts: Array.isArray(data?.filters?.shifts) ? data.filters.shifts : [],
    });
  }

  async function handleSaveStudent() {
    if (!schoolId) return;
    if (editingStudentId == null && albums.length === 0) {
      setStudentActionMessage("Primero debe existir un álbum escolar para asociar alumnos.");
      return;
    }
    if (editingStudentId == null && !studentForm.albumId.trim()) {
      setStudentActionMessage("Seleccioná un álbum asociado para crear el alumno.");
      return;
    }
    setStudentSaveLoading(true);
    setStudentActionMessage(null);
    try {
      const payload = {
        firstName: studentForm.firstName.trim(),
        lastName: studentForm.lastName.trim(),
        course: studentForm.course.trim(),
        division: studentForm.division.trim(),
        shift: studentForm.shift.trim(),
        level: studentForm.level.trim(),
        albumId: studentForm.albumId.trim() ? Number(studentForm.albumId.trim()) : null,
        rosterEntryId: studentForm.rosterEntryId.trim()
          ? Number(studentForm.rosterEntryId.trim())
          : null,
      };
      const url = editingStudentId
        ? `/api/school-organizer/schools/${schoolId}/students/${editingStudentId}`
        : `/api/school-organizer/schools/${schoolId}/students`;
      const method = editingStudentId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el alumno");
      }
      await reloadStudents();
      closeStudentForm();
      setStudentActionMessage(editingStudentId ? "Alumno actualizado." : "Alumno creado.");
    } catch (err) {
      setStudentActionMessage(err instanceof Error ? err.message : "No se pudo guardar el alumno");
    } finally {
      setStudentSaveLoading(false);
    }
  }

  async function handleDeleteStudent(student: SchoolStudentRow) {
    if (!schoolId) return;
    if (student.hasSensitiveRelations) {
      setStudentActionMessage("Este alumno tiene compras asociadas y no puede eliminarse.");
      return;
    }
    const confirmed = window.confirm("¿Querés eliminar este alumno?");
    if (!confirmed) return;
    setStudentDeleteLoadingId(student.id);
    setStudentActionMessage(null);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}/students/${student.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo eliminar el alumno");
      }
      await reloadStudents();
      setStudentActionMessage("Alumno eliminado.");
    } catch (err) {
      setStudentActionMessage(err instanceof Error ? err.message : "No se pudo eliminar el alumno");
    } finally {
      setStudentDeleteLoadingId(null);
    }
  }

  async function handleResetStudents() {
    if (!schoolId) return;
    const confirmed = window.confirm(
      "Se eliminarán solo alumnos sin compras asociadas. ¿Querés continuar?"
    );
    if (!confirmed) return;
    setStudentResetLoading(true);
    setStudentActionMessage(null);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}/students/reset`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reiniciar el listado de alumnos");
      }
      await reloadStudents();
      setStudentActionMessage(
        `Reinicio aplicado. Eliminados: ${data?.affected?.removedStudents ?? 0}. Conservados con compras: ${data?.affected?.keptStudentsWithOrders ?? 0}.`
      );
    } catch (err) {
      setStudentActionMessage(
        err instanceof Error ? err.message : "No se pudo reiniciar el listado de alumnos"
      );
    } finally {
      setStudentResetLoading(false);
    }
  }

  async function handleImportStudents() {
    if (!schoolId) return;
    if (!studentImportText.trim()) {
      setStudentActionMessage("Pegá contenido CSV antes de importar.");
      return;
    }
    if (albums.length === 0) {
      setStudentActionMessage("Primero debe existir un álbum escolar para asociar alumnos.");
      return;
    }
    if (!studentImportAlbumId.trim()) {
      setStudentActionMessage("Seleccioná un álbum asociado para la importación.");
      return;
    }

    setStudentImportLoading(true);
    setStudentActionMessage(null);
    setStudentImportSummary(null);
    try {
      const res = await fetch(`/api/school-organizer/schools/${schoolId}/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csv: studentImportText,
          albumId: Number(studentImportAlbumId),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<SchoolStudentImportSummary> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron importar los alumnos");
      }
      const summary: SchoolStudentImportSummary = {
        totalRows: typeof data.totalRows === "number" ? data.totalRows : 0,
        createdCount: typeof data.createdCount === "number" ? data.createdCount : 0,
        updatedCount: typeof data.updatedCount === "number" ? data.updatedCount : 0,
        skippedCount: typeof data.skippedCount === "number" ? data.skippedCount : 0,
        errorCount: typeof data.errorCount === "number" ? data.errorCount : 0,
        rowErrors: Array.isArray(data.rowErrors) ? data.rowErrors : [],
      };
      await reloadStudents();
      setStudentImportSummary(summary);
      setStudentActionMessage(
        `Importación finalizada. Filas: ${summary.totalRows}. Creados: ${summary.createdCount}. Actualizados: ${summary.updatedCount}. Omitidos: ${summary.skippedCount}. Con error: ${summary.errorCount}.`
      );
    } catch (err) {
      setStudentActionMessage(
        err instanceof Error ? err.message : "No se pudieron importar los alumnos"
      );
    } finally {
      setStudentImportLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SchoolOrganizerHeader organizer={session} />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/escuela" className="text-sm text-[#c27b3d] hover:underline">
            ← Volver a mis escuelas
          </Link>
        </div>

        {error ? (
          <Card className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        ) : null}

        {loading || !detail ? (
          <Card className="p-6">
            <p className="text-sm text-gray-600">Cargando escuela...</p>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start gap-4">
                {detail.school.logoUrl ? (
                  <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detail.school.logoUrl} alt="" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-100" />
                )}
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">{detail.school.name}</h1>
                  <p className="text-sm text-gray-600">
                    {[detail.school.city, detail.school.province].filter(Boolean).join(", ") || "Sin localidad"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <p>
                  <span className="text-gray-500">Álbumes:</span> {detail.summary.albumsCount}
                </p>
                <p>
                  <span className="text-gray-500">Alumnos:</span> {detail.summary.studentsCount}
                </p>
                <p>
                  <span className="text-gray-500">Preventas/Pedidos:</span> {detail.summary.ordersCount}
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="font-semibold text-gray-900">Fotógrafo responsable</h2>
              <p className="mt-2 text-sm text-gray-700">
                {detail.school.owner.name || "Sin nombre"} ({detail.school.owner.email})
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">Ventas generadas por la escuela</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRequestPayout()}
                  disabled={requestPayoutLoading}
                >
                  {requestPayoutLoading ? "Solicitando..." : "Solicitar cobro"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                La comisión se calcula sobre el precio del servicio sin incluir el costo de la
                plataforma. La plataforma no realiza el pago. Es responsabilidad del fotógrafo.
              </p>
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                La comisión configurada para administradores de escuela es un acuerdo directo entre
                el fotógrafo y la institución educativa.
                <br />
                ComprameLaFoto no interviene en la definición, gestión ni pago de dicha comisión, y
                no asume ninguna responsabilidad sobre los acuerdos comerciales establecidos entre
                las partes.
                <br />
                El pago de las comisiones es responsabilidad exclusiva del fotógrafo.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                <p>
                  <span className="text-gray-500">Acumulado:</span> $
                  {commissionSummary.acumulado.toLocaleString("es-AR")}
                </p>
                <p>
                  <span className="text-gray-500">Pendiente:</span> $
                  {commissionSummary.pendiente.toLocaleString("es-AR")}
                </p>
                <p>
                  <span className="text-gray-500">Solicitado:</span> $
                  {commissionSummary.solicitado.toLocaleString("es-AR")}
                </p>
                <p>
                  <span className="text-gray-500">Pagado:</span> $
                  {commissionSummary.pagado.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Fecha
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Álbum
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Pedido
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Neto venta
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Monto
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Solicitada
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Pagada
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-3 text-gray-600">
                          Todavía no hay comisiones para esta escuela.
                        </td>
                      </tr>
                    ) : (
                      commissions.map((commission) => (
                        <tr key={commission.id}>
                          <td className="px-3 py-3">{formatDate(commission.createdAt)}</td>
                          <td className="px-3 py-3">{commission.album.title}</td>
                          <td className="px-3 py-3">#{commission.order.id}</td>
                          <td className="px-3 py-3">
                            ${commission.baseAmount.toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-3">
                            ${commission.amount.toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-3">{commission.status}</td>
                          <td className="px-3 py-3">{formatDate(commission.requestedAt)}</td>
                          <td className="px-3 py-3">{formatDate(commission.paidAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold text-gray-900">Álbumes asociados</h2>
              {albumsWithAbsoluteLinks.length === 0 ? (
                <p className="text-sm text-gray-600">Esta escuela todavía no tiene álbumes asociados.</p>
              ) : (
                <div className="space-y-3">
                  {albumsWithShareData.map((album) => (
                    <div key={album.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{album.title}</p>
                          <p className="text-xs text-gray-600">
                            Fecha: {formatDate(album.eventDate)} · Estado: {album.status}
                          </p>
                          <p className="text-xs text-gray-600">
                            Fotógrafo responsable: {album.owner.name || album.owner.email}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Descripción: {album.description || "Sin descripción"}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Comisión:{" "}
                            {album.commissionConfig.enabled && album.commissionConfig.percentage != null
                              ? `${album.commissionConfig.percentage}% · ${formatCommissionAppliesTo(
                                  album.commissionConfig.appliesTo
                                )}`
                              : "No activa"}
                          </p>
                          <p className="text-xs text-gray-500">{album.commissionConfig.disclaimer}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyText(album.referredUrl)}
                            disabled={!album.publicAlbumUrl}
                          >
                            Copiar link referido
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyText(album.whatsappMessage)}
                            disabled={!album.whatsappMessage}
                          >
                            Copiar mensaje WhatsApp
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3">
                        <p>Alumnos: {album.studentsCount}</p>
                        <p>Fotos: {album.photosCount}</p>
                        <p>Preventas/Pedidos: {album.ordersCount}</p>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        <p>Link público: {album.publicAlbumUrl || "—"}</p>
                        <p>Link referido escuela: {album.referredUrl || "—"}</p>
                        <p className="mt-1 font-medium text-gray-700">Compartir álbum</p>
                        <p className="mt-1 text-gray-500">QR próximamente</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">Alumnos</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={openCreateStudentForm}>
                    Agregar alumno
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setShowImportStudents((prev) => {
                        const next = !prev;
                        if (next) {
                          setStudentImportSummary(null);
                          setStudentActionMessage(null);
                          if (albums.length === 1) {
                            setStudentImportAlbumId(String(albums[0].id));
                          }
                        }
                        return next;
                      })
                    }
                  >
                    Importar alumnos
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleResetStudents()}
                    disabled={studentResetLoading}
                  >
                    {studentResetLoading ? "Reiniciando..." : "Reiniciar listado de alumnos"}
                  </Button>
                </div>
              </div>

              {(isCreatingStudent || editingStudentId != null) && (
                <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-800">
                    {editingStudentId != null ? "Editar alumno" : "Agregar alumno"}
                  </p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      placeholder="Nombre"
                      value={studentForm.firstName}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Apellido"
                      value={studentForm.lastName}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Curso"
                      value={studentForm.course}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, course: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="División"
                      value={studentForm.division}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, division: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Turno"
                      value={studentForm.shift}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, shift: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Nivel"
                      value={studentForm.level}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, level: event.target.value }))
                      }
                    />
                  </div>
                  {!editingStudentId && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">Álbum asociado</p>
                      {albums.length === 0 ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Primero debe existir un álbum escolar para asociar alumnos.
                        </p>
                      ) : (
                        <select
                          className="w-full rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                          value={studentForm.albumId}
                          onChange={(event) =>
                            setStudentForm((prev) => ({ ...prev, albumId: event.target.value }))
                          }
                        >
                          <option value="">Seleccionar álbum</option>
                          {albums.map((album) => (
                            <option key={album.id} value={String(album.id)}>
                              {album.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={closeStudentForm}>
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleSaveStudent()}
                      disabled={
                        studentSaveLoading ||
                        !studentForm.firstName.trim() ||
                        !studentForm.lastName.trim() ||
                        !studentForm.course.trim() ||
                        !studentForm.division.trim() ||
                        !studentForm.shift.trim() ||
                        !studentForm.level.trim() ||
                        (editingStudentId == null &&
                          (albums.length === 0 || !studentForm.albumId.trim()))
                      }
                    >
                      {studentSaveLoading ? "Guardando..." : "Guardar alumno"}
                    </Button>
                  </div>
                </div>
              )}

              {showImportStudents && (
                <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-800">Importar alumnos (CSV pegado)</p>
                  <p className="text-xs text-gray-600">
                    Formato por línea: nombre,apellido,curso,división,turno,nivel (opcional: albumId
                    en 7ma columna)
                  </p>
                  <RosterImportChatGptTipPanel className="border-violet-200/80 bg-violet-50/40" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Álbum asociado</p>
                    {albums.length === 0 ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Primero debe existir un álbum escolar para asociar alumnos.
                      </p>
                    ) : (
                      <select
                        className="w-full rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                        value={studentImportAlbumId}
                        onChange={(event) => setStudentImportAlbumId(event.target.value)}
                      >
                        <option value="">Seleccionar álbum</option>
                        {albums.map((album) => (
                          <option key={album.id} value={String(album.id)}>
                            {album.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Textarea
                    className="min-h-32 text-sm"
                    placeholder="Juan,Pérez,5to,A,Mañana,Primaria"
                    value={studentImportText}
                    onChange={(event) => setStudentImportText(event.target.value)}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowImportStudents(false);
                        setStudentImportText("");
                        setStudentImportAlbumId("");
                        setStudentImportSummary(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleImportStudents()}
                      disabled={
                        studentImportLoading ||
                        !studentImportText.trim() ||
                        albums.length === 0 ||
                        !studentImportAlbumId.trim()
                      }
                    >
                      {studentImportLoading ? "Importando..." : "Importar"}
                    </Button>
                  </div>
                  {studentImportSummary ? (
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                      <p>
                        Resumen: filas {studentImportSummary.totalRows} · creados{" "}
                        {studentImportSummary.createdCount} · actualizados{" "}
                        {studentImportSummary.updatedCount} · omitidos{" "}
                        {studentImportSummary.skippedCount} · errores{" "}
                        {studentImportSummary.errorCount}
                      </p>
                      {studentImportSummary.rowErrors.length > 0 ? (
                        <div className="space-y-1">
                          {studentImportSummary.rowErrors.map((rowError, index) => (
                            <p key={`${rowError.rowNumber}-${index}`} className="text-xs text-red-700">
                              Fila {rowError.rowNumber}: {rowError.message}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input
                  placeholder="Buscar por nombre o apellido"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                />
                <select
                  className="rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                  value={studentFilterCourse}
                  onChange={(event) => setStudentFilterCourse(event.target.value)}
                >
                  <option value="">Todos los cursos</option>
                  {studentFilterOptions.courses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                  value={studentFilterDivision}
                  onChange={(event) => setStudentFilterDivision(event.target.value)}
                >
                  <option value="">Todas las divisiones</option>
                  {studentFilterOptions.divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-[#111827]/10 bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                  value={studentFilterShift}
                  onChange={(event) => setStudentFilterShift(event.target.value)}
                >
                  <option value="">Todos los turnos</option>
                  {studentFilterOptions.shifts.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mb-3 text-xs text-gray-600">Total alumnos: {studentsTotal}</p>
              {studentsError ? <p className="mb-3 text-sm text-red-700">{studentsError}</p> : null}
              {studentActionMessage ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {studentActionMessage}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Alumno
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Curso
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        División
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Turno
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Nivel
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-3 text-gray-600">
                          Cargando alumnos...
                        </td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-3 text-gray-600">
                          No encontramos alumnos con esos filtros.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id}>
                          <td className="px-3 py-3">
                            {student.lastName}, {student.firstName}
                          </td>
                          <td className="px-3 py-3">{student.course || "—"}</td>
                          <td className="px-3 py-3">{student.division || "—"}</td>
                          <td className="px-3 py-3">{student.shift || "—"}</td>
                          <td className="px-3 py-3">{student.level || "—"}</td>
                          <td className="px-3 py-3">
                            {student.hasSensitiveRelations
                              ? "Con compras asociadas"
                              : "Sin compras asociadas"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEditStudentForm(student)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void handleDeleteStudent(student)}
                                disabled={
                                  student.hasSensitiveRelations ||
                                  studentDeleteLoadingId === student.id
                                }
                              >
                                {studentDeleteLoadingId === student.id
                                  ? "Eliminando..."
                                  : "Eliminar"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
