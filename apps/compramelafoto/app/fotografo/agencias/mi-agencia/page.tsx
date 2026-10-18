"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import AgencyMapPicker from "@/components/agencies/AgencyMapPicker";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Agency = {
  id: number; name: string; description: string | null; defaultCommissionBps: number; defaultCommissionLabel: string;
  directoryListed: boolean; directoryLat: number | null; directoryLng: number | null; directoryRadiusKm: number;
  directoryCity: string | null; notFoundSearchEnabled: boolean; termsText: string | null; termsEffective: string;
};
type Member = { id: number; name: string; email: string; commissionLabel: string; usesDefault: boolean; needsTerms: boolean; requestMessage: string | null };
type Place = { id: number; name: string; lat: number; lng: number };

const HELP = AGENCY_SECTIONS.find((s) => s.id === "mi-agencia")!.help;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo salió mal. Probá de nuevo.");
  return data;
}

function CreateAgency({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Creá tu agencia</h2>
      <p className="text-sm text-[#6b7280]">Después vas a poder invitar a tu equipo y elegir qué álbumes son de la agencia.</p>
      <label className="block text-sm font-medium">Nombre de la agencia
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Fotoshow Estudio" />
      </label>
      <label className="block text-sm font-medium">Porcentaje general para cada fotógrafo (%)
        <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await api("/api/fotografo/agencias/mi-agencia", { method: "POST", body: JSON.stringify({ name, defaultCommissionPercent: percent }) });
            onCreated();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Crear agencia
      </Button>
    </Card>
  );
}

function TeamSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const d = await api("/api/fotografo/agencias/mi-agencia/equipo");
      setMembers(d.members);
      setRequests(d.requests);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (id: number, body: object) => {
    setError(null);
    try {
      await api(`/api/fotografo/agencias/mi-agencia/equipo/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Equipo</h2>
      <div className="space-y-2">
        <p className="text-sm text-[#6b7280]">Mandale este link a cada fotógrafo. Al entrar, acepta tus condiciones y queda en el equipo.</p>
        <p className="text-sm text-[#6b7280]">Si ya mandaste un link, generar uno nuevo deja sin efecto el anterior.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const d = await api("/api/fotografo/agencias/mi-agencia/invitacion", { method: "POST" });
              setInviteUrl(d.url);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {inviteUrl ? "Generar otro link (el anterior deja de andar)" : "Generar link de invitación"}
        </Button>
        {inviteUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs">{inviteUrl}</code>
            <Button size="sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copiar</Button>
          </div>
        )}
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Solicitudes para sumarse</h3>
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-medium">{r.name}</p>
                {r.requestMessage && <p className="text-sm text-[#6b7280]">“{r.requestMessage}”</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(r.id, { action: "accept" })}>Aceptar</Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, { action: "reject" })}>Rechazar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Fotógrafos ({members.length})</h3>
        {members.length === 0 && <p className="text-sm text-[#6b7280]">Todavía no hay nadie en tu equipo.</p>}
        {members.map((m) => (
          <MemberRow key={m.id} member={m} onCommission={(percent) => act(m.id, { action: "setCommission", percent })} onRemove={() => {
            if (confirm(`¿Dar de baja a ${m.name}? Ya no va a poder subir fotos; sus ventas se le siguen pagando.`)) act(m.id, { action: "remove" });
          }} />
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function MemberRow({ member, onCommission, onRemove }: { member: Member; onCommission: (p: string) => void; onRemove: () => void }) {
  const [value, setValue] = useState(member.usesDefault ? "" : member.commissionLabel.replace(" %", "").replace(",", "."));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
      <div>
        <p className="font-medium">{member.name}</p>
        <p className="text-xs text-[#6b7280]">
          {member.commissionLabel}{member.usesDefault ? " (general)" : ""}
          {member.needsTerms ? " · tiene que aceptar las condiciones nuevas" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input className="w-24" value={value} onChange={(e) => setValue(e.target.value)} placeholder="general" inputMode="decimal" />
        <Button size="sm" variant="outline" onClick={() => onCommission(value)}>Guardar %</Button>
        <Button size="sm" variant="secondary" onClick={onRemove}>Dar de baja</Button>
      </div>
    </div>
  );
}

function AlbumsSection() {
  const [linked, setLinked] = useState<Array<{ albumId: number; title: string; publicSlug: string }>>([]);
  const [available, setAvailable] = useState<Array<{ albumId: number; title: string }>>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia/albumes").catch((e) => {
      setError((e as Error).message);
      return { linked: [], available: [] };
    });
    setLinked(d.linked);
    setAvailable(d.available);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Álbumes de la agencia</h2>
      <p className="text-sm text-[#6b7280]">Sólo tu equipo puede subir fotos a estos álbumes. Los precios y la venta se configuran como en cualquier álbum.</p>
      {linked.map((l) => (
        <div key={l.albumId} className="flex items-center justify-between rounded-xl border p-3">
          <a className="font-medium underline" href={`/dashboard/albums/${l.albumId}`}>{l.title}</a>
          <Button size="sm" variant="outline" onClick={async () => {
            await api(`/api/fotografo/agencias/mi-agencia/albumes?albumId=${l.albumId}`, { method: "DELETE" }).catch((e) => setError((e as Error).message));
            load();
          }}>Quitar de la agencia</Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <select className="rounded-xl border px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Elegí uno de tus álbumes…</option>
          {available.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
        </select>
        <Button size="sm" disabled={!selected} onClick={async () => {
          setError(null);
          await api("/api/fotografo/agencias/mi-agencia/albumes", { method: "POST", body: JSON.stringify({ albumId: Number(selected) }) }).catch((e) => setError((e as Error).message));
          setSelected("");
          load();
        }}>Sumar a la agencia</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function PlacesSection() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia/lugares").catch(() => ({ places: [] }));
    setPlaces(d.places);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Lugares frecuentes</h2>
      <p className="text-sm text-[#6b7280]">Balnearios, miradores, pistas… Tu equipo los elige rápido al subir fotos desde una cámara sin GPS.</p>
      <ul className="space-y-1">
        {places.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>{p.name}</span>
            <button className="text-red-600 underline" onClick={async () => {
              await api(`/api/fotografo/agencias/mi-agencia/lugares?id=${p.id}`, { method: "DELETE" }).catch(() => {});
              load();
            }}>Borrar</button>
          </li>
        ))}
      </ul>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del lugar, ej.: Playa Grande" />
      <AgencyMapPicker lat={point?.lat ?? null} lng={point?.lng ?? null} onChange={(lat, lng) => setPoint({ lat, lng })} />
      <Button size="sm" disabled={!name || !point} onClick={async () => {
        setError(null);
        try {
          await api("/api/fotografo/agencias/mi-agencia/lugares", { method: "POST", body: JSON.stringify({ name, ...point }) });
          setName("");
          setPoint(null);
          load();
        } catch (e) {
          setError((e as Error).message);
        }
      }}>Agregar lugar</Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function SettingsSection({ agency, onSaved }: { agency: Agency; onSaved: (a: Agency) => void }) {
  const [form, setForm] = useState({
    name: agency.name,
    description: agency.description ?? "",
    defaultCommissionPercent: String(agency.defaultCommissionBps / 100),
    directoryListed: agency.directoryListed,
    directoryLat: agency.directoryLat,
    directoryLng: agency.directoryLng,
    directoryRadiusKm: String(agency.directoryRadiusKm),
    directoryCity: agency.directoryCity ?? "",
    notFoundSearchEnabled: agency.notFoundSearchEnabled,
    termsText: agency.termsText ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Configuración</h2>
      <label className="block text-sm font-medium">Nombre<Input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="block text-sm font-medium">Descripción (se ve en el directorio)
        <textarea className="mt-1 w-full rounded-xl border p-3 text-sm" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Porcentaje general para cada fotógrafo (%)
        <Input value={form.defaultCommissionPercent} onChange={(e) => set("defaultCommissionPercent", e.target.value)} inputMode="decimal" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notFoundSearchEnabled} onChange={(e) => set("notFoundSearchEnabled", e.target.checked)} />
        Permitir “No me encuentro”: el cliente elige día, hora y lugar y ve sólo esas fotos sin selfie.
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.directoryListed} onChange={(e) => set("directoryListed", e.target.checked)} />
        Aparecer en el Directorio de agencias para que te pidan sumarse.
      </label>
      {form.directoryListed && (
        <div className="space-y-2">
          <Input value={form.directoryCity} onChange={(e) => set("directoryCity", e.target.value)} placeholder="Ciudad, ej.: Mar del Plata" />
          <AgencyMapPicker lat={form.directoryLat} lng={form.directoryLng} onChange={(lat, lng) => setForm((f) => ({ ...f, directoryLat: lat, directoryLng: lng }))} />
          <label className="block text-sm">Radio de trabajo (km)<Input value={form.directoryRadiusKm} onChange={(e) => set("directoryRadiusKm", e.target.value)} inputMode="numeric" /></label>
        </div>
      )}
      <label className="block text-sm font-medium">Condiciones para tu equipo (si lo dejás vacío se usan las de abajo)
        <textarea className="mt-1 w-full rounded-xl border p-3 text-sm" rows={6} value={form.termsText} onChange={(e) => set("termsText", e.target.value)} placeholder={agency.termsEffective} />
      </label>
      <p className="text-xs text-[#6b7280]">Si cambiás las condiciones, tu equipo tiene que aceptarlas de nuevo antes de seguir subiendo.</p>
      <Button onClick={async () => {
        setMsg(null);
        try {
          const d = await api("/api/fotografo/agencias/mi-agencia", { method: "PATCH", body: JSON.stringify(form) });
          onSaved(d.agency);
          setMsg("Guardado.");
        } catch (e) {
          setMsg((e as Error).message);
        }
      }}>Guardar</Button>
      {msg && <p className="text-sm">{msg}</p>}
    </Card>
  );
}

export default function MiAgenciaPage() {
  const [agency, setAgency] = useState<Agency | null | undefined>(undefined);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia").catch(() => ({ agency: null }));
    setAgency(d.agency);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <AgencyPageFrame title="Mi agencia" subtitle={HELP}>
      {agency === undefined && <p className="text-gray-600">Cargando...</p>}
      {agency === null && <CreateAgency onCreated={load} />}
      {agency && (
        <div className="space-y-6">
          <TeamSection />
          <AlbumsSection />
          <PlacesSection />
          <SettingsSection agency={agency} onSaved={setAgency} />
        </div>
      )}
    </AgencyPageFrame>
  );
}
