"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsInfoPanel } from "@/components/ui/DsLayout";

export type AlbumPricingSnapshot = {
  digitalPhotoPriceCents: number | null;
  digitalDiscount5Plus: number | null;
  digitalDiscount10Plus: number | null;
  digitalDiscount20Plus: number | null;
  printPricingSource: "PHOTOGRAPHER" | "LAB_PREFERRED";
  albumProfitMarginPercent: number | null;
  selectedLabId: number | null;
  pickupBy: "CLIENT" | "PHOTOGRAPHER" | null;
  includeDigitalWithPrint?: boolean;
  digitalWithPrintDiscountPercent?: number | null;
  selectedLab?: {
    id: number;
    name: string;
    city?: string | null;
    province?: string | null;
  } | null;
};

type LabOption = { id: number; name: string; city?: string | null; province?: string | null };

export type AlbumPricingSectionProps = {
  albumId: number;
  active: boolean;
  album: AlbumPricingSnapshot;
  organizerLocksAlbumDigitalPricing: boolean;
  minDigitalPhotoPrice: number | null;
  printsActive: boolean;
  onDigitalPriceInputChange?: (value: string) => void;
  onSaved: (patch: Partial<AlbumPricingSnapshot>) => void;
  onError?: (message: string) => void;
};

function formatArs(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return "Sin configurar";
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function numToInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export default function AlbumPricingSection({
  albumId,
  active,
  album,
  organizerLocksAlbumDigitalPricing,
  minDigitalPhotoPrice,
  printsActive,
  onDigitalPriceInputChange,
  onSaved,
  onError,
}: AlbumPricingSectionProps) {
  const [digitalPrice, setDigitalPrice] = useState("");
  const [discount5, setDiscount5] = useState("");
  const [discount10, setDiscount10] = useState("");
  const [discount20, setDiscount20] = useState("");
  const [printPricingSource, setPrintPricingSource] = useState<"PHOTOGRAPHER" | "LAB_PREFERRED">(
    "PHOTOGRAPHER"
  );
  const [marginPercent, setMarginPercent] = useState("");
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [pickupBy, setPickupBy] = useState<"CLIENT" | "PHOTOGRAPHER">("CLIENT");
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [preferredLabId, setPreferredLabId] = useState<number | null>(null);
  const [savingDigital, setSavingDigital] = useState(false);
  const [savingPrints, setSavingPrints] = useState(false);
  const [digitalSuccess, setDigitalSuccess] = useState<string | null>(null);
  const [printsSuccess, setPrintsSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDigitalPrice(numToInput(album.digitalPhotoPriceCents));
    setDiscount5(numToInput(album.digitalDiscount5Plus));
    setDiscount10(numToInput(album.digitalDiscount10Plus));
    setDiscount20(numToInput(album.digitalDiscount20Plus));
    setPrintPricingSource(album.printPricingSource ?? "PHOTOGRAPHER");
    setMarginPercent(numToInput(album.albumProfitMarginPercent));
    setSelectedLabId(album.selectedLabId);
    setPickupBy(album.pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT");
  }, [album]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/labs", { cache: "no-store" }),
      fetch("/api/dashboard/sales-settings", { cache: "no-store" }),
    ])
      .then(async ([labsRes, salesRes]) => {
        if (cancelled) return;
        if (labsRes.ok) {
          const data = await labsRes.json().catch(() => []);
          setLabs(Array.isArray(data) ? data : []);
        }
        if (salesRes.ok) {
          const data = await salesRes.json().catch(() => ({}));
          const pref =
            typeof data.preferredLabId === "number" && Number.isFinite(data.preferredLabId)
              ? data.preferredLabId
              : null;
          setPreferredLabId(pref);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLabs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, albumId]);

  const effectiveLabLabel = useMemo(() => {
    if (album.selectedLab?.name) {
      const loc = [album.selectedLab.city, album.selectedLab.province].filter(Boolean).join(", ");
      return loc ? `${album.selectedLab.name} (${loc})` : album.selectedLab.name;
    }
    if (selectedLabId != null) {
      const lab = labs.find((l) => l.id === selectedLabId);
      if (lab) {
        const loc = [lab.city, lab.province].filter(Boolean).join(", ");
        return loc ? `${lab.name} (${loc})` : lab.name;
      }
    }
    if (printPricingSource === "LAB_PREFERRED" && preferredLabId != null) {
      const lab = labs.find((l) => l.id === preferredLabId);
      if (lab) return `${lab.name} (preferido en tu cuenta)`;
    }
    return "Sin laboratorio asignado";
  }, [album.selectedLab, selectedLabId, labs, preferredLabId, printPricingSource]);

  const pricingSourceLabel =
    printPricingSource === "PHOTOGRAPHER" ? "Mi lista de productos" : "Laboratorio";

  const handleDigitalPriceChange = (value: string) => {
    setDigitalPrice(value);
    onDigitalPriceInputChange?.(value);
  };

  async function saveDigital() {
    if (organizerLocksAlbumDigitalPricing) return;
    setSavingDigital(true);
    setDigitalSuccess(null);
    try {
      const trimmed = digitalPrice.trim().replace(",", ".");
      let parsed: number | null = null;
      if (trimmed) {
        parsed = Math.round(parseFloat(trimmed));
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("Ingresá un precio digital válido.");
        }
        const min = minDigitalPhotoPrice ?? 5000;
        if (parsed < min) {
          throw new Error(`El precio mínimo es ${formatArs(min)}.`);
        }
      }

      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digitalPhotoPriceCents: parsed,
          digitalDiscount5Plus: discount5.trim() === "" ? null : parseFloat(discount5),
          digitalDiscount10Plus: discount10.trim() === "" ? null : parseFloat(discount10),
          digitalDiscount20Plus: discount20.trim() === "" ? null : parseFloat(discount20),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar el precio digital");
      }
      onSaved({
        digitalPhotoPriceCents: data.digitalPhotoPriceCents ?? parsed,
        digitalDiscount5Plus: data.digitalDiscount5Plus ?? null,
        digitalDiscount10Plus: data.digitalDiscount10Plus ?? null,
        digitalDiscount20Plus: data.digitalDiscount20Plus ?? null,
      });
      setDigitalSuccess("Precio digital guardado.");
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : "No se pudo guardar el precio digital");
    } finally {
      setSavingDigital(false);
    }
  }

  async function savePrints() {
    setSavingPrints(true);
    setPrintsSuccess(null);
    try {
      if (printPricingSource === "LAB_PREFERRED" && selectedLabId == null) {
        throw new Error("Elegí un laboratorio para este álbum.");
      }
      const marginRaw = marginPercent.trim().replace(",", ".");
      if (marginRaw === "") {
        throw new Error("El margen de ganancia es obligatorio (podés usar 0).");
      }
      const margin = parseFloat(marginRaw);
      if (!Number.isFinite(margin) || margin < 0) {
        throw new Error("El margen debe ser un número mayor o igual a 0.");
      }

      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printPricingSource,
          albumProfitMarginPercent: margin,
          selectedLabId: printPricingSource === "LAB_PREFERRED" ? selectedLabId : null,
          pickupBy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar impresiones");
      }
      const savedLab = labs.find((l) => l.id === (data.selectedLabId ?? selectedLabId));
      onSaved({
        printPricingSource: data.printPricingSource ?? printPricingSource,
        albumProfitMarginPercent: data.albumProfitMarginPercent ?? margin,
        selectedLabId: data.selectedLabId ?? null,
        pickupBy: data.pickupBy ?? pickupBy,
        selectedLab: savedLab
          ? { id: savedLab.id, name: savedLab.name, city: savedLab.city, province: savedLab.province }
          : null,
      });
      setPrintsSuccess("Configuración de impresiones guardada.");
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : "No se pudo guardar impresiones");
    } finally {
      setSavingPrints(false);
    }
  }

  return (
    <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
      <div className="ds-form-stack w-full max-w-[60rem] gap-8">
        <div className="ds-content-container w-full space-y-2">
          <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Precios del álbum</h2>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
            Definí cuánto cobrás por foto digital y cómo se calculan las impresiones en este álbum.
          </p>
        </div>

        <section
          id="album-ventas-precio-digital"
          className="scroll-mt-24 w-full min-w-0 space-y-5 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5"
        >
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Foto digital</h3>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
              Este es el precio de cada foto digital que el cliente puede comprar y descargar desde la
              galería.
            </p>
          </div>

          {organizerLocksAlbumDigitalPricing ? (
            <DsInfoPanel title="Precio definido por el organizador">
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#374151] m-0">
                En este evento colaborativo el organizador fija el precio digital. No podés modificarlo
                desde tu álbum.
              </p>
            </DsInfoPanel>
          ) : (
            <div className="ds-form-stack w-full gap-4">
              <div className="w-full min-w-0 space-y-2">
                <label className="block text-sm font-medium text-[#1a1a1a]">
                  Precio digital del álbum (ARS)
                </label>
                <Input
                  type="number"
                  min={minDigitalPhotoPrice ?? 0}
                  step="1"
                  placeholder={
                    minDigitalPhotoPrice ? `Mínimo ${minDigitalPhotoPrice}` : "Ej: 5000"
                  }
                  value={digitalPrice}
                  onChange={(e) => handleDigitalPriceChange(e.target.value)}
                  disabled={savingDigital}
                  className="w-full"
                />
                {minDigitalPhotoPrice ? (
                  <p className="ds-intro-prose ds-intro-prose--fluid text-xs text-[#6b7280] m-0">
                    Precio mínimo del sistema: {formatArs(minDigitalPhotoPrice)}
                  </p>
                ) : null}
              </div>

              <div className="w-full min-w-0 space-y-3">
                <p className="text-sm font-medium text-[#1a1a1a] m-0">
                  Descuentos por cantidad (opcional)
                </p>
                <div className="grid w-full gap-3 sm:grid-cols-1">
                  <div className="w-full min-w-0 space-y-2">
                    <label className="block text-sm font-medium text-[#374151]">5+ fotos (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discount5}
                      onChange={(e) => setDiscount5(e.target.value)}
                      disabled={savingDigital}
                      className="w-full"
                    />
                  </div>
                  <div className="w-full min-w-0 space-y-2">
                    <label className="block text-sm font-medium text-[#374151]">10+ fotos (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discount10}
                      onChange={(e) => setDiscount10(e.target.value)}
                      disabled={savingDigital}
                      className="w-full"
                    />
                  </div>
                  <div className="w-full min-w-0 space-y-2">
                    <label className="block text-sm font-medium text-[#374151]">20+ fotos (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discount20}
                      onChange={(e) => setDiscount20(e.target.value)}
                      disabled={savingDigital}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto whitespace-nowrap"
                  disabled={savingDigital}
                  onClick={() => void saveDigital()}
                >
                  {savingDigital ? "Guardando…" : "Guardar precio digital"}
                </Button>
                {digitalSuccess ? (
                  <p className="text-sm text-emerald-700 m-0">{digitalSuccess}</p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section
          id="album-ventas-impresiones"
          className="scroll-mt-24 w-full min-w-0 space-y-5 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5"
        >
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Impresiones</h3>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
              Las impresiones se calculan usando un precio base y tu margen de ganancia. El precio final
              del cliente también incluye el fee de plataforma.
            </p>
          </div>

          <dl className="m-0 grid w-full min-w-0 gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]">
            <div className="min-w-0 w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280] m-0">Estado</dt>
              <dd className="mt-1 text-sm font-semibold text-[#1a1a1a] m-0">
                {printsActive ? "Activas" : "Inactivas"}
              </dd>
            </div>
            <div className="min-w-0 w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280] m-0">
                Origen de precios
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1a1a1a] m-0 break-words">
                {pricingSourceLabel}
              </dd>
            </div>
            <div className="min-w-0 w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280] m-0">
                Laboratorio efectivo
              </dt>
              <dd className="ds-readable-text ds-readable-text--fluid mt-1 text-sm font-semibold text-[#1a1a1a] m-0">
                {effectiveLabLabel}
              </dd>
            </div>
          </dl>

          <div className="ds-form-stack w-full gap-4">
            <div className="w-full min-w-0 space-y-3">
              <p className="text-sm font-medium text-[#1a1a1a] m-0">Origen de precios</p>
              <div className="flex flex-col gap-2 w-full">
                <label className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                  <input
                    type="radio"
                    name="album-print-pricing-source"
                    checked={printPricingSource === "PHOTOGRAPHER"}
                    onChange={() => setPrintPricingSource("PHOTOGRAPHER")}
                    className="shrink-0"
                  />
                  <span className="text-sm text-[#1a1a1a]">Mi lista de productos</span>
                </label>
                <label className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                  <input
                    type="radio"
                    name="album-print-pricing-source"
                    checked={printPricingSource === "LAB_PREFERRED"}
                    onChange={() => setPrintPricingSource("LAB_PREFERRED")}
                    className="shrink-0"
                  />
                  <span className="text-sm text-[#1a1a1a]">Laboratorio</span>
                </label>
              </div>
            </div>

            <div className="w-full min-w-0 space-y-2">
              <label className="block text-sm font-medium text-[#1a1a1a]">
                Margen de ganancia del álbum (%)
              </label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 0"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                disabled={savingPrints}
                className="w-full"
              />
              <p className="ds-intro-prose ds-intro-prose--fluid text-xs text-[#6b7280] m-0">
                Se suma sobre el precio base antes del fee de plataforma.
              </p>
            </div>

            {printPricingSource === "LAB_PREFERRED" ? (
              <>
                <div className="w-full min-w-0 space-y-2">
                  <label className="block text-sm font-medium text-[#1a1a1a]">
                    Laboratorio para este álbum
                  </label>
                  <select
                    value={selectedLabId ?? ""}
                    onChange={(e) =>
                      setSelectedLabId(e.target.value ? Number(e.target.value) : null)
                    }
                    disabled={savingPrints}
                    className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#1a1a1a]"
                  >
                    <option value="">Elegir laboratorio…</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                        {lab.city ? ` — ${lab.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full min-w-0 space-y-3">
                  <p className="text-sm font-medium text-[#1a1a1a] m-0">Retiro / entrega</p>
                  <div className="flex flex-col gap-2 w-full">
                    <label className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                      <input
                        type="radio"
                        name="album-pickup-by"
                        checked={pickupBy === "CLIENT"}
                        onChange={() => setPickupBy("CLIENT")}
                        className="shrink-0"
                      />
                      <span className="text-sm text-[#1a1a1a]">El cliente retira en el laboratorio</span>
                    </label>
                    <label className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] px-4 py-3">
                      <input
                        type="radio"
                        name="album-pickup-by"
                        checked={pickupBy === "PHOTOGRAPHER"}
                        onChange={() => setPickupBy("PHOTOGRAPHER")}
                        className="shrink-0"
                      />
                      <span className="text-sm text-[#1a1a1a]">Yo entrego las fotos</span>
                    </label>
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full sm:w-auto whitespace-nowrap"
                disabled={savingPrints}
                onClick={() => void savePrints()}
              >
                {savingPrints ? "Guardando…" : "Guardar impresiones"}
              </Button>
              {printsSuccess ? (
                <p className="text-sm text-emerald-700 m-0">{printsSuccess}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 w-full pt-2 border-t border-[#e5e7eb]">
              <Link
                href="/fotografo/configuracion?tab=productos"
                prefetch={false}
                className="text-sm font-medium text-[#c27b3d] hover:underline w-fit"
              >
                Editar mi lista de productos impresos →
              </Link>
              <Link
                href="/dashboard/sales-settings#config-impresiones"
                prefetch={false}
                className="text-sm font-medium text-[#6b7280] hover:text-[#c27b3d] hover:underline w-fit"
              >
                Ver configuración global de impresiones →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
