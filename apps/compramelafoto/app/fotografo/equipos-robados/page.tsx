"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

/**
 * Denuncia de equipos robados. Por ahora no tiene link en el menú: se comparte la
 * dirección a quien la necesite. El fotógrafo sólo ve el estado de sus denuncias;
 * las coincidencias las ve únicamente el administrador.
 */

type Report = {
  id: number;
  kind: "BODY" | "LENS";
  make: string;
  model: string;
  serialRaw: string;
  stolenAt: string;
  status: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "RECOVERED" | "WITHDRAWN";
  rejectionReason: string | null;
  createdAt: string;
};

type Detected = {
  kind: "BODY" | "LENS";
  make: string;
  model: string;
  serialRaw: string;
  lastSeenAt: string;
  photosCount: number;
};

const STATUS: Record<Report["status"], { label: string; tone: string; hint: string }> = {
  PENDING_REVIEW: {
    label: "En revisión",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    hint: "Estamos revisando la factura. Cuando se apruebe, empieza la búsqueda.",
  },
  ACTIVE: {
    label: "Buscando",
    tone: "bg-blue-50 text-blue-800 border-blue-200",
    hint: "Revisamos todos los días las fotos que se suben a CompramelaFoto. Si aparece, te contactamos.",
  },
  REJECTED: { label: "No aprobada", tone: "bg-red-50 text-red-800 border-red-200", hint: "" },
  RECOVERED: { label: "Recuperado", tone: "bg-green-50 text-green-800 border-green-200", hint: "" },
  WITHDRAWN: { label: "Retirada", tone: "bg-gray-100 text-gray-600 border-gray-200", hint: "" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Achica fotos grandes a JPG de 2000 px para no pasar el límite de subida. Los PDF van tal cual. */
async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const EMPTY_FORM = {
  kind: "BODY" as "BODY" | "LENS",
  make: "",
  model: "",
  serial: "",
  stolenAt: "",
  stolenPlace: "",
  policeReportNumber: "",
  description: "",
};

export default function EquiposRobadosPage() {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [detected, setDetected] = useState<Detected[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [policeReport, setPoliceReport] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [fileInputsKey, setFileInputsKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/fotografo/equipos-robados", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setReports(data.reports ?? []);
    setDetected(data.detected ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => active && d && setPhotographer(d))
        .catch(() => {});
      await load();
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [router, load]);

  function pickDetected(value: string) {
    if (!value) return;
    const d = detected[Number(value)];
    if (!d) return;
    setForm((f) => ({ ...f, kind: d.kind, make: d.make, model: d.model, serial: d.serialRaw }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (!invoice) {
      setError("Adjuntá la factura de compra.");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("invoice", await prepareFile(invoice));
      if (policeReport) fd.append("policeReport", await prepareFile(policeReport));
      const res = await fetch("/api/fotografo/equipos-robados", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo enviar la denuncia.");
        return;
      }
      setForm(EMPTY_FORM);
      setInvoice(null);
      setPoliceReport(null);
      setFileInputsKey((k) => k + 1);
      setOkMsg("Denuncia enviada. La revisamos y, si está todo bien, empieza la búsqueda.");
      await load();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  async function closeReport(id: number, action: "withdraw" | "recovered") {
    const q =
      action === "recovered"
        ? "¿Recuperaste el equipo? La búsqueda se detiene."
        : "¿Retirar la denuncia? La búsqueda se detiene.";
    if (!window.confirm(q)) return;
    await fetch(`/api/fotografo/equipos-robados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer as never} />
      <div className="container-custom py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Denunciar un equipo robado</h1>
            <p className="text-sm text-gray-600 mt-2">
              Cada foto que se sube a CompramelaFoto trae grabado el número de serie de la cámara y, muchas veces,
              el del lente. Si tu equipo robado empieza a usarse acá, hoy o dentro de meses, lo vamos a detectar.
              La búsqueda es privada: sólo la ve el equipo de CompramelaFoto, que te va a contactar.
            </p>
          </div>

          <Card className="p-5">
            <form onSubmit={submit} className="space-y-4">
              {detected.length > 0 && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">¿Es uno de tus equipos que ya conocemos?</span>
                  <Select className="mt-1 w-full" defaultValue="" onChange={(e) => pickDetected(e.target.value)}>
                    <option value="">Elegí uno o completá a mano</option>
                    {detected.map((d, i) => (
                      <option key={`${d.kind}-${d.serialRaw}`} value={i}>
                        {d.kind === "LENS" ? "Lente" : "Cámara"} · {d.make} {d.model} · serie {d.serialRaw} · última foto{" "}
                        {fmtDate(d.lastSeenAt)}
                      </option>
                    ))}
                  </Select>
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Tipo</span>
                  <Select className="mt-1 w-full" value={form.kind} onChange={set("kind")}>
                    <option value="BODY">Cámara</option>
                    <option value="LENS">Lente</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Número de serie *</span>
                  <Input className="mt-1 w-full" value={form.serial} onChange={set("serial")} required maxLength={80} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Marca *</span>
                  <Input className="mt-1 w-full" value={form.make} onChange={set("make")} required maxLength={80} placeholder="Canon, Nikon, Sony…" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Modelo *</span>
                  <Input className="mt-1 w-full" value={form.model} onChange={set("model")} required maxLength={120} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Fecha del robo *</span>
                  <Input className="mt-1 w-full" type="date" value={form.stolenAt} onChange={set("stolenAt")} required />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Lugar</span>
                  <Input className="mt-1 w-full" value={form.stolenPlace} onChange={set("stolenPlace")} maxLength={200} placeholder="Ciudad, barrio" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-800">N° de denuncia policial</span>
                  <Input className="mt-1 w-full" value={form.policeReportNumber} onChange={set("policeReportNumber")} maxLength={80} />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-800">¿Qué pasó? ¿Algo que lo identifique?</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={set("description")}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2" key={fileInputsKey}>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Factura de compra *</span>
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setInvoice(e.target.files?.[0] ?? null)}
                    required
                  />
                  <span className="text-xs text-gray-500">Foto o PDF. Sirve para confirmar que el equipo es tuyo.</span>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Denuncia policial (opcional)</span>
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setPoliceReport(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}
              {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

              <Button type="submit" disabled={sending}>
                {sending ? "Enviando…" : "Enviar denuncia"}
              </Button>
            </form>
          </Card>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Mis denuncias</h2>
            {!ready ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no cargaste ninguna.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => {
                  const st = STATUS[r.status];
                  const open = r.status === "PENDING_REVIEW" || r.status === "ACTIVE";
                  return (
                    <Card key={r.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900 m-0">
                            {r.kind === "LENS" ? "Lente" : "Cámara"} {r.make} {r.model}
                          </p>
                          <p className="text-sm text-gray-600 m-0">
                            Serie {r.serialRaw} · robada el {fmtDate(r.stolenAt)}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded border ${st.tone}`}>{st.label}</span>
                      </div>
                      {st.hint && <p className="text-xs text-gray-500 mt-2 m-0">{st.hint}</p>}
                      {r.status === "REJECTED" && r.rejectionReason && (
                        <p className="text-sm text-red-700 mt-2 m-0">Motivo: {r.rejectionReason}</p>
                      )}
                      {open && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button size="sm" variant="outline" onClick={() => closeReport(r.id, "recovered")}>
                            Lo recuperé
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => closeReport(r.id, "withdraw")}>
                            Retirar denuncia
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
