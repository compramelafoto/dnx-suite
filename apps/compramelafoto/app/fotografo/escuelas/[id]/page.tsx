"use client";

import {
  type ReactNode,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Tabs from "@/components/ui/Tabs";
import {
  BookMarked,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Images,
  LayoutTemplate,
  PieChart,
  Search,
  Shield,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import AddressGeoSearch from "@/components/school/AddressGeoSearch";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsDashboardInner, DsPageShell, DsTabPanel } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { ROSTER_CSV_EXAMPLE_ROW, ROSTER_CSV_HEADER_LINE } from "@/components/admin/school-detail/types";
import { RosterImportChatGptTipPanel } from "@/components/roster/RosterImportChatGptTipPanel";

type SchoolCourse = {
  id: number;
  name: string;
  division: string | null;
  sortOrder: number | null;
};

type AcademicYearBrief = {
  id: number;
  label: string;
  isCurrent: boolean;
};

type Album = {
  id: number;
  title: string;
  publicSlug: string;
  type: string | null;
  isTest?: boolean;
  preCompraCloseAt: string | null;
  eventDate?: string | null;
  isPublic?: boolean;
  preCompraProducts?: { id: number }[];
  photoCount?: number;
  rosterCourseSlotCount?: number;
};

/** Fila de alumno institucional (listado combinado cargado desde los álbumes de la escuela). */
type SchoolRosterAggregationRow = {
  id: number;
  albumId: number;
  studentId: number;
  level: string;
  shift: string;
  courseName: string;
  division: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  isActive: boolean;
  student: {
    externalStudentId: string | null;
    dni: string | null;
  };
  album: {
    id: number;
    title: string;
    eventDate: string | null;
  };
};

function formatAlbumUsageCount(distinctAlbumCount: number): string {
  if (distinctAlbumCount <= 0) return "—";
  if (distinctAlbumCount === 1) return "1 álbum";
  return `${distinctAlbumCount} álbumes`;
}

type InstitutionBadgeTone = "active" | "inactive" | "warning" | "neutral";

function InstitutionBadge({ tone, children }: { tone: InstitutionBadgeTone; children: ReactNode }) {
  const cls: Record<InstitutionBadgeTone, string> = {
    active: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
    inactive: "bg-gray-100 text-gray-700 ring-gray-200/80",
    warning: "bg-amber-50 text-amber-950 ring-amber-200/70",
    neutral: "bg-slate-50 text-slate-700 ring-slate-200/70",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${cls[tone]}`}
    >
      {children}
    </span>
  );
}

type CourseMgmtBadgeTone = "automatic" | "manual" | "inUse" | "empty";

function CourseManagementBadge({
  tone,
  children,
}: {
  tone: CourseMgmtBadgeTone;
  children: ReactNode;
}) {
  const cls: Record<CourseMgmtBadgeTone, string> = {
    automatic: "bg-sky-50 text-sky-900 ring-sky-200/90",
    manual: "bg-violet-50 text-violet-900 ring-violet-200/80",
    inUse: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
    empty: "bg-stone-100 text-stone-700 ring-stone-200/80",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ${cls[tone]}`}
    >
      {children}
    </span>
  );
}

function formatLectiveYearLabel(eventDate: string | null | undefined): string {
  if (!eventDate) return "—";
  const d = new Date(eventDate);
  if (!Number.isFinite(d.getTime())) return "—";
  return String(d.getFullYear());
}

function preventaEstadoLabel(album: Album): string {
  const productCount = album.preCompraProducts?.length ?? 0;
  if (!album.preCompraCloseAt && productCount === 0) return "Sin configurar";
  if (album.preCompraCloseAt) {
    const close = new Date(album.preCompraCloseAt);
    if (Number.isFinite(close.getTime()) && close.getTime() > Date.now()) {
      return `Activa (cierra ${close.toLocaleDateString("es-AR")})`;
    }
  }
  if (productCount > 0) return "Configurada";
  return "Cerrada";
}

type School = {
  id: number;
  name: string;
  logoUrl?: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  courses: SchoolCourse[];
  albums: Album[];
  academicYears?: AcademicYearBrief[];
};

type SchoolOrganizerMember = {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: number;
    name: string | null;
    email: string;
    role: string;
  };
};

type OrganizerCandidate = {
  id: number;
  name: string | null;
  email: string;
  role: string;
};

type SchoolOrganizerInvitationRow = {
  id: string;
  email: string;
  name: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

/** Plantillas V2 (mismo formato que `/api/dashboard/designs/templates`). */
type SchoolDesignsTemplate = {
  id: string;
  ownerUserId: number;
  isOwnedByViewer: boolean;
  name: string;
  description: string | null;
  status: string;
  currentVersionId: string | null;
  thumbnailUrl: string | null;
  preview: { width: number; height: number; background: string | null };
  tipoLabel: string;
  publication: { reviewStatus: string; visibility: string } | null;
  isSystemCatalog: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
};

function templateEditorHref(templateId: string, versionId: string | null): string | null {
  return versionId ? `/fotografo/diseno/plantillas/v2/${templateId}/${versionId}` : null;
}

function SchoolTemplateThumb({
  thumbnailUrl,
  preview,
  name,
}: {
  thumbnailUrl: string | null;
  preview: SchoolDesignsTemplate["preview"];
  name: string;
}) {
  const ratioStyle = `${Math.max(preview.width, 1)} / ${Math.max(preview.height, 1)}`;
  if (thumbnailUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-[#f1f5f9]" style={{ aspectRatio: ratioStyle }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- mismas URLs que el panel Diseños */}
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover object-top" />
      </div>
    );
  }
  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden rounded-lg text-center text-[11px] font-medium leading-tight text-[#475569] ring-1 ring-[#e2e8f0]"
      style={{
        aspectRatio: ratioStyle,
        backgroundColor: preview.background ?? "#f1f5f9",
      }}
    >
      <span className="line-clamp-3 px-3">{name.trim() || "Sin nombre"}</span>
    </div>
  );
}

function templateSchoolBadge(t: SchoolDesignsTemplate): { label: string; className: string } {
  if (t.isSystemCatalog) return { label: "Sistema", className: "bg-sky-100 text-sky-900 border border-sky-200/80" };
  if (t.isOwnedByViewer)
    return { label: "Personalizada", className: "bg-violet-100 text-violet-900 border border-violet-200/80" };
  return { label: "Catálogo", className: "bg-gray-100 text-gray-800 border border-gray-200/80" };
}

type SchoolCommission = {
  id: number;
  amount: number;
  percentage: number;
  baseAmount: number;
  status: "PENDING" | "REQUESTED" | "PAID" | "REJECTED" | "CANCELLED";
  createdAt: string;
  requestedAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  organizerUser: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  album: { id: number; title: string };
  order: { id: number };
};

function formatArsWhole(n: number) {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function commissionLineStatusLabel(status: SchoolCommission["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "REQUESTED":
      return "Solicitado";
    case "PAID":
      return "Pagado";
    case "REJECTED":
      return "Rechazado";
    case "CANCELLED":
      return "Anulado";
    default:
      return String(status);
  }
}

function albumCommissionRollupLabel(statuses: SchoolCommission["status"][]): string {
  if (statuses.length === 0) return "Sin movimientos";
  if (statuses.every((s) => s === "PAID")) return "Al día";
  if (statuses.some((s) => s === "REQUESTED" || s === "PENDING")) return "Pendiente";
  return "En seguimiento";
}

export default function FotografoEscuelaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const schoolId = parseInt(id, 10);

  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Nuevo curso
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDivision, setNewCourseDivision] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  // Vincular álbum
  const [showLinkAlbum, setShowLinkAlbum] = useState(false);
  const [albumsOptions, setAlbumsOptions] = useState<{ id: number; title: string; publicSlug: string }[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);
  const [schoolOrganizers, setSchoolOrganizers] = useState<SchoolOrganizerMember[]>([]);
  const [organizersLoading, setOrganizersLoading] = useState(false);
  const [organizersError, setOrganizersError] = useState<string | null>(null);
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [organizerCandidates, setOrganizerCandidates] = useState<OrganizerCandidate[]>([]);
  const [organizerSearchLoading, setOrganizerSearchLoading] = useState(false);
  const [selectedOrganizerUserId, setSelectedOrganizerUserId] = useState("");
  const [organizerSaveLoading, setOrganizerSaveLoading] = useState(false);
  const [removingOrganizerId, setRemovingOrganizerId] = useState<string | null>(null);
  const [isCreatingOrganizerUser, setIsCreatingOrganizerUser] = useState(false);
  const [createOrganizerName, setCreateOrganizerName] = useState("");
  const [createOrganizerEmail, setCreateOrganizerEmail] = useState("");
  const [createOrganizerLoading, setCreateOrganizerLoading] = useState(false);
  const [createOrganizerError, setCreateOrganizerError] = useState<string | null>(null);
  const [lastInvitationSent, setLastInvitationSent] = useState<{
    email: string;
    expiresAt: string;
  } | null>(null);
  const [organizerInvitations, setOrganizerInvitations] = useState<SchoolOrganizerInvitationRow[]>([]);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<SchoolCommission[]>([]);
  const [commissionSummary, setCommissionSummary] = useState({
    acumulado: 0,
    pendiente: 0,
    solicitado: 0,
    pagado: 0,
  });
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [markingCommissionId, setMarkingCommissionId] = useState<number | null>(null);
  const [paymentMethodByCommission, setPaymentMethodByCommission] = useState<Record<number, string>>(
    {}
  );
  const [paymentProofByCommission, setPaymentProofByCommission] = useState<Record<number, string>>(
    {}
  );

  const [rosterImportAlbumId, setRosterImportAlbumId] = useState("");
  const [rosterImportAcademicYearId, setRosterImportAcademicYearId] = useState("");
  const [rosterImportFile, setRosterImportFile] = useState<File | null>(null);
  const [rosterImportCsvText, setRosterImportCsvText] = useState("");
  const [rosterImportLoading, setRosterImportLoading] = useState(false);
  const [rosterImportError, setRosterImportError] = useState<string | null>(null);
  const [rosterImportSummary, setRosterImportSummary] = useState<{
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
    rowErrors: Array<{ rowNumber: number; message: string }>;
  } | null>(null);

  const [academicSubTab, setAcademicSubTab] = useState<"alumnos" | "cursos" | "importaciones">("alumnos");
  const [schoolRosterRows, setSchoolRosterRows] = useState<SchoolRosterAggregationRow[]>([]);
  const [schoolRosterLoading, setSchoolRosterLoading] = useState(false);
  const [schoolRosterError, setSchoolRosterError] = useState<string | null>(null);
  const [schoolRosterTruncated, setSchoolRosterTruncated] = useState(false);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  /** Búsqueda local en tabla de alumnos (solo UI). */
  const [studentListQuery, setStudentListQuery] = useState("");

  const [designTemplatesLoading, setDesignTemplatesLoading] = useState(false);
  const [designTemplatesError, setDesignTemplatesError] = useState<string | null>(null);
  const [designSystemTemplates, setDesignSystemTemplates] = useState<SchoolDesignsTemplate[]>([]);
  const [designUserTemplates, setDesignUserTemplates] = useState<SchoolDesignsTemplate[]>([]);
  const [designBusyCloneId, setDesignBusyCloneId] = useState<string | null>(null);
  const [designBusyDeleteId, setDesignBusyDeleteId] = useState<string | null>(null);
  const [designMessage, setDesignMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("institucion");

  const photographerSchoolTabs = useMemo(
    () => [
      {
        id: "institucion",
        label: "Institución",
        icon: <Building2 className="h-4 w-4" aria-hidden />,
      },
      { id: "usuarios", label: "Administradores", icon: <Users className="h-4 w-4" aria-hidden /> },
      {
        id: "alumnos_y_cursos",
        label: "Gestión escolar",
        icon: <BookMarked className="h-4 w-4" aria-hidden />,
      },
      { id: "albumes", label: "Álbumes", icon: <Images className="h-4 w-4" aria-hidden /> },
      {
        id: "plantillas",
        label: "Plantillas",
        icon: <LayoutTemplate className="h-4 w-4" aria-hidden />,
      },
      {
        id: "comisiones_ventas",
        label: "Comisiones y ventas",
        icon: <CreditCard className="h-4 w-4" aria-hidden />,
      },
      {
        id: "config_privacidad",
        label: "Configuración y privacidad",
        icon: <Shield className="h-4 w-4" aria-hidden />,
      },
    ],
    []
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!schoolId || !Number.isFinite(schoolId)) return;
    let active = true;
    async function load() {
      const res = await fetch(`/api/fotografo/schools/${schoolId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (active) {
          setSchool(data);
          setEditName(data.name);
          setEditContactEmail(data.contactEmail || "");
          setEditContactPhone(data.contactPhone || "");
          setEditNotes(data.notes || "");
          setEditAddress(data.address || "");
          setEditCity(data.city || "");
          setEditProvince(data.province || "");
          setEditCountry(data.country || "");
          setEditLatitude(data.latitude ?? null);
          setEditLongitude(data.longitude ?? null);
          setEditLogoUrl(data.logoUrl ?? null);
        }
      } else if (res.status === 404 && active) {
        router.push("/fotografo/escuelas");
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [schoolId, router]);

  const reloadSchool = useCallback(async () => {
    if (!schoolId || !Number.isFinite(schoolId)) return;
    const res = await fetch(`/api/fotografo/schools/${schoolId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setSchool(data);
  }, [schoolId]);

  useEffect(() => {
    if (!school?.albums?.length) {
      setRosterImportAlbumId("");
      return;
    }
    setRosterImportAlbumId((prev) =>
      prev && school.albums.some((a) => String(a.id) === prev)
        ? prev
        : String(school.albums[0].id)
    );
  }, [school]);

  useEffect(() => {
    if (showLinkAlbum) {
      fetch("/api/dashboard/albums", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setAlbumsOptions(
            list
              .filter((a: any) => !a.deletedAt)
              .map((a: any) => ({ id: a.id, title: a.title, publicSlug: a.publicSlug }))
          );
        })
        .catch(() => setAlbumsOptions([]));
    }
  }, [showLinkAlbum]);

  useEffect(() => {
    const currentSchoolId = school?.id;
    if (!currentSchoolId) return;
    let active = true;
    async function loadSchoolOrganizers() {
      setOrganizersLoading(true);
      setOrganizersError(null);
      try {
        const res = await fetch(`/api/admin/schools/${currentSchoolId}/organizers`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar los usuarios de escuela");
        }
        if (!active) return;
        setSchoolOrganizers(Array.isArray(data?.organizers) ? data.organizers : []);
      } catch (err: any) {
        if (!active) return;
        setOrganizersError(err?.message || "No se pudieron cargar los usuarios de escuela");
        setSchoolOrganizers([]);
      } finally {
        if (active) setOrganizersLoading(false);
      }
    }
    void loadSchoolOrganizers();
    return () => {
      active = false;
    };
  }, [school?.id]);

  useEffect(() => {
    const currentSchoolId = school?.id;
    if (!currentSchoolId) return;
    let active = true;
    async function loadInvitations() {
      try {
        const res = await fetch(`/api/admin/schools/${currentSchoolId}/organizers/invite`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar invitaciones");
        }
        if (!active) return;
        setOrganizerInvitations(Array.isArray(data?.invitations) ? data.invitations : []);
      } catch {
        if (!active) return;
        setOrganizerInvitations([]);
      }
    }
    void loadInvitations();
    return () => {
      active = false;
    };
  }, [school?.id]);

  useEffect(() => {
    const currentSchoolId = school?.id;
    if (!currentSchoolId) {
      setOrganizerCandidates([]);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setOrganizerSearchLoading(true);
      try {
        const query = organizerSearch.trim();
        const url = query
          ? `/api/admin/schools/${currentSchoolId}/organizers/candidates?q=${encodeURIComponent(query)}`
          : `/api/admin/schools/${currentSchoolId}/organizers/candidates`;
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar cuentas disponibles para asignar");
        }
        const rows = Array.isArray(data?.users) ? data.users : [];
        setOrganizerCandidates(rows);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setOrganizerCandidates([]);
      } finally {
        setOrganizerSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [organizerSearch, school?.id]);

  useEffect(() => {
    const currentSchoolId = school?.id;
    if (!currentSchoolId) return;
    let active = true;
    async function loadCommissions() {
      setCommissionsLoading(true);
      setCommissionError(null);
      try {
        const res = await fetch(`/api/admin/schools/${currentSchoolId}/organizer-commissions`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar las comisiones");
        }
        if (!active) return;
        setCommissions(Array.isArray(data?.commissions) ? data.commissions : []);
        setCommissionSummary(
          data?.summary ?? { acumulado: 0, pendiente: 0, solicitado: 0, pagado: 0 }
        );
      } catch (err: any) {
        if (!active) return;
        setCommissionError(err?.message || "No se pudieron cargar las comisiones");
      } finally {
        if (active) setCommissionsLoading(false);
      }
    }
    void loadCommissions();
    return () => {
      active = false;
    };
  }, [school?.id]);

  useEffect(() => {
    const sid = schoolId;
    if (
      !Number.isFinite(sid) ||
      activeTab !== "alumnos_y_cursos" ||
      (academicSubTab !== "alumnos" && academicSubTab !== "cursos")
    ) {
      return;
    }
    let active = true;
    async function loadRosterAgg() {
      setSchoolRosterLoading(true);
      setSchoolRosterError(null);
      try {
        const res = await fetch(`/api/fotografo/schools/${sid}/roster-entries?take=500`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar el padrón");
        }
        if (!active) return;
        setSchoolRosterRows(Array.isArray(data.entries) ? data.entries : []);
        setSchoolRosterTruncated(Boolean(data.truncatedHint));
      } catch (e) {
        if (!active) return;
        setSchoolRosterError(e instanceof Error ? e.message : "Error al cargar el listado de alumnos");
        setSchoolRosterRows([]);
        setSchoolRosterTruncated(false);
      } finally {
        if (active) setSchoolRosterLoading(false);
      }
    }
    void loadRosterAgg();
    return () => {
      active = false;
    };
  }, [schoolId, activeTab, academicSubTab, rosterRefreshKey]);

  useEffect(() => {
    if (activeTab !== "plantillas") return;
    let active = true;
    async function loadTpl() {
      setDesignTemplatesLoading(true);
      setDesignTemplatesError(null);
      try {
        const res = await fetch("/api/dashboard/designs/templates", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudieron cargar plantillas");
        }
        if (!active) return;
        setDesignSystemTemplates(Array.isArray(data.systemTemplates) ? data.systemTemplates : []);
        setDesignUserTemplates(Array.isArray(data.userTemplates) ? data.userTemplates : []);
      } catch (e) {
        if (!active) return;
        setDesignTemplatesError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (active) setDesignTemplatesLoading(false);
      }
    }
    void loadTpl();
    return () => {
      active = false;
    };
  }, [activeTab]);

  async function handleSaveSchool() {
    if (!school) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          contactEmail: editContactEmail.trim() || null,
          contactPhone: editContactPhone.trim() || null,
          notes: editNotes.trim() || null,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          province: editProvince.trim() || null,
          country: editCountry.trim() || null,
          latitude: editLatitude,
          longitude: editLongitude,
          logoUrl: editLogoUrl,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setSchool({ ...school, ...data, albums: school.albums, courses: school.courses });
      setEditing(false);
    } catch (err: any) {
      alert(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCourse() {
    if (!school || !newCourseName.trim()) return;
    setSavingCourse(true);
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourseName.trim(),
          division: newCourseDivision.trim() || null,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear");
      setSchool({ ...school, courses: [...school.courses, data] });
      setNewCourseName("");
      setNewCourseDivision("");
      setShowNewCourse(false);
    } catch (err: any) {
      alert(err?.message || "Error al crear curso");
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleDeleteCourse(courseId: number) {
    if (!school || !confirm("¿Eliminar este curso?")) return;
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}/courses/${courseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Error al eliminar");
      }
      setSchool({
        ...school,
        courses: school.courses.filter((c) => c.id !== courseId),
      });
    } catch (err: any) {
      alert(err?.message || "Error al eliminar");
    }
  }

  async function handleLinkAlbum() {
    if (!school || !selectedAlbumId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${selectedAlbumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, type: "SCHOOL" }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al vincular");
      }
      const data = await res.json();
      setSchool({
        ...school,
        albums: [
          ...school.albums,
          {
            id: data.id,
            title: data.title,
            publicSlug: data.publicSlug,
            type: "SCHOOL",
            preCompraCloseAt: data.preCompraCloseAt ?? null,
          },
        ],
      });
      setShowLinkAlbum(false);
      setSelectedAlbumId(null);
    } catch (err: any) {
      alert(err?.message || "Error al vincular álbum");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkAlbum(albumId: number) {
    if (!school || !confirm("¿Desvincular este álbum de la escuela?")) return;
    try {
      await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: null }),
        credentials: "include",
      });
      setSchool({
        ...school,
        albums: school.albums.filter((a) => a.id !== albumId),
      });
    } catch (err: any) {
      alert("Error al desvincular");
    }
  }

  function getPreventaLink(album: Album) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/album/${album.publicSlug}`;
  }

  function copyPreventaLink(album: Album) {
    const url = getPreventaLink(album);
    navigator.clipboard.writeText(url);
    alert("Link copiado al portapapeles");
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
  }

  async function reloadSchoolOrganizers() {
    if (!school?.id) return;
    const res = await fetch(`/api/admin/schools/${school.id}/organizers`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "No se pudieron cargar los usuarios de escuela");
    }
    setSchoolOrganizers(Array.isArray(data?.organizers) ? data.organizers : []);
  }

  async function reloadSchoolOrganizerInvitations() {
    if (!school?.id) return;
    const res = await fetch(`/api/admin/schools/${school.id}/organizers/invite`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "No se pudieron cargar las invitaciones");
    }
    setOrganizerInvitations(Array.isArray(data?.invitations) ? data.invitations : []);
  }

  async function handleAddSchoolOrganizer() {
    if (!school?.id || !selectedOrganizerUserId) return;
    setOrganizerSaveLoading(true);
    setOrganizersError(null);
    try {
      const res = await fetch(`/api/admin/schools/${school.id}/organizers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: Number(selectedOrganizerUserId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo asignar el usuario a la escuela");
      }
      setSelectedOrganizerUserId("");
      await reloadSchoolOrganizers();
    } catch (err: any) {
      setOrganizersError(err?.message || "No se pudo asignar el usuario a la escuela");
    } finally {
      setOrganizerSaveLoading(false);
    }
  }

  async function handleRemoveSchoolOrganizer(membershipId: string) {
    if (!school?.id) return;
    const confirmed = window.confirm(
      "¿Querés remover el acceso de este usuario a la escuela? Esta acción se puede volver a asignar luego."
    );
    if (!confirmed) return;
    setRemovingOrganizerId(membershipId);
    setOrganizersError(null);
    try {
      const res = await fetch(`/api/admin/schools/${school.id}/organizers/${membershipId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo remover el acceso");
      }
      await reloadSchoolOrganizers();
    } catch (err: any) {
      setOrganizersError(err?.message || "No se pudo remover el acceso");
    } finally {
      setRemovingOrganizerId(null);
    }
  }

  async function handleInviteSchoolOrganizerUser() {
    if (!school?.id) return;
    setCreateOrganizerLoading(true);
    setCreateOrganizerError(null);
    setOrganizersError(null);
    try {
      const payload = {
        name: createOrganizerName.trim(),
        email: createOrganizerEmail.trim(),
      };
      const res = await fetch(`/api/admin/schools/${school.id}/organizers/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo enviar la invitación");
      }
      setLastInvitationSent({
        email: String(data?.invitation?.email ?? payload.email),
        expiresAt: String(data?.invitation?.expiresAt ?? ""),
      });
      setCreateOrganizerName("");
      setCreateOrganizerEmail("");
      setIsCreatingOrganizerUser(false);
      await Promise.all([reloadSchoolOrganizers(), reloadSchoolOrganizerInvitations()]);
    } catch (err: any) {
      setCreateOrganizerError(err?.message || "No se pudo enviar la invitación");
    } finally {
      setCreateOrganizerLoading(false);
    }
  }

  async function handleResendInvitation(invitationId: string) {
    if (!school?.id) return;
    setResendingInvitationId(invitationId);
    setCreateOrganizerError(null);
    try {
      const res = await fetch(
        `/api/admin/schools/${school.id}/organizers/invite/${invitationId}/resend`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reenviar la invitación");
      }
      setLastInvitationSent({
        email: String(data?.invitation?.email ?? ""),
        expiresAt: String(data?.invitation?.expiresAt ?? ""),
      });
      await reloadSchoolOrganizerInvitations();
    } catch (err: any) {
      setCreateOrganizerError(err?.message || "No se pudo reenviar la invitación");
    } finally {
      setResendingInvitationId(null);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!school?.id) return;
    const confirmed = window.confirm("¿Querés cancelar esta invitación?");
    if (!confirmed) return;
    setCancellingInvitationId(invitationId);
    setCreateOrganizerError(null);
    try {
      const res = await fetch(
        `/api/admin/schools/${school.id}/organizers/invite/${invitationId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cancelar la invitación");
      }
      await reloadSchoolOrganizerInvitations();
    } catch (err: any) {
      setCreateOrganizerError(err?.message || "No se pudo cancelar la invitación");
    } finally {
      setCancellingInvitationId(null);
    }
  }

  async function handleMarkCommissionPaid(commission: SchoolCommission) {
    setMarkingCommissionId(commission.id);
    setCommissionError(null);
    try {
      const res = await fetch(`/api/admin/organizer-commissions/${commission.id}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          paymentMethod: paymentMethodByCommission[commission.id] || "",
          paymentProofUrl: paymentProofByCommission[commission.id] || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo marcar como pagada");
      }

      const currentSchoolId = school?.id;
      if (!currentSchoolId) return;
      const reload = await fetch(`/api/admin/schools/${currentSchoolId}/organizer-commissions`, {
        credentials: "include",
      });
      const reloadData = await reload.json().catch(() => ({}));
      if (reload.ok) {
        setCommissions(Array.isArray(reloadData?.commissions) ? reloadData.commissions : []);
        setCommissionSummary(
          reloadData?.summary ?? {
            acumulado: 0,
            pendiente: 0,
            solicitado: 0,
            pagado: 0,
          }
        );
      }
    } catch (err: any) {
      setCommissionError(err?.message || "No se pudo marcar la comisión como pagada");
    } finally {
      setMarkingCommissionId(null);
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/fotografo/schools/upload-logo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al subir");
      if (data.logoUrl) setEditLogoUrl(data.logoUrl);
    } catch (err: any) {
      alert(err?.message || "Error al subir el logo");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleImportStudentRoster() {
    if (!rosterImportAlbumId) {
      setRosterImportError("Elegí un álbum vinculado para completar esta importación.");
      return;
    }
    if (!rosterImportFile && !rosterImportCsvText.trim()) {
      setRosterImportError("Subí un archivo CSV/Excel o pegá el contenido CSV en el cuadro de texto.");
      return;
    }
    setRosterImportLoading(true);
    setRosterImportError(null);
    try {
      const endpoint = `/api/dashboard/albums/${rosterImportAlbumId}/student-roster/import`;
      let res: Response;
      const ayRaw = rosterImportAcademicYearId.trim();
      const ayParsed = ayRaw === "" ? NaN : parseInt(ayRaw, 10);
      const ay =
        ayRaw !== "" && Number.isInteger(ayParsed) && ayParsed > 0 ? ayParsed : undefined;
      if (rosterImportFile) {
        const formData = new FormData();
        formData.append("file", rosterImportFile);
        if (ay != null) formData.append("academicYearId", String(ay));
        res = await fetch(endpoint, { method: "POST", credentials: "include", body: formData });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv: rosterImportCsvText,
            ...(ay != null ? { academicYearId: ay } : {}),
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo importar el listado");
      }
      setRosterImportSummary({
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
        rowErrors: Array.isArray(data.rowErrors)
          ? data.rowErrors.map((row: { rowNumber?: unknown; message?: unknown }) => ({
              rowNumber: Number(row?.rowNumber) || 0,
              message: typeof row?.message === "string" ? row.message : "Error en fila",
            }))
          : [],
      });
      setRosterImportFile(null);
      setRosterImportCsvText("");
      await reloadSchool();
      setRosterRefreshKey((x) => x + 1);
    } catch (err) {
      setRosterImportError(err instanceof Error ? err.message : "No se pudo importar el listado");
    } finally {
      setRosterImportLoading(false);
    }
  }

  const aggregatedCourseSlots = useMemo(() => {
    const map = new Map<
      string,
      {
        level: string;
        shift: string;
        courseName: string;
        division: string;
        uniqueStudents: Set<number>;
        rosterRowCount: number;
      }
    >();
    for (const row of schoolRosterRows) {
      const key = [row.level, row.shift, row.courseName, row.division].join("\u0001");
      let cur = map.get(key);
      if (!cur) {
        cur = {
          level: row.level,
          shift: row.shift,
          courseName: row.courseName,
          division: row.division,
          uniqueStudents: new Set<number>(),
          rosterRowCount: 0,
        };
      }
      cur.uniqueStudents.add(row.studentId);
      cur.rosterRowCount += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ca = `${a.level}\t${a.courseName}\t${a.division}\t${a.shift}`;
      const cb = `${b.level}\t${b.courseName}\t${b.division}\t${b.shift}`;
      return ca.localeCompare(cb, "es");
    });
  }, [schoolRosterRows]);

  const courseDefinitionRows = useMemo(() => {
    if (!school) return [];
    return school.courses.map((c) => {
      const match = aggregatedCourseSlots.find(
        (row) =>
          row.courseName.trim() === c.name.trim() &&
          (row.division || "").trim() === (c.division || "").trim()
      );
      return {
        course: c,
        uniqueStudentsInRoster: match?.uniqueStudents.size ?? 0,
      };
    });
  }, [school, aggregatedCourseSlots]);

  type InstitutionTreeShift = {
    shiftKey: string;
    shiftLabel: string;
    items: Array<{
      courseName: string;
      division: string;
      studentCount: number;
    }>;
  };

  const institutionCourseTree = useMemo(() => {
    const levelMap = new Map<string, Map<string, InstitutionTreeShift["items"]>>();
    for (const slot of aggregatedCourseSlots) {
      const levelKey = (slot.level || "").trim() || "__sin_nivel";
      const shiftKey = (slot.shift || "").trim() || "__sin_turno";
      if (!levelMap.has(levelKey)) levelMap.set(levelKey, new Map());
      const sm = levelMap.get(levelKey)!;
      if (!sm.has(shiftKey)) sm.set(shiftKey, []);
      const items = sm.get(shiftKey)!;
      items.push({
        courseName: slot.courseName || "—",
        division: slot.division || "",
        studentCount: slot.uniqueStudents.size,
      });
    }
    const levelKeys = [...levelMap.keys()].sort((a, b) => {
      if (a === "__sin_nivel") return 1;
      if (b === "__sin_nivel") return -1;
      return a.localeCompare(b, "es");
    });
    return levelKeys.map((levelKey) => {
      const sm = levelMap.get(levelKey)!;
      const shiftKeys = [...sm.keys()].sort((a, b) => {
        if (a === "__sin_turno") return 1;
        if (b === "__sin_turno") return -1;
        return a.localeCompare(b, "es");
      });
      const shifts: InstitutionTreeShift[] = shiftKeys.map((sk) => {
        const items = sm.get(sk)!;
        items.sort((a, b) => {
          const ca = `${a.courseName}\t${a.division}`;
          const cb = `${b.courseName}\t${b.division}`;
          return ca.localeCompare(cb, "es");
        });
        return {
          shiftKey: sk,
          shiftLabel: sk === "__sin_turno" ? "Sin turno indicado" : sk,
          items,
        };
      });
      return {
        levelKey,
        levelLabel: levelKey === "__sin_nivel" ? "Sin nivel indicado" : levelKey,
        shifts,
      };
    });
  }, [aggregatedCourseSlots]);

  const albumTitlesBySchoolCourseId = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!school) return map;
    for (const c of school.courses) {
      const titles = new Set<string>();
      for (const row of schoolRosterRows) {
        if (
          row.courseName.trim() === c.name.trim() &&
          (row.division || "").trim() === (c.division || "").trim()
        ) {
          const t = row.album.title?.trim();
          if (t) titles.add(t);
        }
      }
      if (titles.size > 0) map.set(c.id, [...titles].sort((a, b) => a.localeCompare(b, "es")));
    }
    return map;
  }, [school, schoolRosterRows]);

  const albumCountByStudentId = useMemo(() => {
    const byStudent = new Map<number, Set<number>>();
    for (const row of schoolRosterRows) {
      let set = byStudent.get(row.studentId);
      if (!set) {
        set = new Set<number>();
        byStudent.set(row.studentId, set);
      }
      set.add(row.album.id);
    }
    const counts = new Map<number, number>();
    for (const [sid, albSet] of byStudent) {
      counts.set(sid, albSet.size);
    }
    return counts;
  }, [schoolRosterRows]);

  const commissionedSalesTotal = useMemo(() => {
    const byOrder = new Map<number, number>();
    for (const c of commissions) {
      const oid = c.order.id;
      byOrder.set(oid, Math.max(byOrder.get(oid) ?? 0, c.baseAmount));
    }
    let s = 0;
    for (const v of byOrder.values()) s += v;
    return s;
  }, [commissions]);

  const commissionAvgPctDisplay = useMemo(() => {
    if (commissions.length === 0) return null;
    const avg = commissions.reduce((a, c) => a + c.percentage, 0) / commissions.length;
    return Math.round(avg * 10) / 10;
  }, [commissions]);

  const albumCommercialRows = useMemo(() => {
    if (!school) return [];
    const agg = new Map<number, { sales: number; commission: number; statuses: SchoolCommission["status"][] }>();
    for (const c of commissions) {
      const id = c.album.id;
      const cur = agg.get(id) ?? { sales: 0, commission: 0, statuses: [] as SchoolCommission["status"][] };
      cur.sales += c.baseAmount;
      cur.commission += c.amount;
      cur.statuses.push(c.status);
      agg.set(id, cur);
    }
    return school.albums.map((a) => {
      const g = agg.get(a.id);
      return {
        albumId: a.id,
        title: a.title,
        sales: g?.sales ?? 0,
        commission: g?.commission ?? 0,
        statuses: g?.statuses ?? [],
      };
    });
  }, [school, commissions]);

  const nextRequestedPaymentLabel = useMemo(() => {
    const ts = commissions
      .filter((c) => c.status === "REQUESTED" && c.requestedAt)
      .map((c) => new Date(c.requestedAt!).getTime())
      .filter((t) => Number.isFinite(t));
    if (ts.length === 0) return null;
    const d = new Date(Math.min(...ts));
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  }, [commissions]);

  /** DNI repetido entre filas ≠ error de servidor; aviso UX “posible duplicado”. */
  const duplicateNormalizedDnis = useMemo(() => {
    const by = new Map<string, number>();
    for (const row of schoolRosterRows) {
      const raw = row.student.dni?.trim();
      if (!raw) continue;
      const key = raw.toUpperCase();
      by.set(key, (by.get(key) ?? 0) + 1);
    }
    return new Set(
      [...by.entries()].filter(([, count]) => count > 1).map(([dn]) => dn)
    );
  }, [schoolRosterRows]);

  const filteredSchoolRosterRows = useMemo(() => {
    const q = studentListQuery.trim().toLowerCase();
    if (!q) return schoolRosterRows;
    return schoolRosterRows.filter((row) => {
      const blob = [
        row.snapshotFirstName,
        row.snapshotLastName,
        row.student.externalStudentId,
        row.student.dni,
        row.level,
        row.courseName,
        row.division,
        row.shift,
      ]
        .map((x) => (x ?? "").toString().toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [schoolRosterRows, studentListQuery]);

  async function designCloneCatalog(templateId: string) {
    setDesignBusyCloneId(templateId);
    setDesignMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.templateId && data.versionId) {
        router.push(
          `/fotografo/diseno/plantillas/v2/${encodeURIComponent(data.templateId)}/${encodeURIComponent(data.versionId)}`
        );
        return;
      }
      setDesignMessage(data?.error || "No se pudo clonar la plantilla.");
    } catch {
      setDesignMessage("Error de red al clonar.");
    } finally {
      setDesignBusyCloneId(null);
    }
  }

  async function designDuplicateOwn(templateId: string) {
    setDesignBusyCloneId(templateId);
    setDesignMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDesignMessage(`Duplicado: ${data.name || "copia creada"}.`);
        const reload = await fetch("/api/dashboard/designs/templates", { credentials: "include" });
        const j = await reload.json().catch(() => ({}));
        if (reload.ok && j.ok) {
          setDesignSystemTemplates(Array.isArray(j.systemTemplates) ? j.systemTemplates : []);
          setDesignUserTemplates(Array.isArray(j.userTemplates) ? j.userTemplates : []);
        }
      } else {
        setDesignMessage(data?.error || "No se pudo duplicar.");
      }
    } catch {
      setDesignMessage("Error de red al duplicar.");
    } finally {
      setDesignBusyCloneId(null);
    }
  }

  async function designDelete(templateId: string, nameLabel: string) {
    if (!window.confirm(`¿Eliminar la plantilla "${nameLabel}"? Esta acción no se puede deshacer.`)) return;
    setDesignBusyDeleteId(templateId);
    setDesignMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDesignMessage("Plantilla eliminada.");
        setDesignUserTemplates((prev) => prev.filter((t) => t.id !== templateId));
      } else {
        setDesignMessage(data?.error || "No se pudo eliminar.");
      }
    } catch {
      setDesignMessage("Error de red al eliminar.");
    } finally {
      setDesignBusyDeleteId(null);
    }
  }

  const displayLogoUrl = editing ? editLogoUrl : school?.logoUrl ?? null;

  if (loading || !school) {
    return (
      <div className="min-h-screen w-full min-w-0 bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-8">
        <DsDashboardInner className="space-y-8">
          <div className="mb-6">
            <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
              ← Volver a Escolar
            </Link>
          </div>

          <Card className="min-w-0 overflow-x-clip border border-[#ebe8e4] p-0 shadow-sm">
            <Tabs
              tabs={photographerSchoolTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              stickyTabBar
              contentClassName="p-4 md:p-8 min-w-0"
            >
              {activeTab === "institucion" && (
                <DsTabPanel>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid w-full min-w-0 text-gray-600">
                    Esta es la institución madre para fotografía escolar: logo, datos de contacto y ubicación. Los
                    álbumes escolares vinculados heredan contexto institucional.
                  </p>
                  <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] p-0 shadow-sm w-full">
                    <div className="flex flex-col sm:flex-row sm:items-stretch">
              <div className="flex shrink-0 self-stretch justify-center bg-gradient-to-b from-gray-50 to-gray-100 border-b sm:border-b-0 sm:border-r border-gray-200 sm:w-44 md:w-52">
                <div className="flex h-full min-h-[160px] w-full items-center justify-center p-4 sm:p-3 sm:min-h-0">
                  {displayLogoUrl ? (
                    <img
                      src={displayLogoUrl}
                      alt=""
                      className="h-full w-full max-h-[min(280px,45vh)] sm:max-h-none object-contain object-center"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 text-center px-2">Sin logo</span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col min-w-0">
            <div className="flex justify-between items-start gap-3 mb-4">
              <h1 className="text-xl font-bold text-gray-900">{school.name}</h1>
              {!editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="primary" onClick={handleSaveSchool} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(false);
                      setEditName(school.name);
                      setEditContactEmail(school.contactEmail || "");
                      setEditContactPhone(school.contactPhone || "");
                      setEditNotes(school.notes || "");
                      setEditAddress(school.address || "");
                      setEditCity(school.city || "");
                      setEditProvince(school.province || "");
                      setEditCountry(school.country || "");
                      setEditLatitude(school.latitude ?? null);
                      setEditLongitude(school.longitude ?? null);
                      setEditLogoUrl(school.logoUrl ?? null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="flex w-full min-w-0 flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? "Subiendo…" : editLogoUrl ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {editLogoUrl && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => setEditLogoUrl(null)}
                      >
                        Quitar logo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP o GIF, máx. 5 MB.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email contacto</label>
                  <Input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono contacto</label>
                  <Input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
                </div>
                <AddressGeoSearch
                  address={editAddress}
                  city={editCity}
                  province={editProvince}
                  country={editCountry}
                  latitude={editLatitude}
                  longitude={editLongitude}
                  onAddressChange={setEditAddress}
                  onCityChange={setEditCity}
                  onProvinceChange={setEditProvince}
                  onCountryChange={setEditCountry}
                  onCoordsChange={(lat, lon) => {
                    setEditLatitude(lat);
                    setEditLongitude(lon);
                  }}
                  placeholder="Buscar dirección (ej. Colegio San Martín, Buenos Aires)"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-1">
                {(school.contactEmail || school.contactPhone) && (
                  <p>{[school.contactEmail, school.contactPhone].filter(Boolean).join(" · ")}</p>
                )}
                {(school.address || school.city) && (
                  <p className="mt-1">
                    {[school.address, school.city, school.province, school.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {school.notes && <p className="mt-2">{school.notes}</p>}
              </div>
            )}
              </div>
            </div>
          </Card>
                  <Card className="rounded-2xl border border-dashed border-[#dcd6cf] bg-[#fafaf9] p-6 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Color institucional
                    </h2>
                    <p className="mt-2 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                      Pronto vas a poder guardar aquí una referencia de color para branding coherente en diseños y
                      materiales. Por ahora es solo planificación UX.
                    </p>
                  </Card>
                </DsTabPanel>
              )}

              {activeTab === "usuarios" && (
                <DsTabPanel>
                  <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Administradores de escuela</h2>
                <p className="mt-1 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                  Quienes operan esta institución desde su cuenta (secretaría, cooperadora u otros equipos internos).
                </p>
                <p className="mt-3 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                  Quedan vinculados a la escuela, no a un solo álbum. Podés{" "}
                  <strong className="font-medium text-gray-700">invitar por email</strong> o buscar cuentas que ya están
                  habilitadas como administrador para asignarlas acá. Más adelante sumaremos permisos más finos (solo
                  lectura, ventas, gestión de alumnos y de álbumes).
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setIsCreatingOrganizerUser((prev) => !prev);
                  setCreateOrganizerError(null);
                }}
              >
                {isCreatingOrganizerUser
                  ? "Cerrar creación"
                  : "Invitar administrador de escuela"}
              </Button>
            </div>

            {organizersError ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {organizersError}
              </p>
            ) : null}

            {isCreatingOrganizerUser ? (
              <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {createOrganizerError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createOrganizerError}
                  </p>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
                    <Input
                      value={createOrganizerName}
                      onChange={(event) => setCreateOrganizerName(event.target.value)}
                      placeholder="Nombre del responsable"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                    <Input
                      type="email"
                      value={createOrganizerEmail}
                      onChange={(event) => setCreateOrganizerEmail(event.target.value)}
                      placeholder="escuela@dominio.com"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleInviteSchoolOrganizerUser()}
                    disabled={
                      createOrganizerLoading ||
                      !createOrganizerName.trim() ||
                      !createOrganizerEmail.trim()
                    }
                  >
                    {createOrganizerLoading ? "Enviando..." : "Invitar y asignar"}
                  </Button>
                </div>
              </div>
            ) : null}

            {lastInvitationSent ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-900">Invitación enviada</p>
                <p className="mt-1 text-emerald-900">
                  Email: <span className="font-medium">{lastInvitationSent.email}</span>
                </p>
                <p className="text-emerald-900">Estado: Invitación enviada</p>
                {lastInvitationSent.expiresAt ? (
                  <p className="text-emerald-900">
                    Vence: <span className="font-medium">{formatDate(lastInvitationSent.expiresAt)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(12rem,22rem)_auto] md:items-end">
              <div className="min-w-0">
                <Input
                  placeholder="Buscar por nombre o email (cuentas ya habilitadas como administrador)"
                  value={organizerSearch}
                  onChange={(event) => setOrganizerSearch(event.target.value)}
                />
              </div>
              <div className="min-w-0">
                <select
                  className="box-border w-full min-w-0 max-w-full rounded-xl border border-[#111827]/10 bg-white px-3 py-3 text-sm text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                  value={selectedOrganizerUserId}
                  onChange={(event) => setSelectedOrganizerUserId(event.target.value)}
                >
                  <option value="">
                    {organizerSearchLoading
                      ? "Buscando..."
                      : organizerCandidates.length
                        ? "Elegir administrador para asignar"
                        : "Sin cuentas que coincidan"}
                  </option>
                  {organizerCandidates.map((candidate) => (
                    <option key={candidate.id} value={String(candidate.id)}>
                      {(candidate.name || candidate.email) + ` · ${candidate.email}`}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => void handleAddSchoolOrganizer()}
                disabled={!selectedOrganizerUserId || organizerSaveLoading}
              >
                {organizerSaveLoading ? "Asignando..." : "Asignar administrador"}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Estado
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Alta
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {organizersLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-sm text-gray-600">
                        Cargando administradores…
                      </td>
                    </tr>
                  ) : schoolOrganizers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-sm text-gray-600">
                        Todavía no hay administradores de escuela asignados.
                      </td>
                    </tr>
                  ) : (
                    schoolOrganizers.map((member) => (
                      <tr key={member.id}>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          {member.user.name || "Sin nombre"}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">{member.user.email}</td>
                        <td className="px-3 py-3 text-sm text-gray-700">{member.status}</td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {formatDate(member.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRemoveSchoolOrganizer(member.id)}
                            disabled={removingOrganizerId === member.id}
                          >
                            {removingOrganizerId === member.id ? "Removiendo..." : "Remover"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Invitación
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Estado
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                      Vencimiento
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {organizerInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-sm text-gray-600">
                        No hay invitaciones a administradores de escuela registradas para esta institución.
                      </td>
                    </tr>
                  ) : (
                    organizerInvitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          {invitation.name || invitation.email}
                          <div className="text-xs text-gray-600">{invitation.email}</div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">{invitation.status}</td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {formatDate(invitation.expiresAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleResendInvitation(invitation.id)}
                              disabled={
                                invitation.status !== "PENDING" &&
                                invitation.status !== "EXPIRED" ||
                                resendingInvitationId === invitation.id
                              }
                            >
                              {resendingInvitationId === invitation.id ? "Reenviando..." : "Reenviar"}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleCancelInvitation(invitation.id)}
                              disabled={
                                invitation.status !== "PENDING" ||
                                cancellingInvitationId === invitation.id
                              }
                            >
                              {cancellingInvitationId === invitation.id ? "Cancelando..." : "Cancelar"}
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
                </DsTabPanel>
              )}

              {activeTab === "alumnos_y_cursos" && (
                <DsTabPanel>
                  <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                    Desde esta sección reunís los alumnos de la institución y la estructura de cursos. Los mismos datos
                    alimentan las sesiones fotográficas (álbumes) sin que necesites conocer cómo están guardados por
                    detrás.
                  </p>
                  <nav
                    className="flex w-full min-w-0 max-w-full flex-wrap gap-1 rounded-xl border border-gray-200/90 bg-[#fafaf9] p-1 shadow-sm"
                    aria-label="Gestión de alumnos y cursos"
                  >
                      {(
                        [
                          { id: "alumnos" as const, label: "Alumnos", Icon: Users },
                          { id: "cursos" as const, label: "Cursos y divisiones", Icon: GraduationCap },
                          { id: "importaciones" as const, label: "Importaciones", Icon: Upload },
                        ] as const
                      ).map((t) => {
                        const active = academicSubTab === t.id;
                        const Icon = t.Icon;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAcademicSubTab(t.id)}
                            className={`inline-flex min-h-[2.375rem] min-w-[6.5rem] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                              active
                                ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#c27b3d]/35"
                                : "text-gray-600 hover:bg-white/80 hover:text-gray-900"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            {t.label}
                          </button>
                    );
                  })}
                  </nav>

                  {academicSubTab === "alumnos" && (
                    <Card className="rounded-2xl border border-[#ebe8e4] p-6 md:p-8 shadow-sm">
                      <h2 className="text-lg font-semibold tracking-tight text-gray-900">Alumnos de la escuela</h2>
                      <p className="mt-2 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                        Administrá el listado general de alumnos utilizado en los álbumes escolares. Esta vista consolida
                        lo que cargaste en la institución y en cada sesión: si un alumno aparece más de una vez, suele ser
                        porque participa en más de un proyecto.
                      </p>
                      <div className="mt-5 flex w-full max-w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0 gap-2"
                          onClick={() => setAcademicSubTab("importaciones")}
                        >
                          <Upload className="h-4 w-4" aria-hidden />
                          Importar listado
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled
                          className="cursor-not-allowed gap-2 opacity-70"
                          title="Por ahora, sumá alumnos desde la importación o desde cada sesión fotográfica (álbum)."
                        >
                          <UserPlus className="h-4 w-4" aria-hidden />
                          Agregar alumno
                        </Button>
                        <div className="min-w-[12rem] max-w-md flex-1">
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                              aria-hidden
                            />
                            <Input
                              className="!pl-10"
                              placeholder="Buscar alumno (nombre, DNI o matrícula)"
                              value={studentListQuery}
                              onChange={(e) => setStudentListQuery(e.target.value)}
                              aria-label="Buscar en el listado de alumnos"
                            />
                          </div>
                        </div>
                      </div>
                      {schoolRosterError ? (
                        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {schoolRosterError}
                        </p>
                      ) : null}
                      {schoolRosterTruncated ? (
                        <p className="mt-4 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-amber-900">
                          Se muestra una parte del listado (límite de carga desde el servidor). Para ver cada caso con
                          detalle fotográfico, abrí la sesión correspondiente desde Álbumes.
                        </p>
                      ) : null}
                      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
                        <table className="min-w-[920px] w-full divide-y divide-gray-100 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Apellido y nombre
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Matrícula
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                DNI
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Nivel
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Curso
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                División
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Turno
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Año lectivo
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Usado en
                              </th>
                              <th className="min-w-[9rem] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Estado
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {schoolRosterLoading ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-5 text-gray-600">
                                  Cargando alumnos…
                                </td>
                              </tr>
                            ) : schoolRosterRows.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-5 text-gray-600">
                                  Todavía no hay alumnos cargados para esta escuela. Importá un listado (pestaña
                                  Importaciones) o sumalos desde una sesión ya vinculada.
                                </td>
                              </tr>
                            ) : filteredSchoolRosterRows.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-5 text-gray-600">
                                  No hay coincidencias con la búsqueda. Probá con otro nombre, DNI o matrícula.
                                </td>
                              </tr>
                            ) : (
                              filteredSchoolRosterRows.map((row) => {
                                const dniNorm = row.student.dni?.trim().toUpperCase() ?? "";
                                const dupDni = Boolean(dniNorm && duplicateNormalizedDnis.has(dniNorm));
                                const sinMat = !row.student.externalStudentId?.trim();
                                const nAlbums = albumCountByStudentId.get(row.studentId) ?? 1;
                                return (
                                  <tr key={row.id} className="hover:bg-gray-50/60">
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                                      {row.snapshotLastName}, {row.snapshotFirstName}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {row.student.externalStudentId?.trim() || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{row.student.dni?.trim() || "—"}</td>
                                    <td className="px-4 py-3 text-gray-700">{row.level || "—"}</td>
                                    <td className="px-4 py-3 text-gray-700">{row.courseName || "—"}</td>
                                    <td className="px-4 py-3 text-gray-700">{row.division || "—"}</td>
                                    <td className="px-4 py-3 text-gray-700">{row.shift || "—"}</td>
                                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                                      {formatLectiveYearLabel(row.album.eventDate)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-800 tabular-nums">
                                      {formatAlbumUsageCount(nAlbums)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex max-w-[14rem] flex-wrap gap-1.5">
                                        {row.isActive ? (
                                          <InstitutionBadge tone="active">Activo</InstitutionBadge>
                                        ) : (
                                          <InstitutionBadge tone="warning">Pendiente</InstitutionBadge>
                                        )}
                                        {sinMat ? (
                                          <InstitutionBadge tone="warning">Sin matrícula</InstitutionBadge>
                                        ) : null}
                                        {dupDni ? (
                                          <InstitutionBadge tone="warning">Duplicado posible</InstitutionBadge>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {academicSubTab === "cursos" && (
                    <DsTabPanel density="relaxed">
                      <div className="w-full min-w-0 max-w-[var(--ds-readable-wide)] space-y-4">
                        <div className="flex w-full min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-900 ring-1 ring-amber-200/70">
                            <Building2 className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                              Gestión de cursos y divisiones
                            </h2>
                            <p className="mt-1 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                              Acá organizás los cursos de la escuela para que foto, escuela y familias hablen el mismo idioma.
                            </p>
                          </div>
                        </div>
                        <div className="w-full min-w-0 max-w-full space-y-2 border-l-2 border-amber-200/80 pl-4">
                          <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-700">
                            Organizá los cursos y divisiones que utiliza esta escuela.
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-gray-800">
                            Estos cursos podrán utilizarse en:
                          </p>
                          <ul className="w-full min-w-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-600 marker:text-gray-400">
                            <li>álbumes escolares</li>
                            <li>preventa</li>
                            <li>búsqueda de alumnos</li>
                            <li>organización de pedidos</li>
                          </ul>
                        </div>
                      </div>

                      <Card className="rounded-3xl border border-[#ebe8e4] bg-gradient-to-br from-[#fdfbf9] to-white p-6 shadow-sm md:p-10">
                        {courseDefinitionRows.length === 0 &&
                        aggregatedCourseSlots.length === 0 &&
                        !showNewCourse ? (
                          <DsEmptyState
                            title="No hay cursos configurados todavía."
                            className="items-center rounded-2xl border border-dashed border-stone-200/90 bg-white/70 px-6 py-10 text-center md:py-14"
                          >
                            <div className="mx-auto mb-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                              <GraduationCap className="h-7 w-7" aria-hidden />
                            </div>
                            <p className="mx-auto mb-8 w-full min-w-0 max-w-xl px-1 text-center text-sm leading-relaxed text-gray-600 ds-readable-text ds-readable-text--fluid">
                              Cuando cargues una planilla de alumnos o crees una división desde acá vas a ver el mapa escolar ordenado como en el aula y el colegio.
                            </p>
                            <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                              <Button
                                variant="secondary"
                                className="inline-flex items-center gap-2"
                                onClick={() => setAcademicSubTab("importaciones")}
                              >
                                <Upload className="h-4 w-4 shrink-0" aria-hidden />
                                Importar alumnos
                              </Button>
                              <Button
                                variant="primary"
                                className="inline-flex items-center gap-2"
                                onClick={() => setShowNewCourse(true)}
                              >
                                <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
                                Crear curso manualmente
                              </Button>
                            </div>
                          </DsEmptyState>
                        ) : (
                          <div className="w-full min-w-0 space-y-12">
                            <section className="w-full min-w-0 space-y-4" aria-labelledby="mapa-institucional-heading">
                              <div className="flex w-full min-w-0 max-w-[var(--ds-readable-wide)] items-start gap-3">
                                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" aria-hidden />
                                <div className="min-w-0 flex-1 space-y-0">
                                  <h3
                                    id="mapa-institucional-heading"
                                    className="text-base font-semibold text-gray-900"
                                  >
                                    Mapa desde tus listados
                                  </h3>
                                  <p className="mt-2 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                                    Así se ven los niveles y turnos de la institución cuando ya hay datos de alumnos.
                                    Pensalo como una acta ordenada antes de llegar al detalle.
                                  </p>
                                </div>
                              </div>
                              {aggregatedCourseSlots.length === 0 ? (
                                <p className="w-full min-w-0 max-w-[var(--ds-readable-wide)] rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-4 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-sky-950">
                                  Cuando proceses tu primera planilla vas a encontrar cada nivel tipo{" "}
                                  <span className="font-medium text-sky-900">Primaria</span>, cada turno y cada curso
                                  con la cantidad de alumnos junto al nombre.
                                </p>
                              ) : (
                                <div className="space-y-6">
                                  {institutionCourseTree.map((lvl) => (
                                    <div
                                      key={lvl.levelKey}
                                      className="rounded-2xl border border-[#e8e4df] bg-white/85 p-5 shadow-inner shadow-stone-100/40"
                                    >
                                      <p className="text-sm font-semibold text-gray-900">{lvl.levelLabel}</p>
                                      <div className="mt-4 space-y-5 border-l-2 border-amber-200/80 pl-4">
                                        {lvl.shifts.map((sh) => (
                                          <div key={`${lvl.levelKey}-${sh.shiftKey}`} className="space-y-2">
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                              {sh.shiftLabel}
                                            </p>
                                            <ul className="space-y-2 border-l border-dashed border-gray-300/90 pl-4">
                                              {sh.items.map((it, idx) => (
                                                <li
                                                  key={`${lvl.levelKey}-${sh.shiftKey}-${idx}-${it.courseName}-${it.division}`}
                                                  className="flex flex-wrap items-center gap-2 text-sm text-gray-800"
                                                >
                                                  <span className="font-medium text-gray-900">
                                                    {`${it.courseName}${it.division?.trim() ? ` ${it.division.trim()}` : ""}`}
                                                  </span>
                                                  <span className="tabular-nums text-gray-600">
                                                    ({it.studentCount} alumno
                                                    {it.studentCount !== 1 ? "s" : ""})
                                                  </span>
                                                  <CourseManagementBadge tone="automatic">
                                                    Automático
                                                  </CourseManagementBadge>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>

                            <section
                              className="w-full min-w-0 border-t border-[#ebe8e4] pt-10"
                              aria-labelledby="catalogo-cursos-heading"
                            >
                              <div className="flex w-full min-w-0 max-w-[var(--ds-readable-wide)] items-start gap-3">
                                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <h3 id="catalogo-cursos-heading" className="text-base font-semibold text-gray-900">
                                    Cursos y divisiones
                                  </h3>
                                  <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                                    Son los cursos que registrás vos para la institución. Los usamos para unificar etiquetas
                                    cuando la escuela cargá pedidos u ofertas relacionadas al aula en la foto.
                                  </p>
                                </div>
                              </div>
                              {courseDefinitionRows.length === 0 ? (
                                <p className="mt-4 w-full min-w-0 max-w-[var(--ds-readable-wide)] ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                                  Todavía no hay cursos creados a mano. Podés cargar uno nuevo en la siguiente tarjeta o
                                  dejarlos surgir cuando importás alumnos.
                                </p>
                              ) : (
                                <div className="mt-8 space-y-4">
                                  {courseDefinitionRows.map(({ course: c, uniqueStudentsInRoster }) => {
                                    const aggregatedMatch = aggregatedCourseSlots.some(
                                      (row) =>
                                        row.courseName.trim() === c.name.trim() &&
                                        (row.division || "").trim() === (c.division || "").trim()
                                    );
                                    const albumTitlesForCourse =
                                      albumTitlesBySchoolCourseId.get(c.id) ?? [];
                                    const enUso =
                                      uniqueStudentsInRoster > 0 || albumTitlesForCourse.length > 0;

                                    return (
                                      <div
                                        key={c.id}
                                        className="flex flex-col gap-4 rounded-2xl border border-[#e8e4df] bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                                      >
                                        <div className="min-w-0 flex-1 space-y-2">
                                          <p className="text-base font-semibold text-gray-900">
                                            {`${c.name.trim()}${(c.division || "").trim() ? ` · Div. ${(c.division || "").trim()}` : ""}`}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm tabular-nums text-gray-600">
                                              {uniqueStudentsInRoster} alumno
                                              {uniqueStudentsInRoster !== 1 ? "s" : ""}
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                              {aggregatedMatch ? (
                                                <CourseManagementBadge tone="automatic">
                                                  Automático
                                                </CourseManagementBadge>
                                              ) : (
                                                <CourseManagementBadge tone="manual">Manual</CourseManagementBadge>
                                              )}
                                              {enUso ? (
                                                <CourseManagementBadge tone="inUse">En uso</CourseManagementBadge>
                                              ) : (
                                                <CourseManagementBadge tone="empty">
                                                  Sin alumnos
                                                </CourseManagementBadge>
                                              )}
                                            </div>
                                          </div>
                                          {albumTitlesForCourse.length > 0 ? (
                                            <div className="rounded-xl bg-[#faf8f6] px-3 py-2 text-sm text-gray-700">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Usado en
                                              </p>
                                              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm leading-relaxed text-gray-800">
                                                {albumTitlesForCourse.map((t) => (
                                                  <li key={t}>{t}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="shrink-0 sm:ml-4 sm:text-right">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteCourse(c.id)}
                                            className="text-sm font-medium text-red-600 underline-offset-4 hover:text-red-800 hover:underline"
                                          >
                                            Eliminar curso
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </section>
                          </div>
                        )}
                      </Card>

                      <Card className="rounded-3xl border border-[#ebe8e4] bg-white p-6 shadow-sm md:p-8">
                        <div className="w-full min-w-0 max-w-[var(--ds-readable-wide)] space-y-2">
                          <h2 className="text-lg font-semibold tracking-tight text-gray-900">Cursos y divisiones</h2>
                          <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                            Creá rápidamente un curso institucional que todavía no apareció en tus listados o que querés tener
                            reservado con otro nombre.
                          </p>
                        </div>
                        {showNewCourse ? (
                          <div className="mt-6 flex w-full min-w-0 max-w-full flex-wrap items-end gap-3 rounded-2xl border border-stone-200/70 bg-[#faf8f6] p-5">
                            <div className="min-w-[10rem] flex-1">
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Curso (ej. 1°, Sala 5)
                              </label>
                              <Input
                                value={newCourseName}
                                onChange={(e) => setNewCourseName(e.target.value)}
                                placeholder="1º"
                              />
                            </div>
                            <div className="min-w-[8rem] flex-1">
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                División (ej. A, B)
                              </label>
                              <Input
                                value={newCourseDivision}
                                onChange={(e) => setNewCourseDivision(e.target.value)}
                                placeholder="A"
                              />
                            </div>
                            <Button
                              variant="primary"
                              onClick={handleAddCourse}
                              disabled={savingCourse || !newCourseName.trim()}
                            >
                              {savingCourse ? "Guardando…" : "Guardar curso"}
                            </Button>
                            <Button variant="secondary" onClick={() => setShowNewCourse(false)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-6 w-full min-w-0 space-y-3">
                            <Button variant="secondary" onClick={() => setShowNewCourse(true)}>
                              Crear curso manualmente
                            </Button>
                            <p className="w-full min-w-0 max-w-[var(--ds-readable-wide)] ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-500">
                              Los cursos también pueden generarse automáticamente al importar alumnos.
                            </p>
                          </div>
                        )}
                      </Card>
                    </DsTabPanel>
                  )}

                  {academicSubTab === "importaciones" && (
                    <div className="w-full min-w-0 space-y-4">
                      <div className="w-full min-w-0 space-y-2">
                        <h2 className="text-lg font-semibold tracking-tight text-gray-900">Historial de importaciones</h2>
                        <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                          Subí listados para actualizar alumnos de la escuela. El resumen detallado de la última carga
                          aparece al final de esta tarjeta una vez que finalice el proceso.
                        </p>
                      </div>
                    <Card className="w-full min-w-0 max-w-full rounded-2xl border border-[#ebe8e4] p-6 md:p-8 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                          <Upload className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <h2 className="text-lg font-semibold text-gray-900">Importar listado (CSV / Excel)</h2>
                          <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600">
                            El archivo se aplica a <strong className="font-medium text-gray-800">toda la escuela</strong>
                            . Elegís en qué sesión fotográfica querés completar la carga para que las familias lo vean
                            correctamente en su experiencia de compra.
                          </p>
                          <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid text-xs leading-relaxed rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-3 text-sky-950">
                            Si elegís una sesión concreta, los alumnos importados{" "}
                            <strong className="font-semibold">también quedan asociados a ese proyecto</strong> además de
                            sumarse al listado general de la institución.
                          </p>
                          <p className="w-full min-w-0 ds-readable-text ds-readable-text--fluid text-xs leading-relaxed text-gray-500">
                            Formatos admitidos: <strong className="font-medium text-gray-700">.csv</strong>,{" "}
                            <strong className="font-medium text-gray-700">.xlsx</strong> o pegar el CSV con encabezados.
                          </p>

                          <RosterImportChatGptTipPanel className="border-violet-200/80 bg-violet-50/40" />

                          {school.albums.length === 0 ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                              Primero tenés que{" "}
                              <button
                                type="button"
                                className="font-semibold text-amber-950 underline"
                                onClick={() => setActiveTab("albumes")}
                              >
                                vincular un álbum
                              </button>{" "}
                              para elegir en qué sesión se ejecuta esta importación.
                            </p>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                  Sesión fotográfica (álbum destino de la operación)
                                </label>
                                <select
                                  value={rosterImportAlbumId}
                                  onChange={(e) => setRosterImportAlbumId(e.target.value)}
                                  className="box-border w-full max-w-full min-w-0 rounded-xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                                >
                                  {school.albums.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.title}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                  Ciclo lectivo (opcional)
                                </label>
                                <select
                                  value={rosterImportAcademicYearId}
                                  onChange={(e) => setRosterImportAcademicYearId(e.target.value)}
                                  className="box-border w-full max-w-full min-w-0 rounded-xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                                >
                                  <option value="">Usar año lectivo actual de la escuela</option>
                                  {(school.academicYears ?? []).map((y) => (
                                    <option key={y.id} value={String(y.id)}>
                                      {y.label}
                                      {y.isCurrent ? " · actual" : ""}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-2 w-full min-w-0 max-w-full text-xs leading-relaxed text-gray-600">
                                  Si ningún año está marcado como actual en Datos/Escuela, podés elegir uno acá. La
                                  importación funciona igual, pero configurar bien el ciclo ayuda a evitar duplicados.
                                </p>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Archivo (.csv, .xlsx, .xls)
                                  </label>
                                  <input
                                    type="file"
                                    accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      setRosterImportFile(file);
                                      if (file) setRosterImportCsvText("");
                                    }}
                                    className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3f4f6] file:px-4 file:py-2.5 file:text-sm file:font-semibold"
                                  />
                                </div>
                                <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-xs text-gray-600">
                                  <p className="font-semibold text-gray-800">Ejemplo de encabezado y fila</p>
                                  <code className="mt-2 block whitespace-pre-wrap break-all font-mono text-[11px] text-gray-700">
                                    {ROSTER_CSV_HEADER_LINE}
                                  </code>
                                  <code className="mt-1 block whitespace-pre-wrap break-all font-mono text-[11px] text-gray-600">
                                    {ROSTER_CSV_EXAMPLE_ROW}
                                  </code>
                                </div>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                  Pegar CSV (con encabezados)
                                </label>
                                <Textarea
                                  value={rosterImportCsvText}
                                  onChange={(e) => {
                                    setRosterImportCsvText(e.target.value);
                                    if (e.target.value.trim()) setRosterImportFile(null);
                                  }}
                                  rows={6}
                                  placeholder={`${ROSTER_CSV_HEADER_LINE}\n${ROSTER_CSV_EXAMPLE_ROW}`}
                                  className="text-sm font-mono"
                                />
                              </div>

                              {rosterImportError ? (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  {rosterImportError}
                                </p>
                              ) : null}

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setRosterImportFile(null);
                                    setRosterImportCsvText("");
                                    setRosterImportError(null);
                                    setRosterImportSummary(null);
                                    setRosterImportAcademicYearId("");
                                  }}
                                >
                                  Limpiar
                                </Button>
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  disabled={
                                    rosterImportLoading ||
                                    !rosterImportAlbumId ||
                                    (!rosterImportFile && !rosterImportCsvText.trim())
                                  }
                                  onClick={() => void handleImportStudentRoster()}
                                >
                                  {rosterImportLoading ? "Importando…" : "Procesar importación"}
                                </Button>
                              </div>

                              {rosterImportSummary ? (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
                                  <p className="font-semibold">Último resultado de esta importación</p>
                                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-emerald-900">
                                    <li>Registros leídos en el archivo: {rosterImportSummary.total}</li>
                                    <li>Alumnos nuevos cargados: {rosterImportSummary.created}</li>
                                    <li>Coincidencias con alumnos existentes: {rosterImportSummary.matched}</li>
                                    <li>Fichas institucionales nuevas: {rosterImportSummary.enrollmentsCreated ?? 0}</li>
                                    <li>Fichas institucionales ya existentes: {rosterImportSummary.enrollmentsReused ?? 0}</li>
                                    <li>Asociaciones nuevas al álbum elegido: {rosterImportSummary.rosterLinksCreated ?? 0}</li>
                                    <li>Asociaciones que no se modificaron: {rosterImportSummary.rosterLinksExisting ?? 0}</li>
                                    <li>Datos de sesión actualizados: {rosterImportSummary.rosterLinksUpdated ?? 0}</li>
                                    <li>Registros omitidos: {rosterImportSummary.skipped}</li>
                                    <li>Omitidos por pedidos en curso: {rosterImportSummary.rosterSkippedDueToOrders ?? 0}</li>
                                    <li>Omitidos (cargados manualmente): {rosterImportSummary.rosterSkippedManual ?? 0}</li>
                                    <li>Avisos por DNI repetido: {rosterImportSummary.duplicateDniWarnings ?? 0}</li>
                                    <li>Errores de lectura: {rosterImportSummary.errors}</li>
                                  </ul>
                                  {rosterImportSummary.rowErrors.length > 0 ? (
                                    <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-red-800">
                                      {rosterImportSummary.rowErrors.map((row, i) => (
                                        <li key={`${row.rowNumber}-${i}`}>
                                          Fila {row.rowNumber}: {row.message}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                    </div>
                  )}
                </DsTabPanel>
              )}

              {activeTab === "albumes" && (
                <DsTabPanel>
                  <Card className="rounded-2xl border border-[#ebe8e4] bg-[#fdfbf9] p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Herencia desde la escuela</h3>
                    <p className="mt-2 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-700">
                      Los álbumes que vinculés a esta institución comparten la misma referencia interna de escuela. En las
                      próximas iteraciones se aplicarán acá valores por defecto de privacidad, comisión cooperadora, packs
                      recomendados y plantillas sugeridas, sin sobrescribir lo que ya configuraste en cada sesión.
                    </p>
                  </Card>
                  <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
                    <div className="mb-6 w-full min-w-0 space-y-2">
                      <h2 className="text-lg font-semibold text-gray-900">Álbumes de la institución</h2>
                      <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                        Abrí cada álbum para cargar fotos, preventa y operación. La creación de álbum nueva sigue en el panel
                        de álbumes; al vincularlo, adopta esta escuela como referencia institucional.
                      </p>
                    </div>
            {school.albums.length === 0 ? (
              <>
                <div className="mb-4 space-y-3">
                  <p className="text-gray-600 text-sm">
                    Todavía no hay un álbum vinculado a esta escuela.
                  </p>
                  <p className="text-gray-600 text-sm">
                    Primero tenés que crear el álbum en la sección Álbumes y después volver acá para vincularlo.
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Link
                      href="/dashboard/albums"
                      className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                    >
                      Crear álbum (panel principal)
                    </Link>
                    {!showLinkAlbum && (
                      <Button variant="secondary" onClick={() => setShowLinkAlbum(true)}>
                        + Vincular álbum existente
                      </Button>
                    )}
                  </div>
                </div>
                {showLinkAlbum ? (
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="min-w-[200px]">
                      <label className="block text-xs text-gray-600 mb-1">Seleccionar álbum</label>
                      <select
                        value={selectedAlbumId ?? ""}
                        onChange={(e) => setSelectedAlbumId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg"
                      >
                        <option value="">-- Elegir --</option>
                        {albumsOptions
                          .filter((opt) => !school.albums.some((a) => a.id === opt.id))
                          .map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleLinkAlbum}
                      disabled={linking || !selectedAlbumId}
                    >
                      {linking ? "..." : "Vincular"}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowLinkAlbum(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : null}
                <p className="text-sm text-gray-500 mt-4">
                  La preventa se configura en el álbum: fecha de cierre y packs (pestaña Pre-venta).
                </p>
              </>
            ) : (
              <>
                <ul className="space-y-3 mb-4">
                  {school.albums.map((a) => (
                    <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Link href={`/dashboard/albums/${a.id}`} className="font-medium text-[#c27b3d] hover:underline inline-flex flex-wrap items-center gap-2 text-base">
                          {a.title}
                          {a.isTest ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                              TEST
                            </span>
                          ) : null}
                        </Link>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>Año lectivo: {formatLectiveYearLabel(a.eventDate)}</span>
                          <span>Fotos: {a.photoCount ?? 0}</span>
                          <span>Cursos combinados cargados: {a.rosterCourseSlotCount ?? 0}</span>
                          <span>Preventa: {preventaEstadoLabel(a)}</span>
                          <span>Estado público: {a.isPublic === false ? "Oculto" : "Visible"}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/dashboard/albums/${a.id}`}>
                          <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                            Abrir álbum
                          </Button>
                        </Link>
                        <Button variant="secondary" size="sm" onClick={() => copyPreventaLink(a)} className="w-full sm:w-auto">
                          Copiar link preventa
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleUnlinkAlbum(a.id)}
                          className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Desvincular
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-gray-600 text-sm mb-4">
                  Por ahora esta escuela solo puede tener un álbum vinculado.
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  Para crear un álbum nuevo, andá a{" "}
                  <Link href="/dashboard/albums" className="text-[#c27b3d] hover:underline">
                    Álbumes
                  </Link>
                  , crealo y vinculalo acá. La preventa se configura en el álbum: fecha de cierre y packs (pestaña Pre-venta).
                </p>
              </>
            )}
          </Card>
                </DsTabPanel>
              )}

              {activeTab === "plantillas" && (
                <DsTabPanel>
                  <div className="w-full min-w-0 max-w-full space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">Plantillas institucionales (V2)</h2>
                    <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                      Asociamos la escuela a plantillas recomendadas y branding coherente. Solo se listan diseños{" "}
                      <strong className="font-medium text-gray-800">del editor nuevo (V2)</strong>; los formatos legacy
                      no aparecen acá por decisión de producto.
                    </p>
                    <p className="ds-readable-text ds-readable-text--fluid text-xs leading-relaxed text-gray-500">
                      Próxima fase: marcar una plantilla como &quot;institucional&quot; por escuela (hoy pueden ser del
                      sistema o personalizadas tuyas). Los botones siguen usando las mismas APIs que el panel Diseños —
                      sin tocar Mercado Pago ni checkout.
                    </p>
                    <div>
                      <Link
                        href="/dashboard/designs"
                        className="text-sm font-medium text-[#c27b3d] hover:underline"
                      >
                        Abrir panel completo de diseños →
                      </Link>
                    </div>
                  </div>
                  {designMessage ? (
                    <Card className="border border-[#e5e7eb] p-4">
                      <p className="text-sm text-[#374151]">{designMessage}</p>
                    </Card>
                  ) : null}
                  {designTemplatesError ? (
                    <p className="text-sm text-red-600">{designTemplatesError}</p>
                  ) : null}
                  {designTemplatesLoading ? (
                    <p className="text-sm text-gray-600">Cargando plantillas…</p>
                  ) : (
                    <>
                      <section aria-labelledby="tpl-system-heading" className="space-y-4">
                        <h3 id="tpl-system-heading" className="text-base font-semibold text-gray-900">
                          Plantillas del sistema
                        </h3>
                        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                          {designSystemTemplates.map((t) => {
                            const b = templateSchoolBadge(t);
                            const editHref = templateEditorHref(t.id, t.currentVersionId);
                            return (
                              <Card key={`sys-${t.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#ebe8e4] p-4 shadow-sm">
                                <SchoolTemplateThumb thumbnailUrl={t.thumbnailUrl} preview={t.preview} name={t.name} />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.className}`}>
                                    {b.label}
                                  </span>
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 ring-1 ring-amber-200/80">
                                    Institucional (pronto)
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">{t.name}</p>
                                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    type="button"
                                    disabled={designBusyCloneId === t.id}
                                    onClick={() => void designCloneCatalog(t.id)}
                                  >
                                    {designBusyCloneId === t.id ? "Clonando…" : "Usar plantilla del sistema"}
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                        {designSystemTemplates.length === 0 ? (
                          <p className="text-sm text-gray-600">
                            No hay plantillas del sistema listadas para tu cuenta (revisión de Diseños o políticas de publicación).
                          </p>
                        ) : null}
                      </section>

                      <section aria-labelledby="tpl-user-heading" className="space-y-4 pt-4">
                        <h3 id="tpl-user-heading" className="text-base font-semibold text-gray-900">
                          Tus plantillas personalizadas
                        </h3>
                        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                          {designUserTemplates.map((t) => {
                            const b = templateSchoolBadge(t);
                            const editHref = templateEditorHref(t.id, t.currentVersionId);
                            return (
                              <Card key={`mine-${t.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#ebe8e4] p-4 shadow-sm">
                                <SchoolTemplateThumb thumbnailUrl={t.thumbnailUrl} preview={t.preview} name={t.name} />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.className}`}>
                                    {b.label}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">{t.name}</p>
                                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                                  {editHref ? (
                                    <Link href={editHref} className="inline-flex">
                                      <Button variant="secondary" size="sm" type="button">
                                        Editar
                                      </Button>
                                    </Link>
                                  ) : null}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    disabled={designBusyCloneId === t.id}
                                    onClick={() => void designDuplicateOwn(t.id)}
                                  >
                                    Clonar como institucional
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    className="!text-red-700"
                                    disabled={designBusyDeleteId === t.id}
                                    onClick={() => void designDelete(t.id, t.name)}
                                  >
                                    {designBusyDeleteId === t.id ? "Eliminando…" : "Eliminar"}
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                        {designUserTemplates.length === 0 ? (
                          <p className="text-sm text-gray-600">Todavía no creaste diseños propios desde el editor V2.</p>
                        ) : null}
                      </section>
                    </>
                  )}
                </DsTabPanel>
              )}

              {activeTab === "comisiones_ventas" && (
                <DsTabPanel>
                  <div className="ds-split-panel items-start gap-6 border-b border-[#ebe8e4] pb-8">
                    <div className="ds-split-panel__main min-w-0 space-y-3">
                      <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                        Comisiones y ventas escolares
                      </h2>
                      <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-gray-600">
                        Administrá cómo se calculan y registran las comisiones de esta escuela.
                      </p>
                    </div>
                  </div>

                  {commissionError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {commissionError}
                    </p>
                  ) : null}

                  {commissionsLoading ? (
                    <p className="text-sm text-gray-500">Cargando información comercial…</p>
                  ) : null}

                  {!commissionsLoading && commissions.length === 0 ? (
                    <DsEmptyState
                      title="Todavía no hay ventas registradas para esta escuela."
                      className="rounded-2xl border border-dashed border-stone-200/90 bg-white px-6 py-12 text-center"
                    >
                      <Button
                        type="button"
                        variant="primary"
                        className="mt-6 inline-flex items-center gap-2"
                        onClick={() => setActiveTab("albumes")}
                      >
                        <Images className="h-4 w-4" aria-hidden />
                        Ver álbumes escolares
                      </Button>
                    </DsEmptyState>
                  ) : null}

                  {!commissionsLoading && commissions.length > 0 ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Card className="rounded-3xl border border-[#ebe8e4] bg-gradient-to-br from-white to-[#fdfbf9] p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Total vendido
                              </p>
                              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900">
                                {formatArsWhole(commissionedSalesTotal)}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                Ventas vinculadas a comisiones registradas.
                              </p>
                            </div>
                            <Wallet className="h-9 w-9 shrink-0 text-amber-800/80" aria-hidden />
                          </div>
                        </Card>
                        <Card className="rounded-3xl border border-[#ebe8e4] bg-gradient-to-br from-white to-[#fdfbf9] p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Comisión pendiente
                              </p>
                              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900">
                                {formatArsWhole(commissionSummary.pendiente)}
                              </p>
                              {commissionSummary.solicitado > 0 ? (
                                <p className="mt-2 text-xs text-gray-500">
                                  Gestión solicitada: {formatArsWhole(commissionSummary.solicitado)}
                                </p>
                              ) : (
                                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                  Saldo a liquidar a la institución.
                                </p>
                              )}
                            </div>
                            <PieChart className="h-9 w-9 shrink-0 text-sky-800/80" aria-hidden />
                          </div>
                        </Card>
                        <Card className="rounded-3xl border border-[#ebe8e4] bg-gradient-to-br from-white to-[#fdfbf9] p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Comisión pagada
                              </p>
                              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900">
                                {formatArsWhole(commissionSummary.pagado)}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                Montos ya liquidados o abonados.
                              </p>
                            </div>
                            <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-700/85" aria-hidden />
                          </div>
                        </Card>
                        <Card className="rounded-3xl border border-[#ebe8e4] bg-gradient-to-br from-white to-[#fdfbf9] p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Álbumes activos
                              </p>
                              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900">
                                {school ? school.albums.filter((a) => !a.isTest).length : 0}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                Proyectos institucionales fuera de modo prueba.
                              </p>
                            </div>
                            <Images className="h-9 w-9 shrink-0 text-[#c27b3d]" aria-hidden />
                          </div>
                        </Card>
                      </div>

                      <Card className="rounded-3xl border border-[#ebe8e4] p-6 shadow-sm md:p-8">
                        <h3 className="text-lg font-semibold text-gray-900">Comisión institucional</h3>
                        <p className="mt-2 max-w-[var(--ds-readable-wide)] ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-gray-600">
                          Definí el porcentaje de comisión acordado con la escuela desde la configuración de cada proyecto
                          (álbum escolar).
                        </p>
                        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                          <div className="w-full max-w-xs">
                            <label className="mb-1.5 block text-xs font-medium text-gray-600">
                              Porcentaje de referencia
                            </label>
                            <Input
                              readOnly
                              className="bg-[#fafaf9] text-base font-semibold"
                              value={
                                commissionAvgPctDisplay != null ? `${commissionAvgPctDisplay} %` : "Sin movimientos aún"
                              }
                            />
                            <p className="mt-2 text-xs leading-relaxed text-gray-500">
                              Promedio según los registros actuales. Para modificar el acuerdo, ajustá el valor en cada
                              proyecto desde su panel.
                            </p>
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setActiveTab("albumes")}>
                            Abrir proyectos vinculados
                          </Button>
                        </div>
                      </Card>

                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-gray-900">Estado de liquidaciones</h3>
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Pendiente</p>
                            <p className="mt-2 text-xl font-semibold tabular-nums text-amber-950">
                              {formatArsWhole(commissionSummary.pendiente)}
                            </p>
                            <p className="mt-1 text-xs text-amber-900/80">Comisiones sin liquidar.</p>
                          </Card>
                          <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Pagado</p>
                            <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-950">
                              {formatArsWhole(commissionSummary.pagado)}
                            </p>
                            <p className="mt-1 text-xs text-emerald-900/80">Liquidaciones completadas.</p>
                          </Card>
                          <Card className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Próximo pago</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {nextRequestedPaymentLabel ?? "A coordinar"}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {nextRequestedPaymentLabel
                                ? "Primer vencimiento entre solicitudes activas."
                                : "No hay solicitudes de cobro en curso."}
                            </p>
                          </Card>
                        </div>
                      </div>

                      <Card className="rounded-3xl border border-[#ebe8e4] p-0 shadow-sm">
                        <div className="border-b border-gray-100 px-6 py-5 md:px-8">
                          <h3 className="text-lg font-semibold text-gray-900">Álbumes asociados</h3>
                          <p className="mt-1 ds-readable-text ds-readable-text--fluid text-sm text-gray-600">
                            Ventas y comisión por proyecto vinculado a la escuela.
                          </p>
                        </div>
                        <div className="ds-table-scroll px-2 pb-2 md:px-0">
                          <table className="min-w-[720px] w-full divide-y divide-gray-100 text-sm md:min-w-0">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Álbum
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Ventas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Comisión generada
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Estado
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Acción
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {albumCommercialRows.map((row) => (
                                <tr key={row.albumId} className="hover:bg-gray-50/70">
                                  <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                                  <td className="px-4 py-3 tabular-nums text-gray-700">{formatArsWhole(row.sales)}</td>
                                  <td className="px-4 py-3 tabular-nums text-gray-700">
                                    {formatArsWhole(row.commission)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-800">
                                      {albumCommissionRollupLabel(row.statuses)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Link href={`/dashboard/albums/${row.albumId}`}>
                                      <Button type="button" variant="secondary" size="sm">
                                        Ver detalle
                                      </Button>
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      <Card className="rounded-3xl border border-[#ebe8e4] p-0 shadow-sm">
                        <div className="border-b border-gray-100 px-6 py-5 md:px-8">
                          <h3 className="text-lg font-semibold text-gray-900">Movimientos por pedido</h3>
                          <p className="mt-1 ds-readable-text ds-readable-text--fluid text-sm text-gray-600">
                            Detalle de cada registro. Cuando figure como solicitado, cargá la referencia de pago y marcá el
                            cobro como finalizado.
                          </p>
                        </div>
                        <div className="overflow-x-auto px-2 pb-4 md:px-0">
                          <table className="min-w-[920px] w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Fecha</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                                  Responsable
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Álbum</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                                  Comisión
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Estado</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">
                                  Cobro
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {commissions.map((commission) => (
                                <tr key={commission.id} className="hover:bg-gray-50/70">
                                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(commission.createdAt)}</td>
                                  <td className="px-3 py-3">
                                    {commission.organizerUser?.name ||
                                      commission.organizerUser?.email ||
                                      "Sin asignar"}
                                  </td>
                                  <td className="px-3 py-3 min-w-[10rem]">{commission.album.title}</td>
                                  <td className="px-3 py-3 tabular-nums">${commission.amount.toLocaleString("es-AR")}</td>
                                  <td className="px-3 py-3">
                                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">
                                      {commissionLineStatusLabel(commission.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    {commission.status === "REQUESTED" ? (
                                      <div className="ml-auto flex max-w-[14rem] flex-col items-end gap-2">
                                        <Input
                                          placeholder="Medio de pago"
                                          value={paymentMethodByCommission[commission.id] || ""}
                                          onChange={(event) =>
                                            setPaymentMethodByCommission((prev) => ({
                                              ...prev,
                                              [commission.id]: event.target.value,
                                            }))
                                          }
                                        />
                                        <Input
                                          placeholder="Comprobante o referencia"
                                          value={paymentProofByCommission[commission.id] || ""}
                                          onChange={(event) =>
                                            setPaymentProofByCommission((prev) => ({
                                              ...prev,
                                              [commission.id]: event.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => void handleMarkCommissionPaid(commission)}
                                          disabled={markingCommissionId === commission.id}
                                        >
                                          {markingCommissionId === commission.id
                                            ? "Guardando…"
                                            : "Marcar como pagado"}
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </>
                  ) : null}
                </DsTabPanel>
              )}

              {activeTab === "config_privacidad" && (
                <DsTabPanel>
                  <div className="w-full min-w-0 max-w-full">
                    <h2 className="text-lg font-semibold text-gray-900">Configuración y privacidad (defaults)</h2>
                    <p className="mt-2 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
                      Todos los álbumes nuevos de esta escuela usarán esta configuración por defecto cuando el backend
                      exponga estos campos a nivel institución. Hoy estos valores siguen viviendo en cada álbum; esta
                      pestaña comunica la intención de producto sin romper comportamiento legacy ni preventa activa.
                    </p>
                  </div>
                  <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">Privacidad de fotos y selfie</h3>
                    <ul className="w-full min-w-0 max-w-full list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
                      <li>defaults de selfies y fotos ocultas hasta validación,</li>
                      <li>público u oculto por defecto al crear álbum,</li>
                      <li>si se exige aprobación de cliente en preventa,</li>
                      <li>mensajes institucionales en flujos de compra cuando existan.</li>
                    </ul>
                  </Card>
                  <Card className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-6">
                    <p className="w-full min-w-0 max-w-full text-sm text-gray-600">
                      Migración recomendada: campos opcionales en <code className="text-xs">School</code> con shadowing en{" "}
                      <code className="text-xs">Album</code>, mismo patrón que herencia de configuración en otros módulos.
                    </p>
                  </Card>
                </DsTabPanel>
              )}
            </Tabs>
          </Card>
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
