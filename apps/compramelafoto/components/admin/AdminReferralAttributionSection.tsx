"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate } from "@/lib/admin/helpers";

type Attribution = {
  id: number;
  referrerUserId: number;
  startsAt: string;
  endsAt: string;
  status: string;
  sourceType: string;
  isEffectivelyActive: boolean;
  referralCode: string;
  referrer: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    mpConnected: boolean;
  };
  earningsCount: number;
};

type ReferrerPick = {
  id: number;
  email: string;
  name: string | null;
  role: string;
};

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminReferralAttributionSection({
  referredUserId,
  referredEmail,
}: {
  referredUserId: number;
  referredEmail: string;
}) {
  const [loading, setLoading] = useState(true);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [referrerQuery, setReferrerQuery] = useState("");
  const [referrerResults, setReferrerResults] = useState<ReferrerPick[]>([]);
  const [searchingReferrer, setSearchingReferrer] = useState(false);
  const [selectedReferrer, setSelectedReferrer] = useState<ReferrerPick | null>(null);
  const [startsAt, setStartsAt] = useState(todayInputValue());
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${referredUserId}/referral-attribution`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error cargando referido");
      setAttribution(data.attribution ?? null);
      if (data.attribution?.referrer) {
        setSelectedReferrer(data.attribution.referrer);
        setStartsAt(data.attribution.startsAt.slice(0, 10));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando");
      setAttribution(null);
    } finally {
      setLoading(false);
    }
  }, [referredUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function searchReferrer() {
    const q = referrerQuery.trim();
    if (q.length < 2) {
      setReferrerResults([]);
      return;
    }
    setSearchingReferrer(true);
    try {
      const res = await fetch(
        `/api/admin/users?q=${encodeURIComponent(q)}&pageSize=20`,
        { credentials: "include" }
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
      if (!res.ok || !Array.isArray(list)) {
        setReferrerResults([]);
        return;
      }
      setReferrerResults(
        list
          .filter((u: ReferrerPick) => u.id !== referredUserId)
          .slice(0, 8)
      );
    } catch {
      setReferrerResults([]);
    } finally {
      setSearchingReferrer(false);
    }
  }

  async function handleSave() {
    if (!selectedReferrer) {
      setError("Elegí un usuario referidor.");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/admin/users/${referredUserId}/referral-attribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          referrerUserId: selectedReferrer.id,
          startsAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      setAttribution(data.attribution ?? null);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setInfo(data.created ? "Atribución creada." : "Atribución actualizada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (
      !window.confirm(
        "¿Eliminar la atribución de referido? También se borrarán las comisiones registradas para esta vinculación."
      )
    ) {
      return;
    }
    setRemoving(true);
    setError(null);
    setInfo(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/admin/users/${referredUserId}/referral-attribution`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar");
      setAttribution(null);
      setSelectedReferrer(null);
      setStartsAt(todayInputValue());
      setInfo(
        data.earningsRemoved > 0
          ? `Atribución eliminada (${data.earningsRemoved} comisión/es asociada/s).`
          : "Atribución eliminada."
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Referido (atribución manual)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Vinculá a <strong>{referredEmail}</strong> como referido de otro usuario. Las comisiones
        cuentan desde la fecha de inicio durante 1 año. Solo para correcciones de registros mal
        generados.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <div className="space-y-4">
          {attribution && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
              <p>
                <span className="font-medium">Referidor actual:</span>{" "}
                <Link
                  href={`/admin/usuarios/${attribution.referrer.id}`}
                  className="text-[#c27b3d] hover:underline"
                >
                  {attribution.referrer.name || attribution.referrer.email}
                </Link>{" "}
                ({attribution.referrer.email}) · código {attribution.referralCode}
              </p>
              <p>
                Vigencia: {formatDate(attribution.startsAt)} → {formatDate(attribution.endsAt)} ·{" "}
                {attribution.isEffectivelyActive ? (
                  <span className="text-emerald-700 font-medium">Activa</span>
                ) : (
                  <span className="text-amber-800 font-medium">
                    {attribution.status === "ACTIVE" ? "Vencida" : attribution.status}
                  </span>
                )}
              </p>
              <p className="text-xs text-emerald-800">
                Origen: {attribution.sourceType} · {attribution.earningsCount} comisión(es)
                registrada(s)
                {!attribution.referrer.mpConnected && (
                  <span className="block text-amber-900 mt-1">
                    El referidor no tiene MP conectado: no se generarán comisiones nuevas.
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Usuario referidor</label>
            <div className="flex flex-wrap gap-2">
              <Input
                type="text"
                placeholder="Buscar por email o nombre…"
                value={referrerQuery}
                onChange={(e) => setReferrerQuery(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={searchingReferrer}
                onClick={() => void searchReferrer()}
              >
                {searchingReferrer ? "Buscando…" : "Buscar"}
              </Button>
            </div>
            {referrerResults.length > 0 && (
              <ul className="border border-gray-200 rounded-lg divide-y max-h-40 overflow-y-auto">
                {referrerResults.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        selectedReferrer?.id === u.id ? "bg-amber-50" : ""
                      }`}
                      onClick={() => {
                        setSelectedReferrer(u);
                        setReferrerResults([]);
                        setReferrerQuery(`${u.name || u.email} (${u.email})`);
                      }}
                    >
                      #{u.id} · {u.name || "—"} · {u.email} · {u.role}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedReferrer && (
              <p className="text-xs text-gray-600">
                Seleccionado: #{selectedReferrer.id} {selectedReferrer.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="referral-starts-at" className="block text-sm font-medium text-gray-700 mb-1">
              Vigencia desde
            </label>
            <Input
              id="referral-starts-at"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              La atribución dura 1 año desde esta fecha (fin automático).
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-green-700 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              {info}
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="text-sm text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 list-disc pl-5 space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving || !selectedReferrer}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : attribution ? "Actualizar referidor" : "Asignar referidor"}
            </Button>
            {attribution && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={removing}
                onClick={() => void handleRemove()}
              >
                {removing ? "Eliminando…" : "Eliminar atribución"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
