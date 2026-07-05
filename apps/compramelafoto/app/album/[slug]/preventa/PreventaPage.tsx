"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PreventaTermsAccordion from "@/components/preventa/PreventaTermsAccordion";
import PreventaSchoolStudentSection from "@/components/preventa/PreventaSchoolStudentSection";
import {
  getPreventaRequirements,
  getPublicStudentIdentificationPlan,
  isSchoolAlbum,
} from "@/lib/preventa-canjeable/preventa-mode";
import { AlbumTestModeClientBanner } from "@/components/album/AlbumTestModeNotice";
import {
  getSchoolReferralForAlbum,
  parseSchoolReferralRefParam,
  saveSchoolReferralForAlbumIfMissing,
} from "@/lib/school-organizer-referral-client";
import EmailConfirmationHint, {
  EMAIL_EMPTY_PLACEHOLDER_COPY,
} from "@/components/checkout/EmailConfirmationHint";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";

type PackBenefitLine = { line: string };

type Pack = {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl?: string | null;
  price: number;
  validFrom: string | null;
  validUntil: string | null;
  redemptionDeadlineAt: string | null;
  benefits: PackBenefitLine[];
};

type SchoolCourse = { id: number; name: string; division: string | null };

type Catalog = {
  album: {
    id: number;
    title: string;
    publicSlug: string;
    schoolId: number | null;
    preCompraCloseAt: string | null;
    requireClientApproval: boolean;
    photographer: { id: number; name: string | null; logoUrl: string | null } | null;
    lab: { id: number; name: string | null; logoUrl: string | null } | null;
    isSchool?: boolean;
    studentIdentificationMode?: string | null;
    allowManualStudentFallback?: boolean;
    /** true solo si el dueño autenticado previsualiza un álbum `isTest` */
    isTestPreview?: boolean;
    school?: { id: number; name: string; logoUrl?: string | null; courses: SchoolCourse[] } | null;
  };
  packs: Pack[];
  extrasHint?: {
    digitalExtraFromArs: number | null;
    printExtraFromArs: number | null;
  };
};

function formatDateBuyUntil(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function redemptionLabelForSelection(packs: Pack[], quantities: Record<number, number>): string | null {
  const selected = packs.filter((p) => (quantities[p.id] ?? 0) > 0);
  const dates = selected.map((p) => p.redemptionDeadlineAt).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  const minTs = Math.min(...dates.map((d) => new Date(d).getTime()));
  return formatDateBuyUntil(new Date(minTs).toISOString());
}

function singleSharedRedemption(packs: Pack[]): string | null {
  const dates = packs.map((p) => p.redemptionDeadlineAt).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  const uniq = new Set(dates.map((d) => new Date(d).getTime()));
  if (uniq.size !== 1) return null;
  return formatDateBuyUntil(new Date([...uniq][0]).toISOString());
}

function sharedPackCloseAt(packs: Pack[]): string | null {
  const dates = packs.map((p) => p.validUntil).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  const uniq = new Set(dates.map((d) => new Date(d).getTime()));
  if (uniq.size !== 1) return null;
  return new Date([...uniq][0]).toISOString();
}

function hasAnyPackCloseAt(packs: Pack[]): boolean {
  return packs.some((p) => p.validUntil != null);
}

const STEPS = [
  { title: "Comprás el pack ahora", text: "Reservás tu lugar con precio de preventa." },
  { title: "Se hace la sesión", text: "Las fotos se producen como siempre." },
  { title: "Te avisamos", text: "Cuando el álbum esté listo para elegir fotos." },
  { title: "Elegís tus fotos", text: "Marcás las que querés dentro de lo incluido." },
  { title: "Recibís todo", text: "Digitales por email; impresiones según lo acordado." },
];

/** Contenedor principal: min-w-0 evita que flex/grid encoja el contenido a columnas ridículas. */
const PAGE_SHELL = "w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";

function packGridClassName(packCount: number): string {
  if (packCount <= 1) {
    return "grid grid-cols-1 gap-6 lg:gap-8 w-full justify-items-stretch";
  }
  if (packCount === 2) {
    return "grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-6xl mx-auto";
  }
  return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 w-full";
}

function packCardMaxWidthClass(packCount: number): string {
  if (packCount <= 1) return "w-full min-w-0 max-w-4xl mx-auto";
  return "w-full min-w-0";
}

type PreventaPageProps = {
  /** Desde la página del álbum cuando el dueño ve un proyecto TEST */
  testClientPreview?: boolean;
};

export default function PreventaPage({ testClientPreview = false }: PreventaPageProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = String(params?.slug ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [schoolCourseId, setSchoolCourseId] = useState<number | null>(null);
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const submitAttemptKeyRef = useRef<string | null>(null);
  /** Padrón escolar (identificación nueva); null hasta elegir o cargar manual. */
  const [albumRosterEntryId, setAlbumRosterEntryId] = useState<number | null>(null);
  const [organizerReferralSchoolId, setOrganizerReferralSchoolId] = useState<number | null>(null);
  const [highlightPackId, setHighlightPackId] = useState<number | null>(null);
  const packFromUrlAppliedRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/album/${encodeURIComponent(slug)}/precompra`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No disponible");
        }
        return data as Catalog;
      })
      .then((data: Catalog) => {
        if (!data.extrasHint) {
          data.extrasHint = { digitalExtraFromArs: null, printExtraFromArs: null };
        }
        if (!data.packs?.[0]?.benefits) {
          data.packs = data.packs.map((p) => ({ ...p, benefits: p.benefits ?? [] }));
        }
        setCatalog(data);
      })
      .catch(() => setError("No se pudo cargar esta preventa o ya cerró."))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    setAlbumRosterEntryId(null);
  }, [slug, catalog?.album.id]);

  useEffect(() => {
    if (!catalog?.album?.id) return;
    const albumId = catalog.album.id;
    const albumSchoolId = catalog.album.schoolId ?? null;
    const refParam = searchParams.get("ref");
    const referralSchoolId = parseSchoolReferralRefParam(refParam);

    if (
      referralSchoolId != null &&
      albumSchoolId != null &&
      referralSchoolId === albumSchoolId
    ) {
      const saved = saveSchoolReferralForAlbumIfMissing({
        albumId,
        schoolId: referralSchoolId,
      });
      setOrganizerReferralSchoolId(saved.schoolId);
      return;
    }

    const persisted = getSchoolReferralForAlbum(albumId);
    if (persisted && persisted.albumId === albumId) {
      setOrganizerReferralSchoolId(persisted.schoolId);
      return;
    }
    setOrganizerReferralSchoolId(null);
  }, [catalog?.album?.id, catalog?.album?.schoolId, searchParams]);

  useEffect(() => {
    if (!catalog?.packs?.length || packFromUrlAppliedRef.current) return;
    const raw = searchParams.get("pack");
    if (!raw) return;
    const packId = Number(raw);
    if (!Number.isInteger(packId) || packId <= 0) return;
    if (!catalog.packs.some((p) => p.id === packId)) return;

    packFromUrlAppliedRef.current = true;
    setQuantities((prev) => ({ ...prev, [packId]: Math.max(1, prev[packId] ?? 0) }));
    setHighlightPackId(packId);

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`preventa-pack-${packId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    const clearHighlightTimer = window.setTimeout(() => setHighlightPackId(null), 4500);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [catalog, searchParams]);

  const handleQuantity = (packId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[packId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [packId]: next };
    });
  };

  // Regla única: SCHOOL cuando album.schoolId != null
  const isSchool = isSchoolAlbum(catalog?.album ?? null);
  const preventaReqs = getPreventaRequirements(catalog?.album ?? null);
  const identPlan = getPublicStudentIdentificationPlan(catalog?.album ?? null);
  const courses = catalog?.album?.school?.courses ?? [];

  const getSubmitAttemptKey = () => {
    if (submitAttemptKeyRef.current) return submitAttemptKeyRef.current;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `preventa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    submitAttemptKeyRef.current = `preventa-order:${slug}:${generated}`;
    return submitAttemptKeyRef.current;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    if (!catalog || !buyerEmail.trim()) {
      setSubmitting(false);
      return;
    }
    if (Boolean(testClientPreview || catalog.album.isTestPreview)) {
      setError("Este proyecto está en modo prueba. No se pueden generar pedidos reales.");
      setSubmitting(false);
      return;
    }
    const normalizedEmail = buyerEmail.trim();
    if (!buyerName.trim()) {
      setError(
        preventaReqs.requiresSchoolData
          ? "Necesitamos el nombre del adulto responsable."
          : "Necesitamos tu nombre y apellido."
      );
      setSubmitting(false);
      return;
    }
    if (!buyerPhone.trim()) {
      setError(
        preventaReqs.requiresSchoolData
          ? "Necesitamos un teléfono del adulto responsable."
          : "Necesitamos un teléfono de contacto."
      );
      setSubmitting(false);
      return;
    }
    const emailError = getCheckoutEmailValidationError(buyerEmail);
    if (emailError) {
      setError(emailError);
      setSubmitting(false);
      return;
    }
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([packDefinitionId, quantity]) => ({
        packDefinitionId: Number(packDefinitionId),
        quantity,
      }));
    if (items.length === 0) {
      setError("Elegí al menos un pack.");
      setSubmitting(false);
      return;
    }
    if (preventaReqs.requiresSchoolData) {
      if (identPlan.usesStudentIdentification) {
        if (albumRosterEntryId == null) {
          setError(
            identPlan.rosterEffectivelyRequired
              ? "Elegí un alumno de la lista del colegio para poder continuar."
              : "Antes de pagar: elegí un alumno de la lista o cargá los datos a mano (si el colegio lo permite)."
          );
          setSubmitting(false);
          return;
        }
      } else {
        if (!schoolCourseId) {
          setError("Seleccioná el curso o división.");
          setSubmitting(false);
          return;
        }
        if (!studentFirstName.trim() || !studentLastName.trim()) {
          setError("Completá nombre y apellido del alumno.");
          setSubmitting(false);
          return;
        }
        if (courses.length === 0) {
          setError("Falta información del curso. Escribile al fotógrafo.");
          setSubmitting(false);
          return;
        }
      }
    }
    const idempotencyKey = getSubmitAttemptKey();
    try {
      const body: Record<string, unknown> = {
        albumId: catalog.album.id,
        buyerEmail: normalizedEmail,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        items,
      };
      if (preventaReqs.requiresSchoolData) {
        if (identPlan.usesStudentIdentification) {
          body.albumRosterEntryId = albumRosterEntryId;
        } else {
          body.schoolCourseId = schoolCourseId;
          body.studentFirstName = studentFirstName.trim();
          body.studentLastName = studentLastName.trim();
        }
      }
      if (organizerReferralSchoolId != null) {
        body.organizerReferralSchoolId = organizerReferralSchoolId;
      }
      const res = await fetch("/api/precompra/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar el pedido");

      const preCompraOrderId = data.preCompraOrderId ?? data.order?.id;
      const albumOrderId = data.orderId;
      if (!preCompraOrderId || !albumOrderId) throw new Error("No se pudo iniciar el pedido");

      const prefRes = await fetch("/api/payments/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: albumOrderId, orderType: "ALBUM_ORDER" }),
      });
      const prefData = await prefRes.json();
      if (prefRes.ok && prefData?.initPoint) {
        window.location.href = prefData.initPoint;
        return;
      }
      router.push(`/order/${preCompraOrderId}/selfies`);
    } catch {
      submitAttemptKeyRef.current = null;
      setError("Hubo un problema preparando tu compra. Por favor intentá nuevamente.");
      setSubmitting(false);
    } finally {
      // Si todo sale bien, redirige y mantenemos el bloqueo para evitar doble submit.
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <p className="text-[#6b7280] text-sm">Cargando…</p>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl rounded-2xl border border-[#f1c4c4] bg-white p-6 sm:p-10 shadow-md">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="shrink-0 flex md:flex-col items-center md:items-start gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#fee2e2] text-red-600 text-xl">
                !
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#b91c1c] md:mt-2">
                Preventa no disponible
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a]">
                No se pudo cargar esta preventa
              </h1>
              <p className="text-sm sm:text-base text-[#6b7280] mt-3">{error}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-[#c27b3d] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#b26f36] transition-colors"
                >
                  Volver al inicio
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-[#e5e7eb] px-6 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors"
                >
                  Ir a la página principal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!catalog) return null;

  const isTestPreviewUi = Boolean(testClientPreview || catalog.album.isTestPreview);

  const packs = catalog.packs;
  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalArs = packs.reduce((sum, p) => sum + (quantities[p.id] ?? 0) * p.price, 0);
  const minPrice = Math.min(...packs.map((p) => p.price));

  const photographer = catalog.album.photographer;
  const lab = catalog.album.lab;
  const brandName = (lab?.name || photographer?.name || "").trim();
  const schoolLogoUrl = isSchool ? catalog.album.school?.logoUrl : null;
  const topBrandLogoUrl = photographer?.logoUrl || lab?.logoUrl || null;
  const topBrandAlt = photographer?.name || lab?.name || "";
  const schoolName = catalog.album.school?.name;
  const headerTitle = isSchool && schoolName ? schoolName : catalog.album.title;
  const showAlbumSubtitle =
    isSchool && schoolName && catalog.album.title.trim() !== schoolName.trim();

  const sharedCloseAt = sharedPackCloseAt(packs);
  const buyUntil = sharedCloseAt ? formatDateBuyUntil(sharedCloseAt) : null;
  const buyUntilHint =
    !buyUntil && hasAnyPackCloseAt(packs)
      ? "La fecha de cierre depende del pack que elijas."
      : null;
  const redemptionSelected = redemptionLabelForSelection(packs, quantities);
  const redemptionCommon = singleSharedRedemption(packs);
  const extras = catalog.extrasHint ?? { digitalExtraFromArs: null, printExtraFromArs: null };
  const hasExtras =
    (extras.digitalExtraFromArs != null && extras.digitalExtraFromArs > 0) ||
    (extras.printExtraFromArs != null && extras.printExtraFromArs > 0);

  const heroPriceLabel =
    totalItems > 0
      ? `$${totalArs.toLocaleString("es-AR")}`
      : packs.length === 1
        ? `$${packs[0].price.toLocaleString("es-AR")}`
        : `Desde $${minPrice.toLocaleString("es-AR")}`;

  const purchaseDeadlineLine = redemptionSelected
    ? `Tenés tiempo para usar lo comprado hasta el ${redemptionSelected}.`
    : redemptionCommon
      ? `Tenés tiempo para usar lo comprado hasta el ${redemptionCommon}.`
      : packs.some((p) => p.redemptionDeadlineAt)
        ? "El plazo para usar lo comprado depende del pack que elijas (lo ves al elegir cantidad)."
        : null;

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#fafafa] text-[#1a1a1a]">
      {isTestPreviewUi ? <AlbumTestModeClientBanner /> : null}
      <header className="bg-white border-b border-[#e8e8e8] pt-6 pb-6 sm:pt-8 sm:pb-8">
        <div className={`${PAGE_SHELL} flex flex-col gap-5 sm:gap-6`}>
          {topBrandLogoUrl ? (
            <div className="flex justify-center w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={topBrandLogoUrl}
                alt={topBrandAlt ? `Logo ${topBrandAlt}` : ""}
                className="h-24 w-auto max-w-[min(100%,16rem)] sm:h-28 object-contain object-center"
              />
            </div>
          ) : null}
          <div className="flex items-stretch gap-3 min-w-0">
            {schoolLogoUrl ? (
              <div className="shrink-0 self-stretch flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={schoolLogoUrl}
                  alt={schoolName ? `Escudo ${schoolName}` : ""}
                  className="h-full w-auto max-w-[4.5rem] sm:max-w-[5rem] rounded-xl object-contain bg-[#f3f4f6] border border-[#e5e7eb]"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d] mb-1">Preventa</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
                {headerTitle}
              </h1>
              {showAlbumSubtitle && (
                <p className="text-sm text-[#6b7280] mt-1">{catalog.album.title}</p>
              )}
              {brandName ? (
                <p className="text-xs text-[#9ca3af] mt-2">Fotos a cargo de {brandName}</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className={`${PAGE_SHELL} flex flex-col items-stretch gap-10 lg:gap-12 pt-6 sm:pt-8 pb-28 sm:pb-14 lg:pb-16`}>
        {/* 1 — Hero: items-stretch + w-full evita columna estrecha (flex/items-center sobre el padre). */}
        <section className="w-full min-w-0 max-w-6xl mx-auto rounded-2xl bg-white border border-[#e5e7eb] p-5 sm:p-8 lg:p-10 shadow-md">
          <div className="flex w-full min-w-0 flex-col items-stretch gap-5 sm:gap-6 text-center">
            <p className="w-full text-pretty text-[#4b5563] text-sm sm:text-base leading-relaxed">
              Reservá tu pack ahora y elegí tus fotos cuando estén listas.
            </p>
            <div className="w-full">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wide mb-2">Precio</p>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a1a1a] tabular-nums tracking-tight break-words">
                {heroPriceLabel}
              </p>
              {totalItems > 1 && (
                <p className="text-sm text-[#6b7280] mt-2">{totalItems} unidades</p>
              )}
            </div>
            {buyUntil ? (
              <p className="w-full text-sm sm:text-base font-medium text-[#374151] text-pretty">
                Podés comprar hasta el <span className="text-[#c27b3d]">{buyUntil}</span>
              </p>
            ) : null}
            <div className="flex w-full min-w-0 flex-col items-stretch gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                className="inline-flex w-full min-h-[3rem] items-center justify-center px-6 py-3.5 text-base font-semibold whitespace-nowrap"
                onClick={scrollToForm}
              >
                Comprar preventa
              </Button>
              <p className="text-xs text-[#6b7280]">Pago seguro online</p>
            </div>
          </div>
        </section>

        {/* Pack selection + qué incluye */}
        <form
          id="preventa-form"
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex w-full min-w-0 flex-col items-stretch gap-10 lg:gap-12"
        >
          <section className="w-full min-w-0 space-y-3 sm:space-y-4" id="elegi-pack">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">¿Qué incluye tu pack?</h2>
            <p className="text-sm sm:text-base text-[#6b7280] w-full sm:w-4/5">
              Elegí el pack que más te convenga y sumá unidades si necesitás más.
            </p>
          </section>

          {error && (
            <div className="w-full min-w-0 p-4 rounded-xl bg-red-50 text-red-800 text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className={`min-w-0 ${packGridClassName(packs.length)}`}>
            {packs.map((pack) => (
              <div
                key={pack.id}
                id={`preventa-pack-${pack.id}`}
                className={`${packCardMaxWidthClass(packs.length)} scroll-mt-24 rounded-2xl transition-shadow duration-300 ${
                  highlightPackId === pack.id
                    ? "ring-2 ring-[#c27b3d] ring-offset-2 shadow-lg"
                    : ""
                }`}
              >
                <Card className="overflow-hidden border-[#e5e7eb] rounded-2xl p-0 h-full flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200">
                  <div className="relative w-full aspect-square bg-gradient-to-br from-[#fef7f3] to-[#f3f4f6] border-b border-[#f0f0f0]">
                    {pack.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pack.coverImageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[#c27b3d] px-4 text-center">
                        Pack de preventa
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6 gap-4 min-h-0">
                    <div className="space-y-2">
                      <h3 className="text-lg sm:text-xl font-bold text-[#1a1a1a] leading-snug">
                        {pack.name}
                      </h3>
                      <p className="text-2xl sm:text-3xl font-bold text-[#c27b3d] tabular-nums tracking-tight">
                        ${pack.price.toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 sm:gap-4 py-1">
                      <button
                        type="button"
                        onClick={() => handleQuantity(pack.id, -1)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-[#e5e7eb] text-xl font-medium text-[#374151] hover:bg-[#fafafa] active:scale-[0.98] transition-transform"
                        aria-label="Menos"
                      >
                        −
                      </button>
                      <span className="min-w-[2.5rem] text-center text-lg font-bold tabular-nums">
                        {quantities[pack.id] ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantity(pack.id, 1)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-[#e5e7eb] text-xl font-medium text-[#374151] hover:bg-[#fafafa] active:scale-[0.98] transition-transform"
                        aria-label="Más"
                      >
                        +
                      </button>
                    </div>
                    {pack.benefits.length > 0 && (
                      <div className="border-t border-[#f3f4f6] pt-4 mt-auto space-y-3">
                        <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">
                          Qué incluye
                        </p>
                        <ul className="space-y-2.5">
                          {pack.benefits.map((b, i) => (
                            <li key={i} className="flex gap-3 text-sm sm:text-[15px] text-[#374151] leading-relaxed">
                              <span className="text-[#c27b3d] shrink-0 mt-0.5" aria-hidden>
                                ✓
                              </span>
                              <span className="min-w-0">{b.line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pack.description?.trim() ? (
                      <p className="text-sm text-[#6b7280] leading-relaxed border-t border-[#f3f4f6] pt-4">
                        {pack.description}
                      </p>
                    ) : null}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* 4 — Cómo funciona */}
          <section className="w-full min-w-0 space-y-4 sm:space-y-5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">¿Cómo funciona?</h2>
            <ol className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 list-none p-0 m-0">
              {STEPS.map((s, i) => (
                <li
                  key={i}
                  className="flex min-w-0 gap-3 rounded-2xl bg-white border border-[#e5e7eb] p-4 sm:p-5 shadow-md"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fef7f3] text-sm font-bold text-[#c27b3d]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1a1a] leading-snug">{s.title}</p>
                    <p className="text-sm text-[#6b7280] mt-1.5 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 5 — Extras */}
          {hasExtras && (
            <section className="w-full min-w-0 rounded-2xl bg-[#fffbf7] border border-[#c27b3d]/25 p-5 sm:p-6 shadow-md space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">¿Querés más fotos?</h2>
              <p className="text-sm sm:text-[15px] text-[#4b5563] leading-relaxed">
                Después de elegir las fotos del pack, podés sumar más si querés.{" "}
                <strong>Es aparte del precio de la preventa.</strong>
              </p>
              <ul className="text-sm space-y-2">
                {extras.digitalExtraFromArs != null && extras.digitalExtraFromArs > 0 ? (
                  <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 border-b border-[#c27b3d]/10 pb-2">
                    <span className="text-[#374151]">Foto digital extra</span>
                    <span className="font-bold tabular-nums text-[#c27b3d]">
                      ${extras.digitalExtraFromArs.toLocaleString("es-AR")} c/u
                    </span>
                  </li>
                ) : null}
                {extras.printExtraFromArs != null && extras.printExtraFromArs > 0 ? (
                  <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 pt-1">
                    <span className="text-[#374151]">Impresión extra</span>
                    <span className="font-bold tabular-nums text-[#c27b3d]">
                      ${extras.printExtraFromArs.toLocaleString("es-AR")} c/u
                    </span>
                  </li>
                ) : null}
              </ul>
            </section>
          )}

          {/* 7 — Info (máx. 5 puntos) */}
          <section className="w-full min-w-0 rounded-2xl bg-white border border-[#e5e7eb] p-5 sm:p-6 shadow-md space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">Información importante</h2>
            <ul className="text-sm sm:text-[15px] text-[#374151] space-y-2.5 list-disc pl-5 marker:text-[#c27b3d] leading-relaxed">
              {buyUntil ? <li>Podés comprar hasta el {buyUntil}.</li> : null}
              {!buyUntil && buyUntilHint ? <li>{buyUntilHint}</li> : null}
              {purchaseDeadlineLine ? <li>{purchaseDeadlineLine}</li> : null}
              <li>Elegís tus fotos cuando el álbum esté listo.</li>
              <li>
                {catalog.album.requireClientApproval
                  ? "Algunos contenidos pueden requerir aprobación antes de verlos."
                  : "Te avisamos cuando puedas entrar a elegir."}
              </li>
              <li>Las digitales llegan por email y las impresiones se coordinan con el fotógrafo o la institución.</li>
            </ul>
          </section>

          {/* 8 — Términos y condiciones */}
          {catalog.album.publicSlug ? (
            <section className="w-full min-w-0">
              <PreventaTermsAccordion albumSlug={catalog.album.publicSlug} />
            </section>
          ) : null}

          {/* 9 — Preventa escolar */}
          {preventaReqs.requiresSchoolData && (
            <section className="w-full min-w-0 rounded-2xl bg-white border border-[#e5e7eb] p-5 sm:p-6 shadow-md space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">Preventa escolar</h2>
              <p className="text-sm sm:text-[15px] text-[#4b5563] leading-relaxed">
                Vamos a pedir datos del alumno y del adulto responsable para identificar correctamente la compra.
              </p>
              <p className="text-sm sm:text-[15px] text-[#4b5563] leading-relaxed">
                Después de pagar podés cargar una selfie para encontrar más rápido las fotos del alumno. Es opcional.
              </p>
            </section>
          )}

          {preventaReqs.requiresSchoolData && identPlan.usesStudentIdentification && (
            <PreventaSchoolStudentSection
              slug={slug}
              plan={identPlan}
              selectedRosterEntryId={albumRosterEntryId}
              onSelectRosterEntry={setAlbumRosterEntryId}
            />
          )}

          {/* Formulario compra */}
          <section className="w-full min-w-0 rounded-2xl bg-white border border-[#e5e7eb] p-5 sm:p-6 lg:p-8 shadow-md space-y-5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">Tus datos</h2>
            {preventaReqs.requiresSchoolData ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#f9fafb] border border-[#e5e7eb] p-4">
                  <p className="text-sm font-semibold text-[#1a1a1a]">Datos para preventa escolar</p>
                  <p className="text-xs text-[#6b7280] mt-1">
                    {identPlan.usesStudentIdentification
                      ? "Datos del adulto responsable y contacto. El alumno lo cargaste arriba."
                      : "Usamos estos datos para asociar la compra al alumno."}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Adulto responsable <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Nombre y apellido"
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    placeholder="tu@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full"
                  />
                  {!buyerEmail.trim() ? (
                    <p className="text-xs text-[#6b7280] mt-1">
                      {EMAIL_EMPTY_PLACEHOLDER_COPY.preventa}
                    </p>
                  ) : null}
                  <EmailConfirmationHint
                    email={buyerEmail}
                    variant="preventa"
                    onApplySuggestion={setBuyerEmail}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="WhatsApp o celular"
                    required
                    className="w-full"
                  />
                </div>
                {!identPlan.usesStudentIdentification && (
                  <div className="pt-2 border-t border-[#f3f4f6]">
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-3">Alumno</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Nombre *</label>
                        <Input
                          value={studentFirstName}
                          onChange={(e) => setStudentFirstName(e.target.value)}
                          placeholder="Nombre"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Apellido *</label>
                        <Input
                          value={studentLastName}
                          onChange={(e) => setStudentLastName(e.target.value)}
                          placeholder="Apellido"
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-[#374151] mb-1">Curso / división *</label>
                      <select
                        value={schoolCourseId ?? ""}
                        onChange={(e) => setSchoolCourseId(e.target.value ? Number(e.target.value) : null)}
                        required
                        className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                      >
                        <option value="">Seleccionar…</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.division ? ` ${c.division}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#6b7280]">
                  Te vamos a enviar el comprobante y el acceso cuando esté listo el álbum.
                </p>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Nombre y apellido <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="Nombre y apellido"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    WhatsApp / teléfono <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="WhatsApp o celular"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    placeholder="Donde te enviamos el comprobante"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full"
                  />
                  {!buyerEmail.trim() ? (
                    <p className="text-xs text-[#6b7280] mt-1">
                      {EMAIL_EMPTY_PLACEHOLDER_COPY.preventa}
                    </p>
                  ) : null}
                  <EmailConfirmationHint
                    email={buyerEmail}
                    variant="preventa"
                    onApplySuggestion={setBuyerEmail}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div className="hidden sm:block w-full min-w-0 pt-2">
              <Button
                type="submit"
                variant="primary"
                className="inline-flex w-full min-h-[3rem] items-center justify-center py-3.5 text-base font-semibold whitespace-normal"
                disabled={
                  submitting ||
                  isTestPreviewUi ||
                  totalItems === 0 ||
                  (preventaReqs.requiresSchoolData &&
                    identPlan.usesStudentIdentification &&
                    albumRosterEntryId == null)
                }
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Redirigiendo al pago...
                  </span>
                ) : isTestPreviewUi ? (
                  "Vista simulada (sin pago)"
                ) : (
                  "Ir a pagar"
                )}
              </Button>
              {submitting ? (
                <p className="text-xs text-center text-[#374151] mt-2 font-medium">
                  Estamos preparando tu compra. No cierres esta pantalla.
                </p>
              ) : null}
              {isTestPreviewUi ? (
                <p className="text-xs text-center text-amber-900 mt-2">
                  En modo prueba no se puede avanzar al pago ni generar pedidos.
                </p>
              ) : null}
              {!isTestPreviewUi && totalItems === 0 && (
                <p className="text-xs text-center text-[#9ca3af] mt-2">Elegí al menos un pack arriba.</p>
              )}
            </div>
          </section>
        </form>
      </main>

      {/* Sticky móvil */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-[#e8e8e8] bg-white/95 backdrop-blur-md py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className={`${PAGE_SHELL} flex min-w-0 flex-col gap-2`}>
          {submitting ? (
            <p className="w-full text-center text-xs font-medium text-[#374151]">
              Estamos preparando tu compra. No cierres esta pantalla.
            </p>
          ) : null}
          <div className="flex min-w-0 items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-[#9ca3af]">Total</p>
            <p className="text-xl font-bold tabular-nums truncate">
              {totalItems > 0 ? `$${totalArs.toLocaleString("es-AR")}` : "—"}
            </p>
          </div>
          <Button
            type="submit"
            form="preventa-form"
            variant="primary"
            className="inline-flex shrink-0 min-w-[7.5rem] items-center justify-center px-5 py-3 font-semibold whitespace-normal"
            disabled={
              submitting ||
              isTestPreviewUi ||
              totalItems === 0 ||
              (preventaReqs.requiresSchoolData &&
                identPlan.usesStudentIdentification &&
                albumRosterEntryId == null)
            }
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Procesando...
              </span>
            ) : isTestPreviewUi ? (
              "Simulación"
            ) : (
              "Pagar"
            )}
          </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
