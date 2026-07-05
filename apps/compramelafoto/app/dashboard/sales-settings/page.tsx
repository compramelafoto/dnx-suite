"use client";

import { useState, useEffect } from "react";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type SalesSettings = {
  capabilities: string[];
  digitalEnabled: boolean;
  printsEnabled: boolean;
  retouchEnabled: boolean;
  expressEnabled: boolean;
  storageExtendEnabled: boolean;
  printsPriceListJson: unknown;
  printsFulfillmentJson: unknown;
  retouchPricingJson: unknown;
  expressPricingJson: unknown;
  storageExtendPricingJson: unknown;
  preferredLabId?: number | null;
};

type Lab = { id: number; name: string };

const FULFILLMENT_TYPES = {
  PHOTOGRAPHER_SHIP: "PHOTOGRAPHER_SHIP",
  PICKUP_LAB: "PICKUP_LAB",
  PICKUP_STUDIO: "PICKUP_STUDIO",
} as const;

function hasConfig(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "object" && !Array.isArray(val)) return Object.keys(val as object).length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return false;
}

function parseJsonOrNull(str: string): unknown {
  if (!str.trim()) return null;
  try {
    const v = JSON.parse(str);
    return typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function priceFromJson(val: unknown): string {
  if (val == null || typeof val !== "object") return "";
  const o = val as Record<string, unknown>;
  if (typeof o.price === "number") return String(o.price);
  if (typeof o.priceCents === "number") return String(Math.round(o.priceCents / 100));
  return "";
}

function getFulfillmentType(json: unknown): keyof typeof FULFILLMENT_TYPES | "" {
  if (json == null || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const t = String(o.type || "").toUpperCase();
  if (t === "PHOTOGRAPHER_SHIP" || t === "PICKUP_LAB" || t === "PICKUP_STUDIO") return t as keyof typeof FULFILLMENT_TYPES;
  if (t === "PICKUP" && String(o.address || "").toLowerCase().includes("estudio")) return "PICKUP_STUDIO";
  if (t === "PICKUP") return "PICKUP_STUDIO";
  if (t === "SHIP") return "PHOTOGRAPHER_SHIP";
  return "";
}

function getFulfillmentAddress(json: unknown): string {
  if (json == null || typeof json !== "object") return "";
  return String((json as Record<string, unknown>).address || "");
}

export default function SalesSettingsPage() {
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);

  const [digitalEnabled, setDigitalEnabled] = useState(true);
  const [printsEnabled, setPrintsEnabled] = useState(false);
  const [retouchEnabled, setRetouchEnabled] = useState(false);
  const [expressEnabled, setExpressEnabled] = useState(false);

  const [priceListSource, setPriceListSource] = useState<"lab" | "own">("own");
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [printsPriceListStr, setPrintsPriceListStr] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<keyof typeof FULFILLMENT_TYPES | "">("PICKUP_STUDIO");
  const [fulfillmentAddress, setFulfillmentAddress] = useState("");
  const [retouchPriceStr, setRetouchPriceStr] = useState("");
  const [expressPriceStr, setExpressPriceStr] = useState("");

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    (async () => {
      try {
        const [res, labsRes] = await Promise.all([
          fetch("/api/dashboard/sales-settings", { cache: "no-store" }),
          fetch("/api/labs", { cache: "no-store" }),
        ]);
        if (!res.ok) throw new Error("Error al cargar");
        const data = await res.json();
        setSettings(data);
        setDigitalEnabled(data.digitalEnabled !== false);
        setPrintsEnabled(Boolean(data.printsEnabled));
        setRetouchEnabled(Boolean(data.retouchEnabled));
        setExpressEnabled(Boolean(data.expressEnabled));
        setPrintsPriceListStr(data.printsPriceListJson ? JSON.stringify(data.printsPriceListJson, null, 2) : "");
        const ft = getFulfillmentType(data.printsFulfillmentJson);
        setFulfillmentType(ft || "PICKUP_STUDIO");
        setFulfillmentAddress(getFulfillmentAddress(data.printsFulfillmentJson) || "Tu estudio");
        setRetouchPriceStr(priceFromJson(data.retouchPricingJson));
        setExpressPriceStr(priceFromJson(data.expressPricingJson));
        setSelectedLabId(data.preferredLabId ?? null);
        if (data.preferredLabId != null) {
          setPriceListSource("lab");
        } else if (hasConfig(data.printsPriceListJson)) {
          setPriceListSource("own");
        }
        if (labsRes.ok) {
          const labsData = await labsRes.json();
          setLabs(Array.isArray(labsData) ? labsData : []);
        }
        if (data.storageExtendEnabled || hasConfig(data.storageExtendPricingJson)) {
          fetch("/api/dashboard/sales-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              storageExtendEnabled: false,
              storageExtendPricingJson: null,
            }),
          }).catch(() => {});
        }
      } catch (e) {
        setError("No se pudo cargar la configuración de ventas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let printsPriceListJson: unknown = null;
      let useOwnProductList = false;
      if (printsEnabled) {
        if (priceListSource === "lab" && selectedLabId) {
          const pricingRes = await fetch(`/api/public/lab-pricing?labId=${selectedLabId}`, { cache: "no-store" });
          if (!pricingRes.ok) throw new Error("No se pudo cargar la lista del laboratorio.");
          const pricing = await pricingRes.json();
          const list = Array.isArray(pricing.basePrices)
            ? pricing.basePrices.map((p: { size: string; unitPrice: number }) => ({ size: p.size, price: p.unitPrice }))
            : [];
          if (list.length === 0) throw new Error("El laboratorio no tiene lista de precios cargada.");
          printsPriceListJson = list;
        } else if (priceListSource === "own") {
          useOwnProductList = true;
        } else {
          printsPriceListJson = parseJsonOrNull(printsPriceListStr);
        }
      }

      let printsFulfillmentJson: unknown = null;
      if (printsEnabled && fulfillmentType) {
        if (fulfillmentType === "PHOTOGRAPHER_SHIP") {
          printsFulfillmentJson = { type: "PHOTOGRAPHER_SHIP" };
        } else if (fulfillmentType === "PICKUP_LAB") {
          printsFulfillmentJson = { type: "PICKUP_LAB" };
        } else {
          printsFulfillmentJson = { type: "PICKUP_STUDIO", address: fulfillmentAddress.trim() || "Tu estudio" };
        }
      }

      const retouchPrice = parseInt(retouchPriceStr, 10);
      const expressPrice = parseInt(expressPriceStr, 10);

      const res = await fetch("/api/dashboard/sales-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digitalEnabled,
          printsEnabled,
          retouchEnabled,
          expressEnabled,
          storageExtendEnabled: false,
          printsPriceListJson,
          printsFulfillmentJson,
          preferredLabId: priceListSource === "lab" ? selectedLabId : null,
          retouchPricingJson: Number.isFinite(retouchPrice) && retouchPrice >= 0 ? { price: retouchPrice } : null,
          expressPricingJson: Number.isFinite(expressPrice) && expressPrice >= 0 ? { price: expressPrice } : null,
          storageExtendPricingJson: null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const data = await res.json();
      setSettings(data);
      setSuccess("Configuración guardada.");
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const printsOk =
    printsEnabled &&
    (priceListSource === "lab" ? selectedLabId != null : priceListSource === "own" ? true : hasConfig(parseJsonOrNull(printsPriceListStr))) &&
    Boolean(fulfillmentType);
  const retouchOk = hasConfig(settings?.retouchPricingJson);
  const expressOk = hasConfig(settings?.expressPricingJson);

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <PhotographerDashboardHeader photographer={null} />
      <section className="ds-catalog-section !min-h-0 !py-8 md:!py-10">
        <div className="ds-catalog-shell">
          <div className="ds-catalog-stack">
            <header className="ds-catalog-prose-panel">
              <h1 className="ds-catalog-title">Configuración de ventas</h1>
              <p className="ds-catalog-subtitle">
                Activá los tipos de venta que querés ofrecer en tus álbumes. En cada álbum podés heredar
                esta configuración o personalizarla.
              </p>
            </header>

        {loading && <p className="text-sm text-[#6b7280]">Cargando…</p>}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {success}
          </div>
        )}

        {!loading && (
          <div className="ds-catalog-prose-panel ds-catalog-stack">
            <Card className="space-y-5 ds-card">
              {/* Ventas digitales */}
              <label className="flex flex-col gap-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={digitalEnabled}
                    onChange={(e) => setDigitalEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium">Ventas digitales</span>
                  <span className="text-green-600 text-sm">✅ Configurado</span>
                </div>
                <p className="text-xs text-[#6b7280] pl-6">
                  El cliente puede comprar la foto en formato digital. Se aplica en el carrito al elegir “descarga”.
                </p>
              </label>

              {/* Impresiones */}
              <label className="flex flex-col gap-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={printsEnabled}
                    onChange={(e) => setPrintsEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium">Impresiones</span>
                  {printsEnabled && (printsOk ? <span className="text-green-600 text-sm">✅ Configurado</span> : (
                    <button type="button" onClick={() => scrollTo("config-impresiones")} className="text-amber-600 text-sm underline hover:no-underline text-left">⚠️ Completá lista de precios y entrega</button>
                  ))}
                </div>
                <p className="text-xs text-[#6b7280] pl-6">
                  Ofrecé impresiones por tamaño. Se muestra cuando el cliente agrega fotos al carrito y elige “impresa”.
                </p>
              </label>

              {/* Retoque pro */}
              <label className="flex flex-col gap-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={retouchEnabled}
                    onChange={(e) => setRetouchEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium">Retoque pro</span>
                  {retouchEnabled && (retouchOk ? <span className="text-green-600 text-sm">✅ Configurado</span> : (
                    <button type="button" onClick={() => scrollTo("config-retoque")} className="text-amber-600 text-sm underline hover:no-underline text-left">⚠️ Falta precio</button>
                  ))}
                </div>
                <p className="text-xs text-[#6b7280] pl-6">
                  Opción de retoque profesional por foto. Se ofrece como add-on al comprar digital o impresa.
                </p>
              </label>

              {/* Entrega express */}
              <label className="flex flex-col gap-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={expressEnabled}
                    onChange={(e) => setExpressEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium">Entrega express</span>
                  {expressEnabled && (expressOk ? <span className="text-green-600 text-sm">✅ Configurado</span> : (
                    <button type="button" onClick={() => scrollTo("config-express")} className="text-amber-600 text-sm underline hover:no-underline text-left">⚠️ Falta precio</button>
                  ))}
                </div>
                <p className="text-xs text-[#6b7280] pl-6">
                  Cobro extra por envío o entrega prioritario. Se ofrece al finalizar el pedido de impresiones.
                </p>
              </label>

              <div className="pt-4">
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </Card>

            <div className="mt-8 space-y-6">
              <Card id="config-impresiones" className="p-4 scroll-mt-4">
                <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">Configuración de impresiones</h2>
                <p className="text-sm text-[#6b7280] mb-4">
                  Lista de precios y cómo se entregan las impresiones. Si no ofrecés impresiones, dejá todo sin configurar.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lista de precios</label>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceListSource"
                          checked={priceListSource === "lab"}
                          onChange={() => setPriceListSource("lab")}
                          className="text-[#c27b3d]"
                        />
                        <span>Usar lista de un laboratorio</span>
                      </label>
                      {priceListSource === "lab" && (
                        <select
                          value={selectedLabId ?? ""}
                          onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full max-w-3xl rounded border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Elegir laboratorio…</option>
                          {labs.map((lab) => (
                            <option key={lab.id} value={lab.id}>
                              {lab.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceListSource"
                          checked={priceListSource === "own"}
                          onChange={() => setPriceListSource("own")}
                          className="text-[#c27b3d]"
                        />
                        <span>Lista de precios propia</span>
                      </label>
                      {priceListSource === "own" && (
                        <p className="text-sm text-[#6b7280] pl-6 border border-[#e5e7eb] rounded-lg px-3 py-2 bg-[#f9fafb]">
                          Se usarán los precios de tu lista de productos (la que configurás en tu panel). Al guardar se tomarán los precios actuales.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">¿Quién entrega las impresiones?</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fulfillmentType"
                          checked={fulfillmentType === "PHOTOGRAPHER_SHIP"}
                          onChange={() => setFulfillmentType("PHOTOGRAPHER_SHIP")}
                          className="text-[#c27b3d]"
                        />
                        <span>Las entrego yo (el fotógrafo)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fulfillmentType"
                          checked={fulfillmentType === "PICKUP_LAB"}
                          onChange={() => setFulfillmentType("PICKUP_LAB")}
                          className="text-[#c27b3d]"
                        />
                        <span>El cliente retira en el laboratorio</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fulfillmentType"
                          checked={fulfillmentType === "PICKUP_STUDIO"}
                          onChange={() => setFulfillmentType("PICKUP_STUDIO")}
                          className="text-[#c27b3d]"
                        />
                        <span>El cliente retira en mi estudio / dirección</span>
                      </label>
                      {fulfillmentType === "PICKUP_STUDIO" && (
                        <Input
                          type="text"
                          placeholder="Ej: Tu estudio, Av. Siempre Viva 123"
                          value={fulfillmentAddress}
                          onChange={(e) => setFulfillmentAddress(e.target.value)}
                          className="mt-2 w-full max-w-3xl"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card id="config-retoque" className="p-4 scroll-mt-4">
                <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">Precio retoque pro</h2>
                <p className="text-sm text-[#6b7280] mb-3">Precio en pesos (ARS) por retoque profesional.</p>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ej: 1500"
                  value={retouchPriceStr}
                  onChange={(e) => setRetouchPriceStr(e.target.value)}
                  className="max-w-[200px]"
                />
              </Card>

              <Card id="config-express" className="p-4 scroll-mt-4">
                <h2 className="text-lg font-medium text-[#1a1a1a] mb-2">Precio entrega express</h2>
                <p className="text-sm text-[#6b7280] mb-3">Precio en pesos (ARS) por envío express.</p>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ej: 2000"
                  value={expressPriceStr}
                  onChange={(e) => setExpressPriceStr(e.target.value)}
                  className="max-w-[200px]"
                />
              </Card>
            </div>
          </div>
        )}
          </div>
        </div>
      </section>
    </div>
  );
}
