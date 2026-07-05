"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/lab/helpers";
import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";
import { computePrintPricing } from "@/lib/pricing/print-pricing";
import { TERMS_VERSION, TERMS_TEXT } from "@/lib/terms/photographerTerms";
import type { LucideIcon } from "lucide-react";
import { Globe, GraduationCap, Image as ImageIcon, Lock, Trophy, User, Users } from "lucide-react";
import AlbumEventScheduleFields, {
  EMPTY_ALBUM_EVENT_SCHEDULE,
  displayLabelForAlbumEventSchedule,
  type AlbumEventScheduleValue,
} from "@/components/dashboard/albums/AlbumEventScheduleFields";
import {
  albumPrivacyFromWizardSecurityMode,
  type AlbumWizardSecurityMode,
} from "@/lib/albums/album-wizard-security";

const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch").then((m) => m.default),
  { ssr: false }
);

const AddressGeoSearch = dynamic(
  () => import("@/components/school/AddressGeoSearch").then((m) => m.default),
  { ssr: false }
);

/** Layout común de cada paso: flex column + gap DS + ancho seguro en modal flex */
const WIZARD_STEP_CARD_CLASS =
  "clf-wizard-card w-full min-w-0 rounded-2xl border border-[#ebe8e4] bg-white p-6 shadow-[0_8px_30px_-12px_rgba(26,26,26,0.08)]";

/** Alineado a `AlbumMode` en Prisma; se envía como `mode` en el POST desde este asistente. */
export type AlbumWizardType = "EVENT" | "SCHOOL" | "SIMPLE" | "COLLABORATIVE";

export type { AlbumWizardSecurityMode } from "@/lib/albums/album-wizard-security";

const DEFAULT_SECURITY_MODE: Record<AlbumWizardType, AlbumWizardSecurityMode> = {
  SIMPLE: "public",
  EVENT: "public",
  SCHOOL: "selfie",
  COLLABORATIVE: "public",
};

const SECURITY_MODE_CARDS: Array<{
  value: AlbumWizardSecurityMode;
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    value: "public",
    title: "🌐 Público",
    description: "Cualquier persona con el link puede ver todas las fotos",
    Icon: Globe,
  },
  {
    value: "private",
    title: "🔒 Privado",
    description: "Solo personas invitadas pueden acceder al álbum",
    Icon: Lock,
  },
  {
    value: "selfie",
    title: "🧑‍🦱 Privado con identificación",
    description:
      "Cada cliente verá únicamente sus fotos mediante identificación validada por reconocimiento facial; el sistema solo le mostrará sus fotos.",
    Icon: User,
  },
];

const TYPE_OPTIONS: Array<{
  value: AlbumWizardType;
  label: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    value: "EVENT",
    label: "Evento / deporte",
    Icon: Trophy,
    description:
      "Para carreras, maratones, shows, sociales o eventos donde vas a vender fotos después de subirlas.",
  },
  {
    value: "SCHOOL",
    label: "Escolar",
    Icon: GraduationCap,
    description:
      "Para escuelas, cursos, carpetas escolares, selección de fotos y futuros diseños.",
  },
  {
    value: "SIMPLE",
    label: "Álbum simple",
    Icon: ImageIcon,
    description: "Para vender fotos sueltas sin configuraciones avanzadas.",
  },
  {
    value: "COLLABORATIVE",
    label: "Evento colaborativo",
    Icon: Users,
    description:
      "Para eventos donde participan varios fotógrafos. La preventa no estará disponible en este modo.",
  },
];

const TYPE_DEFAULTS: Record<
  AlbumWizardType,
  { enableDigitalPhotos: boolean; enablePrintedPhotos: boolean; showComingSoonMessage: boolean }
> = {
  EVENT: { enableDigitalPhotos: false, enablePrintedPhotos: false, showComingSoonMessage: true },
  SCHOOL: { enableDigitalPhotos: false, enablePrintedPhotos: false, showComingSoonMessage: true },
  SIMPLE: { enableDigitalPhotos: false, enablePrintedPhotos: false, showComingSoonMessage: false },
  COLLABORATIVE: { enableDigitalPhotos: false, enablePrintedPhotos: false, showComingSoonMessage: true },
};

const STEP_3_GUIDANCE: Record<AlbumWizardType, string> = {
  EVENT:
    "En este tipo de álbum lo más común es vender fotos digitales después del evento.",
  SCHOOL:
    "En álbumes escolares podés preparar venta digital, productos impresos y luego sumar packs o preventa.",
  SIMPLE:
    "Este modo mantiene la configuración mínima para vender fotos sin opciones avanzadas.",
  COLLABORATIVE:
    "Los álbumes colaborativos se venden después de subir fotos. La preventa queda desactivada para evitar confusiones.",
};

/** Solo contenido editorial en el wizard; no se persisten valores ni packs. */
const RECOMMENDED_CONFIG_LINES: Record<AlbumWizardType, string[]> = {
  EVENT: [
    "Vender fotos digitales después del evento.",
    "Usar packs digitales de 5 o 10 fotos.",
    "Dejar productos impresos para una etapa posterior si no hay logística clara.",
  ],
  SCHOOL: [
    "Activar fotos digitales e impresas.",
    "Preparar carpetas escolares o packs con selección de fotos.",
    "Más adelante podés sumar preventa y plantillas de diseño.",
  ],
  SIMPLE: [
    "Empezar con venta de fotos digitales individuales.",
    "Evitar packs y preventa hasta tener el álbum funcionando.",
  ],
  COLLABORATIVE: [
    "Vender después de subir fotos.",
    "No usar preventa.",
    "Dejar que cada fotógrafo suba sus fotos al evento.",
  ],
};

const WIZARD_COMMISSION_PHASES: Array<{
  value: "PREVENTA" | "POST_EVENT" | "EXTRAS";
  label: string;
  hint: string;
}> = [
  ["PREVENTA", "Preventa", "Ventas antes de publicar fotos."],
  ["POST_EVENT", "Ventas posteriores", "Compras cuando el álbum ya está publicado."],
  ["EXTRAS", "Extras y canjes", "Selección extra o productos agregados al flujo escolar."],
].map(([value, label, hint]) => ({
  value: value as "PREVENTA" | "POST_EVENT" | "EXTRAS",
  label,
  hint,
}));

type EnrollmentCourseSlotsPayload = {
  academicYear: { id: number; label: string; isCurrent: boolean } | null;
  academicYears: Array<{ id: number; label: string; isCurrent: boolean }>;
  groups: Array<{
    level: string;
    shifts: Array<{
      shift: string;
      slots: Array<{ courseKey: string; courseName: string; division: string; label: string; count: number }>;
    }>;
  }>;
  totalEnrollments: number;
};

/** Mismo criterio que la validación del paso 3: entero en “pesos” (campo API `digitalPhotoPriceCents`). */
function parseWizardDigitalPriceWhole(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Math.round(parseFloat(trimmed.replace(",", ".")));
  return Number.isFinite(n) ? n : null;
}

/** Lee `id` numérico del JSON de éxito de POST /api/dashboard/albums ({ ...album }). */
function createdAlbumIdFromResponse(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { id?: unknown }).id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function buildAlbumCreateBody(params: {
  mode: AlbumWizardType;
  title: string;
  location: string;
  eventSchedule: AlbumEventScheduleValue;
  latitude: number | null;
  longitude: number | null;
  enableDigitalPhotos: boolean;
  enablePrintedPhotos: boolean;
  showComingSoonMessage: boolean;
  digitalPhotoPriceCents: number | null;
  printPricingSource: "PHOTOGRAPHER" | "LAB_PREFERRED";
  selectedLabId: number | null;
  pickupBy: "CLIENT" | "PHOTOGRAPHER";
  albumProfitMarginPercent: number | null;
  includeDigitalWithPrint: boolean;
  digitalWithPrintDiscountPercent: number;
  schoolId: number | null;
  academicYearId: number | null;
  selectedCourseKeys: string[];
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
  organizerCommissionAppliesTo: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
  termsAccepted: boolean;
  securityMode: AlbumWizardSecurityMode;
}): Record<string, unknown> {
  const privacy = albumPrivacyFromWizardSecurityMode(params.securityMode);

  const geo =
    params.latitude !== null &&
    params.longitude !== null &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude)
      ? { latitude: params.latitude, longitude: params.longitude }
      : {};

  return {
    mode: params.mode,
    title: params.title.trim(),
    location: params.location.trim() || null,
    eventDate: params.eventSchedule.eventDate.trim() || null,
    eventStartTime: params.eventSchedule.eventStartTime.trim() || null,
    eventEndTime: params.eventSchedule.eventEndTime.trim() || null,
    ...geo,
    digitalPhotoPriceCents: params.digitalPhotoPriceCents,
    selectedLabId: params.selectedLabId,
    printPricingSource: params.printPricingSource,
    albumProfitMarginPercent: params.albumProfitMarginPercent,
    pickupBy: params.pickupBy,
    enablePrintedPhotos: params.enablePrintedPhotos,
    enableDigitalPhotos: params.enableDigitalPhotos,
    includeDigitalWithPrint: params.includeDigitalWithPrint,
    digitalWithPrintDiscountPercent: params.includeDigitalWithPrint ? params.digitalWithPrintDiscountPercent : 0,
    allowClientLabSelection: false,
    showComingSoonMessage: params.showComingSoonMessage,
    isPublic: privacy.isPublic,
    hiddenPhotosEnabled: privacy.hiddenPhotosEnabled,
    hiddenSelfieRetentionDays: null,
    termsAccepted: params.termsAccepted === true,
    digitalDiscount5Plus: null,
    digitalDiscount10Plus: null,
    digitalDiscount20Plus: null,
    ...(params.mode === "SCHOOL" && params.schoolId != null ? { schoolId: params.schoolId } : {}),
    ...(params.mode === "SCHOOL" && params.schoolId != null && params.academicYearId != null
      ? { academicYearId: params.academicYearId }
      : {}),
    ...(params.mode === "SCHOOL" && params.schoolId != null && params.selectedCourseKeys.length > 0
      ? { selectedCourseKeys: params.selectedCourseKeys }
      : {}),
    ...(params.mode === "SCHOOL"
      ? {
          organizerCommissionEnabled: params.organizerCommissionEnabled,
          organizerCommissionPercentage:
            params.organizerCommissionEnabled ? params.organizerCommissionPercentage : null,
          organizerCommissionAppliesTo:
            params.organizerCommissionEnabled && params.organizerCommissionAppliesTo.length > 0
              ? params.organizerCommissionAppliesTo
              : ["PREVENTA"],
        }
      : {}),
  };
}

export type AlbumWizardProps = {
  /** En modal flotante se oculta el enlace “Volver a álbumes” (el cierre lo maneja el marco). */
  variant?: "page" | "floating";
};

export default function AlbumWizard({ variant = "page" }: AlbumWizardProps) {
  const floating = variant === "floating";
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [albumType, setAlbumType] = useState<AlbumWizardType>("SIMPLE");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [eventSchedule, setEventSchedule] = useState<AlbumEventScheduleValue>(EMPTY_ALBUM_EVENT_SCHEDULE);
  const [enableDigitalPhotos, setEnableDigitalPhotos] = useState(
    TYPE_DEFAULTS.SIMPLE.enableDigitalPhotos
  );
  const [enablePrintedPhotos, setEnablePrintedPhotos] = useState(
    TYPE_DEFAULTS.SIMPLE.enablePrintedPhotos
  );
  const [showComingSoonMessage, setShowComingSoonMessage] = useState(
    TYPE_DEFAULTS.SIMPLE.showComingSoonMessage
  );
  const [digitalPhotoPrice, setDigitalPhotoPrice] = useState("");
  const [minDigitalPhotoPrice, setMinDigitalPhotoPrice] = useState(5000);
  /** Comisión efectiva (misma regla que checkout: override cuenta → laboratorio preferido → app). */
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState<number | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAlbumIdHint, setCreatedAlbumIdHint] = useState<number | null>(null);

  const isSchoolFlow = albumType === "SCHOOL";
  const stepLabels = useMemo(
    () =>
      isSchoolFlow
        ? [
            "Tipo",
            "Datos",
            "Ventas digitales",
            "Impresiones",
            "Escuela",
            "Cursos y alumnos",
            "Seguridad y privacidad",
            "Listo",
          ]
        : ["Tipo", "Datos", "Ventas digitales", "Impresiones", "Seguridad y privacidad", "Listo"],
    [isSchoolFlow]
  );
  /** Penúltimo paso (después de impresiones o escuela, antes del resumen). */
  const securityStep = isSchoolFlow ? 7 : 5;
  const reviewStep = isSchoolFlow ? 8 : 6;
  const schoolCoursesStep = 6;

  const [printPricingSource, setPrintPricingSource] = useState<"PHOTOGRAPHER" | "LAB_PREFERRED">(
    "PHOTOGRAPHER"
  );
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [pickupBy, setPickupBy] = useState<"CLIENT" | "PHOTOGRAPHER">("CLIENT");
  const [albumProfitMarginPercent, setAlbumProfitMarginPercent] = useState("");
  const [includeDigitalWithPrint, setIncludeDigitalWithPrint] = useState(false);
  const [digitalWithPrintDiscountPercent, setDigitalWithPrintDiscountPercent] = useState("");
  const [labs, setLabs] = useState<Array<{ id: number; name: string; city?: string | null; province?: string | null }>>(
    []
  );
  const [labSearch, setLabSearch] = useState("");
  const [showLabDropdown, setShowLabDropdown] = useState(false);
  const [photographerProductsCount, setPhotographerProductsCount] = useState<number | null>(null);
  const [printPlatformFeePct, setPrintPlatformFeePct] = useState<number | null>(null);
  /** Precio base de ejemplo (ARS) para simulador de impresiones en el paso Impresiones. */
  const [printSimulatorExampleBase, setPrintSimulatorExampleBase] = useState("3000");
  const [preferredLabId, setPreferredLabId] = useState<number | null>(null);
  const [schools, setSchools] = useState<Array<{ id: number; name: string; albumsCount: number }>>([]);
  const [wizardSchoolId, setWizardSchoolId] = useState("");
  const [wizardAcademicYearId, setWizardAcademicYearId] = useState("");
  const [selectedCourseKeys, setSelectedCourseKeys] = useState<Set<string>>(() => new Set());
  const [enrollmentSlotsPayload, setEnrollmentSlotsPayload] = useState<EnrollmentCourseSlotsPayload | null>(null);
  const [enrollmentSlotsLoading, setEnrollmentSlotsLoading] = useState(false);
  const [enrollmentSlotsError, setEnrollmentSlotsError] = useState<string | null>(null);
  const [organizerCommissionEnabled, setOrganizerCommissionEnabled] = useState(false);
  const [organizerCommissionPct, setOrganizerCommissionPct] = useState("");
  const [organizerAppliesTo, setOrganizerAppliesTo] = useState<Set<"PREVENTA" | "POST_EVENT" | "EXTRAS">>(
    () => new Set(["PREVENTA"])
  );
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsTextOpen, setTermsTextOpen] = useState(false);
  const [securityMode, setSecurityMode] = useState<AlbumWizardSecurityMode>(() => DEFAULT_SECURITY_MODE.SIMPLE);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [inviteEmailDraft, setInviteEmailDraft] = useState("");

  const [schoolLinkMode, setSchoolLinkMode] = useState<"select" | "create">("select");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolContactEmail, setNewSchoolContactEmail] = useState("");
  const [newSchoolContactPhone, setNewSchoolContactPhone] = useState("");
  const [newSchoolNotes, setNewSchoolNotes] = useState("");
  const [newSchoolAddress, setNewSchoolAddress] = useState("");
  const [newSchoolCity, setNewSchoolCity] = useState("");
  const [newSchoolProvince, setNewSchoolProvince] = useState("");
  const [newSchoolCountry, setNewSchoolCountry] = useState("");
  const [newSchoolLatitude, setNewSchoolLatitude] = useState<number | null>(null);
  const [newSchoolLongitude, setNewSchoolLongitude] = useState<number | null>(null);
  const [newSchoolLogoUrl, setNewSchoolLogoUrl] = useState<string | null>(null);
  const [newSchoolLogoUploading, setNewSchoolLogoUploading] = useState(false);
  const [creatingSchoolInline, setCreatingSchoolInline] = useState(false);
  const [schoolInlineMessage, setSchoolInlineMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const newSchoolLogoInputRef = useRef<HTMLInputElement>(null);

  const hasPrintProducts = (photographerProductsCount ?? 0) > 0;

  useEffect(() => {
    setWizardAcademicYearId("");
    setSelectedCourseKeys(new Set());
    setEnrollmentSlotsPayload(null);
    setEnrollmentSlotsError(null);
  }, [wizardSchoolId]);

  useEffect(() => {
    if (step !== schoolCoursesStep || !isSchoolFlow) return;
    const sid = parseInt(wizardSchoolId, 10);
    if (!Number.isFinite(sid) || sid <= 0) return;
    let cancelled = false;
    setEnrollmentSlotsLoading(true);
    setEnrollmentSlotsError(null);
    const qs =
      wizardAcademicYearId.trim() !== ""
        ? `?academicYearId=${encodeURIComponent(wizardAcademicYearId.trim())}`
        : "";
    fetch(`/api/fotografo/schools/${sid}/enrollment-course-slots${qs}`, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudieron cargar los cursos.");
        }
        return data as EnrollmentCourseSlotsPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setEnrollmentSlotsPayload(data);
        if (data.academicYear && wizardAcademicYearId.trim() === "") {
          setWizardAcademicYearId(String(data.academicYear.id));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setEnrollmentSlotsError(e instanceof Error ? e.message : "Error al cargar cursos");
          setEnrollmentSlotsPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) setEnrollmentSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, isSchoolFlow, wizardSchoolId, wizardAcademicYearId, schoolCoursesStep]);

  const estimatedEnrollmentStudents = useMemo(() => {
    if (!enrollmentSlotsPayload?.groups?.length) return 0;
    let sum = 0;
    for (const lg of enrollmentSlotsPayload.groups) {
      for (const sg of lg.shifts) {
        for (const sl of sg.slots) {
          if (selectedCourseKeys.has(sl.courseKey)) sum += sl.count;
        }
      }
    }
    return sum;
  }, [enrollmentSlotsPayload, selectedCourseKeys]);

  const allEnrollmentCourseKeys = useMemo(() => {
    if (!enrollmentSlotsPayload?.groups?.length) return [];
    const keys: string[] = [];
    for (const lg of enrollmentSlotsPayload.groups) {
      for (const sg of lg.shifts) {
        for (const sl of sg.slots) {
          keys.push(sl.courseKey);
        }
      }
    }
    return keys;
  }, [enrollmentSlotsPayload]);

  const allEnrollmentCoursesSelected = useMemo(
    () =>
      allEnrollmentCourseKeys.length > 0 &&
      allEnrollmentCourseKeys.every((k) => selectedCourseKeys.has(k)),
    [allEnrollmentCourseKeys, selectedCourseKeys]
  );

  function resetNewSchoolFormFields() {
    setNewSchoolName("");
    setNewSchoolContactEmail("");
    setNewSchoolContactPhone("");
    setNewSchoolNotes("");
    setNewSchoolAddress("");
    setNewSchoolCity("");
    setNewSchoolProvince("");
    setNewSchoolCountry("");
    setNewSchoolLatitude(null);
    setNewSchoolLongitude(null);
    setNewSchoolLogoUrl(null);
  }

  async function handleNewSchoolLogoFile(file: File | null) {
    if (!file) return;
    setNewSchoolLogoUploading(true);
    setSchoolInlineMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/fotografo/schools/upload-logo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Error al subir el logo");
      }
      if (data.logoUrl) setNewSchoolLogoUrl(String(data.logoUrl));
    } catch (e) {
      setSchoolInlineMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Error al subir el logo",
      });
    } finally {
      setNewSchoolLogoUploading(false);
      if (newSchoolLogoInputRef.current) newSchoolLogoInputRef.current.value = "";
    }
  }

  async function submitInlineNewSchool() {
    setSchoolInlineMessage(null);
    if (!newSchoolName.trim()) {
      setSchoolInlineMessage({ type: "err", text: "El nombre de la escuela es obligatorio." });
      return;
    }
    setCreatingSchoolInline(true);
    try {
      const res = await fetch("/api/fotografo/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newSchoolName.trim(),
          contactEmail: newSchoolContactEmail.trim() || undefined,
          contactPhone: newSchoolContactPhone.trim() || undefined,
          notes: newSchoolNotes.trim() || undefined,
          address: newSchoolAddress.trim() || undefined,
          city: newSchoolCity.trim() || undefined,
          province: newSchoolProvince.trim() || undefined,
          country: newSchoolCountry.trim() || undefined,
          latitude: newSchoolLatitude ?? undefined,
          longitude: newSchoolLongitude ?? undefined,
          logoUrl: newSchoolLogoUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.error === "string"
              ? data.error
              : "No se pudo crear la escuela."
        );
      }
      const id = Number(data.id);
      const label =
        typeof data.name === "string" && data.name.trim() ? data.name.trim() : newSchoolName.trim();
      if (!Number.isFinite(id)) throw new Error("Respuesta inválida del servidor.");
      setSchools((prev) => {
        const rest = prev.filter((s) => s.id !== id);
        return [{ id, name: label, albumsCount: 0 }, ...rest];
      });
      setWizardSchoolId(String(id));
      setSchoolLinkMode("select");
      resetNewSchoolFormFields();
      setSchoolInlineMessage({ type: "ok", text: `Escuela «${label}» creada y vinculada a este asistente.` });
    } catch (e) {
      setSchoolInlineMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Error creando escuela.",
      });
    } finally {
      setCreatingSchoolInline(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cancelled || !cfg) return;
        if (cfg.minDigitalPhotoPrice != null && Number(cfg.minDigitalPhotoPrice) >= 0) {
          setMinDigitalPhotoPrice(Number(cfg.minDigitalPhotoPrice));
          setDigitalPhotoPrice((prev) => (prev ? prev : String(cfg.minDigitalPhotoPrice)));
        }
        const printPct = Number(
          cfg.printAlbumPlatformFeePercent ?? cfg.platformCommissionPercent
        );
        if (Number.isFinite(printPct) && printPct >= 0 && printPct <= 100) {
          setPrintPlatformFeePct(printPct);
        }
      })
      .catch(() => {});

    fetch("/api/fotografo/products", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.products) ? data.products : [];
        setPhotographerProductsCount(list.filter((p: { isActive?: boolean }) => p.isActive !== false).length);
      })
      .catch(() => {
        if (!cancelled) setPhotographerProductsCount(null);
      });

    fetch("/api/dashboard/photographer", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          setMpConnected(Boolean(data.mpConnected));
          if (data.preferredLabId != null && Number.isFinite(Number(data.preferredLabId))) {
            setPreferredLabId(Number(data.preferredLabId));
          }
          const resolved = Number(data.platformCommissionPercent);
          if (Number.isFinite(resolved) && resolved >= 0 && resolved <= 100) {
            setPlatformCommissionPercent(resolved);
            return;
          }
        }
        const fallback = await fetch("/api/config")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled || !fallback) return;
        const pct = Number(fallback.albumDigitalMarketplacePercent ?? fallback.platformCommissionPercent);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
          setPlatformCommissionPercent(pct);
        }
      })
      .catch(() => {
        if (!cancelled) setMpConnected(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSchoolFlow) return;
    let cancelled = false;
    fetch("/api/fotografo/schools", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) {
          setSchools(
            rows.map((s: { id: number; name: string; albumsCount?: number }) => ({
              id: s.id,
              name: s.name,
              albumsCount: s.albumsCount ?? 0,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSchoolFlow]);

  useEffect(() => {
    if (step !== 4) return;
    if (
      printPricingSource === "LAB_PREFERRED" &&
      selectedLabId == null &&
      preferredLabId != null &&
      Number.isFinite(preferredLabId)
    ) {
      setSelectedLabId(preferredLabId);
    }
  }, [step, printPricingSource, selectedLabId, preferredLabId]);

  function selectAlbumType(next: AlbumWizardType) {
    setAlbumType(next);
    const d = TYPE_DEFAULTS[next];
    setEnableDigitalPhotos(d.enableDigitalPhotos);
    setEnablePrintedPhotos(d.enablePrintedPhotos);
    setShowComingSoonMessage(d.showComingSoonMessage);
    if (next !== "SCHOOL") {
      setWizardSchoolId("");
      setWizardAcademicYearId("");
      setSelectedCourseKeys(new Set());
      setEnrollmentSlotsPayload(null);
      setEnrollmentSlotsError(null);
      setOrganizerCommissionEnabled(false);
      setOrganizerCommissionPct("");
      setOrganizerAppliesTo(new Set(["PREVENTA"]));
      setInviteName("");
      setInviteEmail("");
      setSchoolLinkMode("select");
      resetNewSchoolFormFields();
      setSchoolInlineMessage(null);
    }
    setTermsAccepted(false);
    setTermsTextOpen(false);
    setSecurityMode(DEFAULT_SECURITY_MODE[next]);
    setInvitedEmails([]);
    setInviteEmailDraft("");
    setStep(1);
  }

  const albumTypeLabel = TYPE_OPTIONS.find((o) => o.value === albumType)?.label ?? albumType;

  const canGoNextStep1 = albumType !== null;
  const canGoNextStep2 =
    title.trim().length > 0 &&
    (location.trim().length > 0 || (latitude !== null && longitude !== null));

  const validateAndBuildCreateBody = useCallback((): Record<string, unknown> => {
    const minDigits = Math.max(0, minDigitalPhotoPrice);
    let digitalPhotoPriceCents: number | null = null;

    if (enableDigitalPhotos) {
      const raw = digitalPhotoPrice.trim();
      const n = parseWizardDigitalPriceWhole(raw);
      if (n == null || n < minDigits) {
        throw new Error(
          `Precio digital inválido. Debe ser un número mayor o igual al mínimo del sistema (${minDigits}).`
        );
      }
      digitalPhotoPriceCents = n;
    }

    if (enablePrintedPhotos) {
      if (!hasPrintProducts) {
        throw new Error(
          "Para ofrecer impresiones necesitás al menos un producto activo en tu lista de precios."
        );
      }
      const marginRaw = albumProfitMarginPercent.trim();
      if (marginRaw === "") {
        throw new Error("Definí el margen de ganancia para impresiones (podés usar 0).");
      }
      const margin = parseFloat(marginRaw.replace(",", "."));
      if (!Number.isFinite(margin) || margin < 0) {
        throw new Error("El margen de ganancia debe ser un número mayor o igual a 0.");
      }
      if (printPricingSource === "LAB_PREFERRED" && selectedLabId == null) {
        throw new Error("Elegí un laboratorio para usar precios del laboratorio preferido.");
      }
    }

    let discountPct = 0;
    if (includeDigitalWithPrint) {
      const dRaw = digitalWithPrintDiscountPercent.trim();
      if (dRaw === "") discountPct = 0;
      else {
        const d = parseFloat(dRaw.replace(",", "."));
        if (!Number.isFinite(d) || d < 0 || d > 100) {
          throw new Error("El descuento digital junto a impresa debe estar entre 0 y 100.");
        }
        discountPct = d;
      }
    }

    if (albumType === "SCHOOL" && schoolLinkMode === "create") {
      throw new Error(
        "Guardá la escuela nueva con «Dar de alta y vincular» antes de crear el álbum, o bien usá una escuela ya cargada."
      );
    }

    let schoolIdNum: number | null = null;
    if (albumType === "SCHOOL" && wizardSchoolId.trim() !== "") {
      const sid = parseInt(wizardSchoolId, 10);
      if (!Number.isFinite(sid) || sid <= 0) {
        throw new Error("Selección de escuela inválida.");
      }
      schoolIdNum = sid;
    }

    if (albumType === "SCHOOL" && organizerCommissionEnabled) {
      if (schoolIdNum == null) {
        throw new Error(
          "Para activar la comisión escolar necesitás elegir la escuela que recibirá la comisión."
        );
      }
      const pRaw = organizerCommissionPct.trim();
      if (pRaw === "") {
        throw new Error("Indicá el porcentaje de comisión para la escuela.");
      }
      const p = parseFloat(pRaw.replace(",", "."));
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new Error("El porcentaje de comisión debe estar entre 0 y 100.");
      }
      if (organizerAppliesTo.size === 0) {
        throw new Error("Seleccioná al menos un tipo de venta que genere comisión.");
      }
    }

    const inviteN = inviteName.trim();
    const inviteE = inviteEmail.trim();
    if ((inviteN && !inviteE) || (!inviteN && inviteE)) {
      throw new Error(
        "Para enviar una invitación completá nombre y email del administrador, o dejá ambos vacíos."
      );
    }
    if ((inviteN || inviteE) && albumType === "SCHOOL" && schoolIdNum == null) {
      throw new Error("Elegí la escuela antes de enviar una invitación al administrador.");
    }

    if (!termsAccepted) {
      throw new Error(
        "Debés leer y aceptar los términos y condiciones antes de crear el álbum."
      );
    }

    const resolvedLab =
      enablePrintedPhotos && printPricingSource === "LAB_PREFERRED" ? selectedLabId : null;
    let marginPct: number | null = null;
    if (enablePrintedPhotos) {
      marginPct = parseFloat(albumProfitMarginPercent.trim().replace(",", "."));
    }

    let academicYearIdForCreate: number | null = null;
    if (albumType === "SCHOOL" && schoolIdNum != null && wizardAcademicYearId.trim() !== "") {
      const yid = parseInt(wizardAcademicYearId.trim(), 10);
      if (!Number.isFinite(yid) || yid <= 0) {
        throw new Error("Año lectivo inválido. Volvé al paso de cursos y elegí el ciclo lectivo.");
      }
      academicYearIdForCreate = yid;
    }
    const selectedKeysArr = Array.from(selectedCourseKeys);

    return buildAlbumCreateBody({
      mode: albumType,
      title,
      location,
      eventSchedule,
      latitude,
      longitude,
      enableDigitalPhotos,
      enablePrintedPhotos,
      showComingSoonMessage,
      digitalPhotoPriceCents,
      printPricingSource,
      selectedLabId: resolvedLab,
      pickupBy,
      albumProfitMarginPercent: marginPct,
      includeDigitalWithPrint,
      digitalWithPrintDiscountPercent: discountPct,
      schoolId: schoolIdNum,
      academicYearId: academicYearIdForCreate,
      selectedCourseKeys: selectedKeysArr,
      organizerCommissionEnabled: albumType === "SCHOOL" && organizerCommissionEnabled,
      organizerCommissionPercentage:
        albumType === "SCHOOL" && organizerCommissionEnabled
          ? parseFloat(organizerCommissionPct.trim().replace(",", "."))
          : null,
      organizerCommissionAppliesTo: Array.from(organizerAppliesTo),
      termsAccepted,
      securityMode,
    });
  }, [
    albumProfitMarginPercent,
    albumType,
    digitalPhotoPrice,
    digitalWithPrintDiscountPercent,
    enableDigitalPhotos,
    enablePrintedPhotos,
    eventSchedule,
    hasPrintProducts,
    includeDigitalWithPrint,
    inviteEmail,
    inviteName,
    latitude,
    location,
    longitude,
    minDigitalPhotoPrice,
    organizerAppliesTo,
    organizerCommissionEnabled,
    organizerCommissionPct,
    pickupBy,
    printPricingSource,
    selectedLabId,
    showComingSoonMessage,
    termsAccepted,
    title,
    wizardSchoolId,
    wizardAcademicYearId,
    selectedCourseKeys,
    schoolLinkMode,
    securityMode,
  ]);

  function assertDigitalStepOk(): void {
    if (!enableDigitalPhotos) return;
    const minDigits = Math.max(0, minDigitalPhotoPrice);
    const n = parseWizardDigitalPriceWhole(digitalPhotoPrice.trim());
    if (n == null || n < minDigits) {
      throw new Error(
        `Precio digital inválido. Usá un número mayor o igual al mínimo (${minDigits}).`
      );
    }
  }

  function assertPrintsStepOk(): void {
    if (!enablePrintedPhotos) return;
    if (!hasPrintProducts) {
      throw new Error("Cargá productos en tu lista de precios o desactivá las impresiones.");
    }
    if (albumProfitMarginPercent.trim() === "") {
      throw new Error("Indicá el margen para impresiones (0 está permitido).");
    }
    const margin = parseFloat(albumProfitMarginPercent.trim().replace(",", "."));
    if (!Number.isFinite(margin) || margin < 0) throw new Error("Margen inválido.");
    if (printPricingSource === "LAB_PREFERRED" && selectedLabId == null) {
      throw new Error("Elegí un laboratorio.");
    }
    if (includeDigitalWithPrint) {
      const dRaw = digitalWithPrintDiscountPercent.trim();
      if (dRaw !== "") {
        const d = parseFloat(dRaw.replace(",", "."));
        if (!Number.isFinite(d) || d < 0 || d > 100) {
          throw new Error("Descuento digital+junta impresa: 0–100.");
        }
      }
    }
  }

  function assertSchoolStepOk(): void {
    if (!isSchoolFlow) return;
    if (schoolLinkMode === "create") {
      throw new Error(
        'Guardá la escuela con «Dar de alta y vincular» o bien elegí la opción para usar una ya cargada en tu cuenta.'
      );
    }
    if (organizerCommissionEnabled) {
      if (!wizardSchoolId.trim()) {
        throw new Error("Seleccioná la escuela para la que aplicará la comisión.");
      }
      const p = parseFloat(organizerCommissionPct.trim().replace(",", "."));
      if (organizerCommissionPct.trim() === "" || !Number.isFinite(p) || p < 0 || p > 100) {
        throw new Error("Comisión: porcentaje entre 0 y 100.");
      }
      if (organizerAppliesTo.size === 0) {
        throw new Error("Seleccioná al menos un tipo de venta con comisión.");
      }
    }
    const inviteN = inviteName.trim();
    const inviteE = inviteEmail.trim();
    if ((inviteN && !inviteE) || (!inviteN && inviteE)) {
      throw new Error("Invitación: completá nombre y email o vaciá ambos.");
    }
    if ((inviteN || inviteE) && !wizardSchoolId.trim()) {
      throw new Error("Para invitar, primero elegí la escuela.");
    }
  }

  function assertSecurityStepOk(): void {
    if (securityMode === "private" && invitedEmails.length === 0) {
      throw new Error(
        'En modo "Privado" agregá al menos un email invitado o elegí otro nivel de acceso.'
      );
    }
  }

  function addEmailsToInviteList(): void {
    const raw = inviteEmailDraft.trim();
    if (!raw) {
      setError("Escribí uno o más emails.");
      return;
    }
    const parts = raw.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean);
    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = [...new Set(parts.map((s) => s.toLowerCase()))].filter((e) => emailLike.test(e));
    if (valid.length === 0) {
      setError("No encontramos emails válidos. Probá formato nombre@ejemplo.com (varios separados por coma).");
      return;
    }
    setInvitedEmails((prev) => {
      const seen = new Set(prev.map((p) => p.toLowerCase()));
      const merged = [...prev];
      for (const e of valid) {
        if (!seen.has(e)) {
          seen.add(e);
          merged.push(e);
        }
      }
      return merged;
    });
    setInviteEmailDraft("");
    setError(null);
  }

  function clearGeoPoint() {
    setLatitude(null);
    setLongitude(null);
    setGeoHint(null);
    setLocation((prev) => (prev === "Ubicación aproximada (GPS)" ? "" : prev));
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setGeoHint("Tu navegador no permite ubicación GPS.");
      return;
    }
    setGeoLoading(true);
    setGeoHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        if (!location.trim()) {
          setLocation("Ubicación aproximada (GPS)");
        }
        setGeoHint("Ubicación por GPS registrada. Si querés un nombre más claro para el cliente, buscá el lugar abajo.");
        setGeoLoading(false);
      },
      () => {
        setGeoHint("No pudimos leer tu ubicación. Probá otorgando permiso o buscando el lugar abajo.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }

  async function submitCreate() {
    setError(null);
    setCreatedAlbumIdHint(null);
    let body: Record<string, unknown>;
    try {
      body = validateAndBuildCreateBody();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá los datos antes de crear el álbum.");
      return;
    }

    const inviteSid = wizardSchoolId.trim() !== "" ? parseInt(wizardSchoolId, 10) : null;
    const willInvite =
      inviteSid != null &&
      inviteName.trim().length > 0 &&
      inviteEmail.trim().length > 0;

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data?.existingAlbumId) {
        setError(`Ya tenés un álbum para este contexto (#${data.existingAlbumId}).`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.detail === "string"
              ? data.detail
              : "No se pudo crear el álbum.";
        throw new Error(msg);
      }

      const albumId = createdAlbumIdFromResponse(data);
      let inviteFlash: string | null = null;
      if (willInvite && inviteSid != null && albumId != null) {
        const ir = await fetch(`/api/admin/schools/${inviteSid}/organizers/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
        });
        const invPayload = await ir.json().catch(() => ({}));
        if (!ir.ok) {
          inviteFlash =
            typeof invPayload?.error === "string"
              ? invPayload.error
              : "No se pudo enviar la invitación al administrador de escuela.";
        }
      }

      if (inviteFlash) {
        setCreatedAlbumIdHint(albumId);
        setError(
          `El álbum se creó bien (n.º ${albumId}). No se pudo enviar la invitación: ${inviteFlash}. Podés reenviarla desde Fotógrafo → Escuelas.`
        );
        setLoading(false);
        return;
      }

      router.push(albumId != null ? `/dashboard/albums/${albumId}` : "/dashboard/albums");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el álbum.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "clf-wizard-root mx-auto w-full min-w-0 space-y-6",
        floating ? "max-w-full pb-2 sm:pb-4" : "max-w-5xl px-1 pb-12 sm:px-0",
      )}
    >
      {floating ? (
        <div className="flex justify-end px-0 sm:px-1">
          <p className="text-right text-xs text-[#9ca3af]">
            <span className="font-medium text-[#6b7280]">{albumTypeLabel}</span>{" "}
            <span className="hidden sm:inline">
              (<code className="text-[10px]">{albumType}</code>)
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <Link
            href="/dashboard/albums"
            className="text-sm font-medium text-[#6b7280] transition-colors hover:text-[#c27b3d]"
          >
            ← Volver a álbumes
          </Link>
          <p className="text-right text-xs text-[#9ca3af]">
            <span className="font-medium text-[#6b7280]">{albumTypeLabel}</span>{" "}
            <span className="hidden sm:inline">
              (<code className="text-[10px]">{albumType}</code>)
            </span>
          </p>
        </div>
      )}

      <nav
        aria-label="Pasos del asistente"
        className="clf-wizard-stepper rounded-2xl border border-[#e8e8e8] bg-gradient-to-br from-[#fdfcfb] to-[#f8f6f4] px-4 py-4 shadow-sm"
      >
        <ol className="clf-wizard-stepper__list">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={`${label}-${i}`} className="clf-wizard-stepper__item">
                <div className="flex w-full min-w-0 items-center">
                  {i > 0 ? (
                    <span
                      className={`h-0.5 flex-1 rounded ${done || active ? "bg-[#c27b3d]" : "bg-[#e5e7eb]"}`}
                      aria-hidden
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done
                        ? "bg-[#c27b3d] text-white shadow-md"
                        : active
                          ? "bg-[#fdf8f3] text-[#c27b3d] ring-2 ring-[#c27b3d]"
                          : "bg-white text-[#9ca3af] ring-1 ring-[#e5e7eb]"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? "✓" : n}
                  </span>
                  {i < stepLabels.length - 1 ? (
                    <span
                      className={`h-0.5 flex-1 rounded ${step > n ? "bg-[#c27b3d]" : "bg-[#e5e7eb]"}`}
                      aria-hidden
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                </div>
                <span
                  className={`mt-1 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                    active ? "text-[#c27b3d]" : "text-[#9ca3af]"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <Card className="clf-wizard-card w-full min-w-0 border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          {createdAlbumIdHint != null && (
            <Link
              href={`/dashboard/albums/${createdAlbumIdHint}`}
              className="inline-block text-sm font-semibold text-[#c27b3d] underline"
            >
              Ir al álbum creado
            </Link>
          )}
        </Card>
      )}

      {mpConnected === false ? (
        <Card className="w-full min-w-0 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            Necesitás vincular Mercado Pago para crear álbumes. Podés hacerlo desde{" "}
            <Link href="/fotografo/configuracion?tab=mercadopago" className="underline font-medium">
              Configuración → Mercado Pago
            </Link>
            .
          </p>
        </Card>
      ) : null}

      {step === 1 && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso 1
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Tipo de álbum</h2>
          </div>
          <p className="clf-form-description">
            Elegí el tipo: ajustamos por defecto opciones de venta; podés revisarlas y ampliarlas en los pasos siguientes.
          </p>
          <div className="clf-form-grid clf-form-grid--2 gap-3">
            {TYPE_OPTIONS.map((opt) => {
              const selected = albumType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectAlbumType(opt.value)}
                  className={`flex min-w-0 gap-3 rounded-xl border p-4 text-left transition-all duration-150 sm:gap-4 ${
                    selected
                      ? "border-[#c27b3d] bg-[#fdf8f3] shadow-[0_0_0_1px_rgba(194,123,61,0.35)] ring-2 ring-[#c27b3d]/20"
                      : "border-[#e8e8e8] bg-[#fafafa] hover:border-[#d4d4d4] hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12 ${
                      selected
                        ? "border-[#e8c4a8] bg-white text-[#c27b3d] shadow-sm"
                        : "border-[#e5e7eb] bg-white text-[#9ca3af]"
                    }`}
                    aria-hidden
                  >
                    <opt.Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1a1a1a]">{opt.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="primary" disabled={!canGoNextStep1} onClick={() => setStep(2)}>
              Siguiente
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso 2
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Datos básicos</h2>
          </div>
          <div className="clf-form-section">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Título</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Casamiento Ana y Luis"
                className="border-[#e5e7eb]"
              />
            </div>

            <div className="rounded-xl border border-dashed border-[#e8dcc8] bg-[#fdfbf8] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1 basis-[min(100%,26rem)]">
                  <p className="text-sm font-semibold text-[#1a1a1a]">Lugar · georeferenciado</p>
                  <p className="clf-form-description clf-form-description--sm mt-1">
                    Buscá un lugar por nombre y elegí resultado, o tocá «Mi ubicación». El texto que ve el cliente
                    sale del punto elegido en el mapa (o del nombre que devuelva la búsqueda).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-4 py-2 text-xs"
                    disabled={geoLoading}
                    onClick={() => requestDeviceLocation()}
                  >
                    {geoLoading ? "GPS…" : "Mi ubicación"}
                  </Button>
                  {(latitude !== null || longitude !== null) && (
                    <Button type="button" variant="secondary" className="rounded-full px-4 py-2 text-xs" onClick={() => clearGeoPoint()}>
                      Quitar marcador
                    </Button>
                  )}
                </div>
              </div>
              <EventLocationSearch
                placeholder="Ej: Monumental, Paseo de la Costa…"
                onSelect={(lat, lon, displayName) => {
                  setLatitude(lat);
                  setLongitude(lon);
                  setLocation(displayName);
                  setGeoHint("Marcador cargado desde la búsqueda.");
                }}
                className="w-full"
              />
              {location.trim().length > 0 && (
                <p className="text-xs text-[#4b5563]">
                  <span className="font-medium text-[#374151]">Texto para el álbum:</span> {location.trim()}
                </p>
              )}
              {latitude !== null && longitude !== null && (
                <p className="text-xs text-[#4b5563]">
                  <span className="font-medium text-[#374151]">Coordenadas:</span>{" "}
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
              {geoHint ? <p className="text-xs text-[#6b7280]">{geoHint}</p> : null}
            </div>

            <AlbumEventScheduleFields
              value={eventSchedule}
              onChange={setEventSchedule}
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button type="button" variant="primary" disabled={!canGoNextStep2} onClick={() => setStep(3)}>
              Siguiente
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso 3
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Ventas digitales</h2>
          </div>
          <p className="clf-form-text">{STEP_3_GUIDANCE[albumType]}</p>
          <p className="clf-form-description clf-form-description--sm">
            El precio por foto digital y la comisión de plataforma se aplican en el checkout público.
          </p>

          <div className="w-full min-w-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 clf-form-section">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">Configuración recomendada</h3>
            <ul className="text-sm text-[#4b5563] space-y-1.5 list-disc list-inside marker:text-[#9ca3af]">
              {RECOMMENDED_CONFIG_LINES[albumType].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="clf-form-section">
            <label className="clf-wizard-check cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#c27b3d]"
                checked={enableDigitalPhotos}
                onChange={(e) => setEnableDigitalPhotos(e.target.checked)}
              />
              <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">Vender fotos digitales</span>
            </label>
            {enableDigitalPhotos ? (
              <div className="clf-form-section">
                <div className="clf-form-field-stack">
                  <label className="block text-sm font-medium text-[#374151]">
                    Precio por foto digital (ARS · mín. {formatARS(minDigitalPhotoPrice)})
                  </label>
                  <p className="clf-form-description clf-form-description--sm">
                    Monto en pesos argentinos sin símbolo en el número; el cliente verá el total con comisión de
                    plataforma en el checkout.
                  </p>
                  <div className="clf-form-control-numeric relative min-w-0">
                    <span
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#6b7280]"
                      aria-hidden
                    >
                      $
                    </span>
                    <Input
                      type="number"
                      min={minDigitalPhotoPrice}
                      step={100}
                      value={digitalPhotoPrice}
                      onChange={(e) => setDigitalPhotoPrice(e.target.value)}
                      placeholder={`Ej: ${minDigitalPhotoPrice}`}
                      className="border-[#e5e7eb] pl-9"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                {(() => {
                  const baseWhole = parseWizardDigitalPriceWhole(digitalPhotoPrice);
                  const pct = platformCommissionPercent;
                  if (
                    pct == null ||
                    !Number.isFinite(pct) ||
                    baseWhole == null ||
                    baseWhole <= 0
                  ) {
                    return null;
                  }
                  const feeWhole = feeFromBase(baseWhole, pct);
                  const totalWhole = totalFromBase(baseWhole, pct);
                  return (
                    <div className="rounded-lg border border-[#e8e4df] bg-[#fdfbf8] p-3 text-sm text-[#374151]">
                      <p className="font-semibold text-[#1a1a1a]">Simulador orientativo (1 foto digital)</p>
                      <ul className="mt-2 space-y-1 text-[#4b5563]">
                        <li>
                          <span className="text-[#6b7280]">Precio cargado:</span>{" "}
                          <strong className="text-[#1a1a1a]">{formatARS(baseWhole)}</strong>
                        </li>
                        <li>
                          <span className="text-[#6b7280]">Comisión plataforma estimada:</span>{" "}
                          <strong className="text-[#1a1a1a]">{pct.toLocaleString("es-AR")}%</strong>
                          {feeWhole > 0 ? (
                            <span className="text-[#6b7280]"> ({formatARS(feeWhole)} por unidad)</span>
                          ) : null}
                        </li>
                        <li>
                          <span className="text-[#6b7280]">Cliente pagaría aprox.:</span>{" "}
                          <strong className="text-[#1a1a1a]">{formatARS(totalWhole)}</strong>
                        </li>
                        <li>
                          <span className="text-[#6b7280]">Fotógrafo recibiría aprox.:</span>{" "}
                          <strong className="text-[#1a1a1a]">{formatARS(baseWhole)}</strong>
                        </li>
                      </ul>
                      <p className="mt-2 border-t border-[#ebe8e4] pt-2 text-[11px] leading-snug text-[#6b7280]">
                        Comisión calculada con la misma prioridad que el checkout: cuenta, laboratorio preferido y
                        valores de plataforma. El importe final puede variar según medios de pago y otras reglas.
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            <label className="clf-wizard-check cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#c27b3d]"
                checked={showComingSoonMessage}
                onChange={(e) => setShowComingSoonMessage(e.target.checked)}
              />
              <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
                Mostrar mensaje de espera al público antes de tener fotos a la venta
              </span>
            </label>
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Atrás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setError(null);
                try {
                  assertDigitalStepOk();
                  setStep(4);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Revisá ventas digitales.");
                }
              }}
            >
              Siguiente: impresiones
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso 4
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Impresiones</h2>
          </div>
          <p className="clf-form-description">
            Origen de precios de impresión, margen aplicado antes del fee de plataforma sobre el resultado, y opciones de entrega. Si no vas a imprimir desde este álbum, desactivá la opción.
          </p>

          <label className="clf-wizard-check cursor-pointer rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
            <input
              type="checkbox"
              className="accent-[#c27b3d]"
              checked={enablePrintedPhotos}
              onChange={(e) => {
                const next = e.target.checked;
                if (next && !hasPrintProducts) {
                  setError("Para habilitar impresiones necesitás al menos un producto activo en tu lista de precios.");
                  return;
                }
                setError(null);
                setEnablePrintedPhotos(next);
              }}
            />
            <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
              <span className="font-semibold">Ofrecer impresiones físicas</span>
              <span className="mt-1 block text-xs font-normal text-[#6b7280]">
                El sistema valida tus productos al crear el álbum. Podés cargar lista de precios en Configuración.
              </span>
            </span>
          </label>

          {!hasPrintProducts && (
            <p className="w-full min-w-0 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Todavía no hay productos activos en tu lista. Las impresiones no se pueden activar hasta que los cargues.
            </p>
          )}

          {enablePrintedPhotos && (
            <div className="clf-form-section w-full min-w-0 rounded-xl border border-[#ebe8e4] bg-[#fdfcfb] p-5">
              <div>
                <span className="block text-sm font-semibold text-[#1a1a1a] mb-2">Origen de precios</span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white cursor-pointer">
                    <input
                      type="radio"
                      name="wiz-print-src"
                      className="accent-[#c27b3d]"
                      checked={printPricingSource === "PHOTOGRAPHER"}
                      onChange={() => setPrintPricingSource("PHOTOGRAPHER")}
                    />
                    <span className="text-sm">Mi lista (fotógrafo)</span>
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white cursor-pointer">
                    <input
                      type="radio"
                      name="wiz-print-src"
                      className="accent-[#c27b3d]"
                      checked={printPricingSource === "LAB_PREFERRED"}
                      onChange={() => setPrintPricingSource("LAB_PREFERRED")}
                    />
                    <span className="text-sm">Laboratorio (precios del lab)</span>
                  </label>
                </div>
              </div>

              {printPricingSource === "LAB_PREFERRED" && (
                <div className="clf-form-field-stack">
                  <label className="block text-sm font-semibold text-[#1a1a1a]">Laboratorio</label>
                  <div className="relative w-full min-w-0">
                    <Input
                      type="text"
                      placeholder="Buscar laboratorio..."
                      value={labSearch}
                      onChange={(e) => {
                        const q = e.target.value;
                        setLabSearch(q);
                        const url =
                          q.trim().length >= 2
                            ? `/api/labs?search=${encodeURIComponent(q.trim())}`
                            : "/api/labs";
                        fetch(url)
                          .then((r) => (r.ok ? r.json() : []))
                          .then((data) => setLabs(Array.isArray(data) ? data : []))
                          .catch(() => setLabs([]));
                      }}
                      onFocus={() => {
                        setShowLabDropdown(true);
                        fetch("/api/labs")
                          .then((r) => r.json())
                          .then((data) => setLabs(Array.isArray(data) ? data : []))
                          .catch(() => {});
                      }}
                      onBlur={() => setTimeout(() => setShowLabDropdown(false), 180)}
                      className="border-[#e5e7eb]"
                    />
                    {showLabDropdown && labs.length > 0 && (
                      <div className="absolute z-40 left-0 right-0 top-full mt-1 max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
                        {labs.map((lab) => (
                          <button
                            key={lab.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#fdf8f3]"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => {
                              setSelectedLabId(lab.id);
                              setLabSearch(lab.name);
                              setShowLabDropdown(false);
                            }}
                          >
                            <span className="font-medium text-[#1a1a1a]">{lab.name}</span>
                            {lab.city ? (
                              <span className="block text-[11px] text-[#6b7280]">
                                {lab.city}
                                {lab.province ? ` · ${lab.province}` : ""}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedLabId != null && (
                    <p className="text-xs text-[#6b7280]">Laboratorio seleccionado ID {selectedLabId}</p>
                  )}
                </div>
              )}

              <div className="clf-form-field-stack w-full min-w-0">
                <label className="text-sm font-semibold text-[#1a1a1a]">
                  Margen de ganancia sobre el precio base (%)
                </label>
                <div className="clf-form-control-numeric w-full">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Ej: 35"
                    value={albumProfitMarginPercent}
                    onChange={(e) => setAlbumProfitMarginPercent(e.target.value)}
                    className="box-border min-h-[2.75rem] border-[#e5e7eb]"
                  />
                </div>
                <p className="clf-form-description clf-form-description--sm mt-1">
                  Precio obra = base + margen. Sobre ese total se suma el fee de plataforma (impresiones).
                </p>
              </div>

              {printPlatformFeePct != null && (
                <p className="text-xs text-[#4b5563] bg-[#f3f4f6] border border-[#e5e7eb] rounded-md p-2">
                  Fee plataforma (referencia configuración típica de impresión):{" "}
                  <strong>{printPlatformFeePct}%</strong> sobre precio obra.
                </p>
              )}

              {printPlatformFeePct != null &&
              Number.isFinite(printPlatformFeePct) &&
              printPlatformFeePct >= 0 ? (
                <div className="w-full min-w-0 space-y-3">
                  <div className="clf-form-field-stack w-full min-w-0">
                    <label className="text-xs font-medium text-[#374151]">
                      Precio base de ejemplo por unidad (ARS)
                    </label>
                    <p className="clf-form-description clf-form-description--sm mb-0">
                      Referencia típica de tu lista &quot;Mi lista&quot; o de un tamaño medio. Si en el álbum usás
                      laboratorio, el base real viene del catálogo; este valor sirve para estimar margen + fee.
                    </p>
                    <div className="clf-form-control-numeric relative min-w-0">
                      <span
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#6b7280]"
                        aria-hidden
                      >
                        $
                      </span>
                      <Input
                        type="number"
                        min={1}
                        step={100}
                        value={printSimulatorExampleBase}
                        onChange={(e) => setPrintSimulatorExampleBase(e.target.value)}
                        className="box-border min-h-[2.75rem] border-[#e5e7eb] pl-9"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  {(() => {
                    const marginRaw = albumProfitMarginPercent.trim().replace(",", ".");
                    const marginNum =
                      marginRaw === "" ? null : Number.parseFloat(marginRaw);
                    const baseWhole = parseWizardDigitalPriceWhole(printSimulatorExampleBase);
                    if (
                      marginNum == null ||
                      !Number.isFinite(marginNum) ||
                      marginNum < 0 ||
                      baseWhole == null ||
                      baseWhole <= 0
                    ) {
                      return (
                        <div className="rounded-lg border border-dashed border-[#e8e4df] bg-[#fdfbf8] p-3 text-xs text-[#6b7280]">
                          <p className="font-semibold text-[#374151]">Simulador (1 impresión)</p>
                          <p className="mt-1">
                            Completá el margen más arriba (podés usar 0) y un precio base de ejemplo válido para ver el
                            desglose aproximado.
                          </p>
                        </div>
                      );
                    }
                    const b = computePrintPricing({
                      baseUnitPrice: baseWhole,
                      albumMarginPercent: marginNum,
                      platformFeePercent: printPlatformFeePct,
                      quantity: 1,
                    });
                    return (
                      <div className="rounded-lg border border-[#e8e4df] bg-[#fdfbf8] p-3 text-sm text-[#374151]">
                        <p className="font-semibold text-[#1a1a1a]">Simulador orientativo (1 impresión física)</p>
                        <ul className="mt-2 space-y-1 text-[#4b5563]">
                          <li>
                            <span className="text-[#6b7280]">Origen cotizado:</span>{" "}
                            <strong>
                              {printPricingSource === "LAB_PREFERRED"
                                ? "Laboratorio · ejemplo con la base cargada"
                                : "Mi lista · ejemplo"}
                            </strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">Precio base:</span>{" "}
                            <strong className="text-[#1a1a1a]">{formatARS(b.baseUnitPrice)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">
                              Precio obra (margen {b.albumMarginPercent.toLocaleString("es-AR")}%):
                            </span>{" "}
                            <strong className="text-[#1a1a1a]">{formatARS(b.priceAfterAlbumMargin)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">
                              Fee plataforma ({b.platformFeePercent.toLocaleString("es-AR")}% sobre obra):
                            </span>{" "}
                            <strong className="text-[#1a1a1a]">{formatARS(b.platformFeeAmountPerUnit)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">Cliente pagaría aprox.:</span>{" "}
                            <strong className="text-[#1a1a1a]">{formatARS(b.finalUnitPrice)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">
                              Fotógrafo · precio obra aprox. (sin el fee Mercado sobre el cliente):
                            </span>{" "}
                            <strong className="text-[#1a1a1a]">{formatARS(b.priceAfterAlbumMargin)}</strong>
                          </li>
                        </ul>
                        <p className="mt-2 border-t border-[#ebe8e4] pt-2 text-[11px] leading-snug text-[#6b7280]">
                          Fee de impresión según configuración pública del sistema. Por producto y por pedido pueden
                          variar los valores; esto sólo orienta con el mismo margen y % que cargaste.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              <div>
                <span className="block text-sm font-semibold text-[#1a1a1a] mb-2">¿Quién retira en laboratorio?</span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white cursor-pointer">
                    <input
                      type="radio"
                      name="wiz-pickup"
                      className="accent-[#c27b3d]"
                      checked={pickupBy === "CLIENT"}
                      onChange={() => setPickupBy("CLIENT")}
                    />
                    <span className="text-sm">Cliente</span>
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white cursor-pointer">
                    <input
                      type="radio"
                      name="wiz-pickup"
                      className="accent-[#c27b3d]"
                      checked={pickupBy === "PHOTOGRAPHER"}
                      onChange={() => setPickupBy("PHOTOGRAPHER")}
                    />
                    <span className="text-sm">Yo (fotógrafo)</span>
                  </label>
                </div>
              </div>

              <div className="w-full min-w-0 space-y-3">
                <label className="clf-wizard-check w-full min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#c27b3d]"
                    checked={includeDigitalWithPrint}
                    onChange={(e) => setIncludeDigitalWithPrint(e.target.checked)}
                  />
                  <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
                    Incluir versión digital con la impresa (con descuento opcional)
                  </span>
                </label>
                {includeDigitalWithPrint && (
                  <div className="clf-form-field-stack w-full min-w-0 pl-7">
                    <label className="block text-xs font-medium text-[#374151]">
                      Descuento sobre la foto digital (%)
                    </label>
                    <div className="clf-form-control-numeric w-full max-w-[8rem]">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        placeholder="0–100"
                        value={digitalWithPrintDiscountPercent}
                        onChange={(e) => setDigitalWithPrintDiscountPercent(e.target.value)}
                        className="box-border min-h-[2.75rem] w-full min-w-[5.5rem] border-[#e5e7eb]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(3)}>
              Atrás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setError(null);
                try {
                  assertPrintsStepOk();
                  setStep(isSchoolFlow ? 5 : securityStep);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Revisá las impresiones.");
                }
              }}
            >
              {isSchoolFlow ? "Siguiente: escuela" : "Siguiente: seguridad"}
            </Button>
          </div>
        </Card>
      )}

      {step === 5 && isSchoolFlow && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso 5
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Escuela y comisión</h2>
          </div>
          <p className="clf-form-description">
            Vinculá el álbum a una escuela tuya para operar el flujo escolar. Si pactaste comisión para la institución, definila acá. Podés invitar por email al administrador (mismo proceso que en &quot;Fotógrafo → Escuelas&quot;).
          </p>

          <div className="clf-form-section">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[#1a1a1a] mb-2">¿Cómo vinculás la escuela?</legend>
              <label className="clf-wizard-check cursor-pointer rounded-lg border border-[#ebe8e4] bg-white p-3">
                <input
                  type="radio"
                  name="wiz-school-mode"
                  className="accent-[#c27b3d]"
                  checked={schoolLinkMode === "select"}
                  onChange={() => {
                    setSchoolLinkMode("select");
                    setSchoolInlineMessage(null);
                  }}
                />
                <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
                  <span className="font-medium">Ya la tengo en mi cuenta</span>
                  <span className="mt-0.5 block text-xs text-[#6b7280]">Elegí una escuela de la lista.</span>
                </span>
              </label>
              <label className="clf-wizard-check cursor-pointer rounded-lg border border-[#ebe8e4] bg-white p-3">
                <input
                  type="radio"
                  name="wiz-school-mode"
                  className="accent-[#c27b3d]"
                  checked={schoolLinkMode === "create"}
                  onChange={() => {
                    setSchoolLinkMode("create");
                    setWizardSchoolId("");
                    setSchoolInlineMessage(null);
                    resetNewSchoolFormFields();
                  }}
                />
                <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
                  <span className="font-medium">Darla de alta ahora mismo</span>
                  <span className="mt-0.5 block text-xs text-[#6b7280]">
                    Completá los datos acá y guardá antes de revisar el álbum.
                  </span>
                </span>
              </label>
            </fieldset>

            {schoolLinkMode === "select" && (
              <div className="clf-form-field-stack">
                <label htmlFor="wizard-school-select" className="text-sm font-semibold text-[#1a1a1a]">
                  Escuela vinculada
                </label>
                <select
                  id="wizard-school-select"
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#1a1a1a]"
                  value={wizardSchoolId}
                  onChange={(e) => setWizardSchoolId(e.target.value)}
                >
                  <option value="">Sin vincular por ahora</option>
                  {schools.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {schoolLinkMode === "create" && (
              <div className="clf-form-section rounded-xl border border-[#e8dcc8] bg-[#fdfbf8] p-4">
                <p className="text-sm font-semibold text-[#1a1a1a]">Alta de escuela</p>
                <p className="clf-form-description clf-form-description--sm">
                  Mismos datos que en Fotógrafos → Escuelas. Al guardar se crea en tu cuenta y se selecciona para este álbum.
                </p>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Logo (opcional)</label>
                  <p className="text-xs text-[#6b7280] mb-2">JPG, PNG, WebP o GIF, hasta 5 MB.</p>
                  <input
                    ref={newSchoolLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleNewSchoolLogoFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs rounded-full px-4 py-2"
                      disabled={newSchoolLogoUploading}
                      onClick={() => newSchoolLogoInputRef.current?.click()}
                    >
                      {newSchoolLogoUploading ? "Subiendo…" : newSchoolLogoUrl ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {newSchoolLogoUrl ? (
                      <>
                        <div className="h-16 w-16 rounded-lg border border-[#e5e7eb] bg-white overflow-hidden">
                          <img src={newSchoolLogoUrl} alt="" className="h-full w-full object-contain" />
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setNewSchoolLogoUrl(null)}
                        >
                          Quitar logo
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Nombre de la escuela <span className="text-red-600">*</span>
                  </label>
                  <Input
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="Ej. Instituto Norte"
                    className="border-[#e5e7eb]"
                  />
                </div>
                <div className="clf-form-grid clf-form-grid--2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Email de contacto</label>
                    <Input
                      type="email"
                      value={newSchoolContactEmail}
                      onChange={(e) => setNewSchoolContactEmail(e.target.value)}
                      placeholder="contacto@escuela.edu.ar"
                      className="border-[#e5e7eb]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Teléfono</label>
                    <Input
                      value={newSchoolContactPhone}
                      onChange={(e) => setNewSchoolContactPhone(e.target.value)}
                      placeholder="+54 ..."
                      className="border-[#e5e7eb]"
                    />
                  </div>
                </div>
                <AddressGeoSearch
                  address={newSchoolAddress}
                  city={newSchoolCity}
                  province={newSchoolProvince}
                  country={newSchoolCountry}
                  latitude={newSchoolLatitude}
                  longitude={newSchoolLongitude}
                  onAddressChange={setNewSchoolAddress}
                  onCityChange={setNewSchoolCity}
                  onProvinceChange={setNewSchoolProvince}
                  onCountryChange={setNewSchoolCountry}
                  onCoordsChange={(lat, lon) => {
                    setNewSchoolLatitude(lat);
                    setNewSchoolLongitude(lon);
                  }}
                  placeholder="Buscar dirección de la institución..."
                />
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Observaciones</label>
                  <Textarea
                    value={newSchoolNotes}
                    onChange={(e) => setNewSchoolNotes(e.target.value)}
                    placeholder="Notas internas..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={creatingSchoolInline}
                  onClick={() => void submitInlineNewSchool()}
                >
                  {creatingSchoolInline ? "Guardando…" : "Dar de alta y vincular"}
                </Button>
              </div>
            )}

            {schoolInlineMessage && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  schoolInlineMessage.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {schoolInlineMessage.text}
              </div>
            )}
          </div>

          <label className="clf-wizard-check rounded-lg border border-[#f1f5f9] bg-[#fafafa] p-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#c27b3d]"
              checked={organizerCommissionEnabled}
              onChange={(e) => setOrganizerCommissionEnabled(e.target.checked)}
            />
            <span className="clf-wizard-check__body text-sm text-[#1a1a1a]">
              Activar comisión para la escuela sobre ventas vía su canal
            </span>
          </label>

          {organizerCommissionEnabled && (
            <div className="clf-form-section border border-[#ebe8e4] rounded-lg p-4 bg-[#fdfcfb]">
              <div className="clf-form-field-stack">
                <label className="text-sm font-semibold text-[#1a1a1a]">Porcentaje de comisión</label>
                <div className="clf-form-control-numeric relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="Ej: 5"
                    value={organizerCommissionPct}
                    onChange={(e) => setOrganizerCommissionPct(e.target.value)}
                    className="min-h-11 pr-7 border-[#e5e7eb]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-sm">
                    %
                  </span>
                </div>
              </div>
              <div className="w-full min-w-0">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-2">Ventas que generan comisión</p>
                <div className="clf-form-grid clf-form-grid--2 gap-2">
                  {WIZARD_COMMISSION_PHASES.map((ph) => (
                    <label
                      key={ph.value}
                      className="clf-wizard-check min-w-0 rounded-md border border-[#e8e8e8] bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[#c27b3d]"
                        checked={organizerAppliesTo.has(ph.value)}
                        onChange={() => {
                          setOrganizerAppliesTo((prev) => {
                            const n = new Set(prev);
                            if (n.has(ph.value)) n.delete(ph.value);
                            else n.add(ph.value);
                            return n;
                          });
                        }}
                      />
                      <span className="clf-wizard-check__body min-w-0">
                        <span className="font-medium text-[#1a1a1a]">{ph.label}</span>
                        <span className="block text-xs text-[#6b7280]">{ph.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 leading-relaxed">
            La comisión con la institución es un acuerdo entre vos y la escuela; ComprameLaFoto no interviene en su pago.
          </div>

          <div className="clf-form-section border border-[#e5e7eb] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">Invitar administrador de escuela (opcional)</h3>
            <p className="clf-form-description clf-form-description--sm">
              Igual que en Fotógrafos → Escuela: nombre y email. Se envía invitación al mail indicado una vez creado el álbum (si está vinculada la escuela).
            </p>
            <Input
              placeholder="Nombre contacto escuela"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="border-[#e5e7eb]"
            />
            <Input
              type="email"
              placeholder="nombre@dominioescuela.ar"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="border-[#e5e7eb]"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(4)}>
              Atrás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setError(null);
                try {
                  assertSchoolStepOk();
                  setStep(schoolCoursesStep);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Revisá escuela y comisión.");
                }
              }}
            >
              Siguiente: cursos y alumnos
            </Button>
          </div>
        </Card>
      )}

      {step === schoolCoursesStep && isSchoolFlow && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso {schoolCoursesStep}
            </span>
            <h2 className="min-w-0 text-xl font-semibold tracking-tight text-[#1a1a1a]">Cursos y alumnos</h2>
          </div>
          <p className="clf-form-description">
            Elegí el año lectivo y los cursos o divisiones del padrón institucional. El sistema generará el padrón del
            álbum a partir de las matrículas ya cargadas (no reemplaza importación CSV ni pedidos existentes).
          </p>

          {!wizardSchoolId.trim() ? (
            <p className="w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Volvé al paso anterior y vinculá una escuela para elegir cursos.
            </p>
          ) : (
            <>
              <div className="w-full min-w-0 space-y-2">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Año lectivo</label>
                <select
                  className="min-h-11 w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#1a1a1a] focus:border-[#c27b3d] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/20"
                  value={wizardAcademicYearId}
                  onChange={(e) => {
                    setWizardAcademicYearId(e.target.value);
                    setSelectedCourseKeys(new Set());
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {(enrollmentSlotsPayload?.academicYears ?? []).map((y) => (
                    <option key={y.id} value={String(y.id)}>
                      {y.label}
                      {y.isCurrent ? " · Actual" : ""}
                    </option>
                  ))}
                </select>
                {enrollmentSlotsPayload?.academicYear ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#374151]">
                    <span className="font-medium">{enrollmentSlotsPayload.academicYear.label}</span>
                    {enrollmentSlotsPayload.academicYear.isCurrent ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Actual
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {enrollmentSlotsLoading && (
                <p className="w-full min-w-0 text-sm text-[#6b7280]" aria-live="polite">
                  Cargando cursos institucionales…
                </p>
              )}
              {enrollmentSlotsError && (
                <p className="w-full min-w-0 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                  {enrollmentSlotsError}
                </p>
              )}

              {!enrollmentSlotsLoading &&
                enrollmentSlotsPayload &&
                enrollmentSlotsPayload.totalEnrollments === 0 &&
                (enrollmentSlotsPayload.academicYear != null || (enrollmentSlotsPayload.academicYears?.length ?? 0) > 0) && (
                  <div className="w-full min-w-0 max-w-2xl space-y-4 rounded-xl border border-sky-200 bg-sky-50/80 p-5">
                    <p className="text-sm font-medium text-sky-950">No hay alumnos cargados para este año lectivo.</p>
                    <p className="text-sm leading-relaxed text-sky-900/90 ds-readable-text ds-readable-text--fluid">
                      Importá o actualizá el padrón institucional de la escuela para que aparezcan matrículas y poder
                      vincularlas a este álbum.
                    </p>
                    <Link
                      href={`/fotografo/escuelas/${parseInt(wizardSchoolId, 10)}`}
                      className="inline-flex items-center justify-center rounded-lg bg-[#c27b3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a0652d]"
                    >
                      Ir a importar padrón
                    </Link>
                  </div>
                )}

              {enrollmentSlotsPayload && enrollmentSlotsPayload.groups.length > 0 ? (
                <div className="ds-content-container w-full min-w-0 max-w-full space-y-8">
                  <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4">
                    <p className="min-w-0 flex-1 text-sm text-[#6b7280] ds-readable-text">
                      Elegí uno o más cursos. Podés marcarlos todos con un solo clic.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (allEnrollmentCoursesSelected) {
                          setSelectedCourseKeys(new Set());
                        } else {
                          setSelectedCourseKeys(new Set(allEnrollmentCourseKeys));
                        }
                      }}
                      className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm transition hover:bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30"
                    >
                      {allEnrollmentCoursesSelected ? "Deseleccionar todos" : "Seleccionar todos los cursos"}
                    </button>
                  </div>
                  {enrollmentSlotsPayload.groups.map((lg) => (
                    <div key={lg.level} className="w-full min-w-0 max-w-full space-y-4">
                      <h3 className="border-b border-[#e5e7eb] pb-2 text-base font-semibold text-[#111827]">
                        {lg.level}
                      </h3>
                      {lg.shifts.map((sg) => (
                        <div
                          key={`${lg.level}-${sg.shift}`}
                          className="w-full min-w-0 max-w-full space-y-3 pl-2 sm:pl-4"
                        >
                          <p className="text-sm font-medium text-[#374151]">{sg.shift}</p>
                          <ul className="flex w-full min-w-0 max-w-full flex-col gap-2">
                            {sg.slots.map((sl) => {
                              const checked = selectedCourseKeys.has(sl.courseKey);
                              return (
                                <li key={sl.courseKey} className="w-full min-w-0 max-w-full">
                                  <label className="clf-wizard-check box-border flex w-full min-w-0 max-w-full cursor-pointer items-center gap-3 rounded-xl border border-[#ebe8e4] bg-[#fafafa] px-4 py-3 hover:bg-white">
                                    <input
                                      type="checkbox"
                                      className="shrink-0 accent-[#c27b3d]"
                                      checked={checked}
                                      onChange={() => {
                                        setSelectedCourseKeys((prev) => {
                                          const n = new Set(prev);
                                          if (n.has(sl.courseKey)) n.delete(sl.courseKey);
                                          else n.add(sl.courseKey);
                                          return n;
                                        });
                                      }}
                                    />
                                    <span className="clf-wizard-check__body min-w-0 text-left text-sm text-[#1a1a1a]">
                                      <span className="font-semibold whitespace-normal break-words">{sl.label}</span>
                                      <span className="text-[#6b7280]"> ({sl.count})</span>
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex w-full min-w-0 flex-wrap gap-3 text-sm text-[#374151]">
                <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-3 py-1 font-medium">
                  Cursos seleccionados: {selectedCourseKeys.size}
                </span>
                <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-3 py-1 font-medium">
                  Alumnos estimados: {estimatedEnrollmentStudents}
                </span>
              </div>
            </>
          )}

          <div className="flex w-full min-w-0 justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(5)}>
              Atrás
            </Button>
            <Button type="button" variant="primary" onClick={() => setStep(securityStep)}>
              Siguiente: seguridad
            </Button>
          </div>
        </Card>
      )}

      {step === securityStep && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Paso {securityStep}
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Seguridad y privacidad</h2>
          </div>
          <p className="clf-form-description">
            Elegí el nivel de acceso al álbum. Por ahora es sólo referencia en el asistente; el alta del álbum sigue con
            los mismos campos de siempre.
          </p>

          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
            {SECURITY_MODE_CARDS.map((opt, i) => {
              const selected = securityMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSecurityMode(opt.value);
                    if (opt.value !== "private") setInvitedEmails([]);
                  }}
                  className={cn(
                    "box-border flex w-full min-w-0 gap-3 rounded-xl border p-4 text-left transition-all duration-150 sm:gap-4",
                    selected
                      ? "border-[#c27b3d] bg-[#fdf8f3] shadow-[0_0_0_1px_rgba(194,123,61,0.35)] ring-2 ring-[#c27b3d]/20"
                      : "border-[#e8e8e8] bg-[#fafafa] hover:border-[#d4d4d4] hover:bg-white hover:shadow-sm",
                    i === 2 && "sm:col-span-2",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12",
                      selected
                        ? "border-[#e8c4a8] bg-white text-[#c27b3d] shadow-sm"
                        : "border-[#e5e7eb] bg-white text-[#9ca3af]",
                    )}
                    aria-hidden
                  >
                    <opt.Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1a1a1a]">{opt.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6b7280] break-words sm:text-sm">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {(albumType === "SCHOOL" || albumType === "EVENT") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
              ⚠️ Recomendado para proteger la privacidad de menores de edad
            </div>
          )}

          {securityMode === "private" ? (
            <div className="clf-form-section rounded-xl border border-[#ebe8e4] bg-white p-5">
              <div className="flex w-full min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#fdfcfb] text-[#c27b3d]">
                  <Users className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 clf-form-section">
                  <div className="w-full min-w-0">
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">Invitaciones por mail</h3>
                    <p className="clf-form-description clf-form-description--sm mt-1">
                      Podés pegar varios separados por coma o espacio. Validamos antes de ir al resumen.
                    </p>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
                    <Input
                      type="text"
                      value={inviteEmailDraft}
                      onChange={(e) => setInviteEmailDraft(e.target.value)}
                      placeholder="ej: ana@ejemplo.com, luis@otro.ar"
                      className="min-w-0 flex-1 border-[#e5e7eb]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEmailsToInviteList();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" className="shrink-0" onClick={addEmailsToInviteList}>
                      Agregar
                    </Button>
                  </div>
                  {invitedEmails.length > 0 ? (
                    <ul className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-sm text-[#374151] space-y-1.5">
                      {invitedEmails.map((em) => (
                        <li key={em} className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{em}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs font-semibold text-[#c27b3d] hover:underline"
                            onClick={() =>
                              setInvitedEmails((prev) => prev.filter((x) => x.toLowerCase() !== em.toLowerCase()))
                            }
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#9ca3af]">Todavía no agregaste invitados.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {securityMode === "selfie" ? (
            <div className="clf-form-section rounded-xl border-2 border-[#c27b3d]/35 bg-gradient-to-br from-[#fffbf7] to-[#fdf8f3] p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#1a1a1a]">Recomendado para eventos con menores de edad</p>
              <p className="clf-form-description">
                Cada cliente podrá ver únicamente sus fotos mediante identificación validada por reconocimiento
                facial; el sistema solo le mostrará sus fotos. Ideal para escuelas y eventos deportivos.
              </p>
            </div>
          ) : null}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(isSchoolFlow ? schoolCoursesStep : 4)}>
              Atrás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setError(null);
                try {
                  assertSecurityStepOk();
                  setStep(reviewStep);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Revisá seguridad y privacidad.");
                }
              }}
            >
              Revisar y crear
            </Button>
          </div>
        </Card>
      )}

      {step === reviewStep && (
        <Card className={WIZARD_STEP_CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fdf8f3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c27b3d]">
              Listo
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">Confirmar y crear</h2>
          </div>
          <ul className="w-full min-w-0 max-w-[var(--clf-form-prose-max)] list-inside list-disc space-y-1 text-sm leading-relaxed text-[#4b5563] marker:text-[#c27b3d]/50">
            <li>
              <strong>Tipo de álbum:</strong> {albumTypeLabel} ({albumType})
            </li>
            <li>
              <strong>Título:</strong> {title.trim()}
            </li>
            <li>
              <strong>Lugar:</strong> {location.trim()}
            </li>
            {latitude !== null && longitude !== null ? (
              <li>
                <strong>Ubicación en mapa:</strong> {latitude.toFixed(5)} · {longitude.toFixed(5)}
              </li>
            ) : (
              <li>
                <strong>Ubicación en mapa:</strong> —
              </li>
            )}
            <li>
              <strong>Fecha y horario:</strong>{" "}
              {displayLabelForAlbumEventSchedule(eventSchedule) || "—"}
            </li>
            <li>
              <strong>Fotos digitales:</strong>{" "}
              {enableDigitalPhotos ? (
                <>
                  Activadas (
                  {(() => {
                    const n = parseWizardDigitalPriceWhole(digitalPhotoPrice);
                    return n != null ? formatARS(n) : <>${digitalPhotoPrice.trim()}</>;
                  })()}
                  {" · "}mín. {formatARS(Math.max(0, minDigitalPhotoPrice))})
                </>
              ) : (
                "Desactivadas"
              )}
            </li>
            <li>
              <strong>Fotos impresas:</strong>{" "}
              {enablePrintedPhotos
                ? `Activadas (${printPricingSource === "LAB_PREFERRED" ? "lab" : "mi lista"}, margen ${
                    albumProfitMarginPercent.trim() || "0"
                  }%, retira ${pickupBy === "CLIENT" ? "cliente" : "fotógrafo"}${
                    includeDigitalWithPrint
                      ? `, digital incluida (${digitalWithPrintDiscountPercent.trim() || "0"}% dto.)`
                      : ""
                  })`
                : "Desactivadas"}
            </li>
            <li>
              <strong>Mensaje de espera:</strong> {showComingSoonMessage ? "Activado" : "Desactivado"}
            </li>
            <li>
              <strong>Seguridad:</strong>{" "}
              {securityMode === "public"
                ? "Público"
                : securityMode === "private"
                  ? "Privado"
                  : "Privado con identificación (Selfie)"}
              {" · "}
              Cantidad de invitados: {securityMode === "private" ? String(invitedEmails.length) : "—"}
              {" · "}
              Modo privacidad activo:{" "}
              {securityMode === "public"
                ? "público — todas las fotos visibles con el link"
                : securityMode === "private"
                  ? "privado — sólo mails invitados"
                  : "privado por identificación / selfie"}
            </li>
            {albumType === "SCHOOL" && (
              <>
                <li>
                  <strong>Escuela:</strong>{" "}
                  {wizardSchoolId
                    ? schools.find((x) => x.id === parseInt(wizardSchoolId, 10))?.name ?? `ID ${wizardSchoolId}`
                    : "Sin vincular"}
                </li>
                <li>
                  <strong>Comisión escuela:</strong>{" "}
                  {organizerCommissionEnabled
                    ? `${organizerCommissionPct.trim() || "?"} % · (${Array.from(organizerAppliesTo).join(", ")})`
                    : "No activada"}
                </li>
                <li>
                  <strong>Cursos y padrón institucional:</strong>{" "}
                  {wizardAcademicYearId.trim()
                    ? (() => {
                        const yid = parseInt(wizardAcademicYearId.trim(), 10);
                        let yLabel = enrollmentSlotsPayload?.academicYears?.find((y) => y.id === yid)?.label;
                        if (!yLabel && enrollmentSlotsPayload?.academicYear?.id === yid) {
                          yLabel = enrollmentSlotsPayload.academicYear.label;
                        }
                        if (!yLabel) yLabel = `Año #${wizardAcademicYearId}`;
                        return `${yLabel} · ${selectedCourseKeys.size} curso(s) seleccionado(s) · ~${estimatedEnrollmentStudents} alumno(s) estimado(s)`;
                      })()
                    : "Sin año lectivo elegido en el paso de cursos (no se genera padrón automático desde matrícula)."}
                </li>
                {inviteName.trim() && inviteEmail.trim() && (
                  <li>
                    <strong>Invitación admin:</strong> {inviteName.trim()} · {inviteEmail.trim()}
                  </li>
                )}
              </>
            )}
          </ul>

          <div className="rounded-lg border border-[#e5e7eb] bg-[#fdf8f3] p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">Después de crear vas a poder afinar</h3>
            <ul className="text-sm text-[#4b5563] space-y-1.5 list-disc list-inside marker:text-[#c27b3d]">
              <li>Packs y productos en galería</li>
              <li>Preventa y plantillas si corresponde</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">Términos y condiciones</h3>
            <p className="text-xs text-[#6b7280]">
              Versión <span className="font-mono font-medium text-[#374151]">{TERMS_VERSION}</span>
            </p>
            <button
              type="button"
              onClick={() => setTermsTextOpen((v) => !v)}
              className="text-sm font-semibold text-[#c27b3d] hover:text-[#a0652d] underline underline-offset-2"
            >
              {termsTextOpen ? "Ocultar texto completo" : "Ver texto completo"}
            </button>
            {termsTextOpen ? (
              <div className="max-h-[min(420px,55vh)] overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-inner">
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#374151]">
                  {TERMS_TEXT}
                </pre>
              </div>
            ) : null}
            <label className="clf-wizard-check cursor-pointer rounded-lg border border-transparent bg-white/60 p-3 hover:bg-white">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[#c27b3d]"
                checked={termsAccepted}
                disabled={loading}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span className="clf-wizard-check__body text-sm leading-snug text-[#1a1a1a]">
                Confirmo que leí el texto anterior y acepto los términos y condiciones para crear este álbum en
                ComprameLaFoto.
              </span>
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-[#374151]" aria-live="polite">
              Creando álbum...
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => setStep(securityStep)}
            >
              Atrás
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading || mpConnected === false || !termsAccepted}
              onClick={submitCreate}
            >
              {loading ? "Creando álbum..." : "Crear álbum"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
