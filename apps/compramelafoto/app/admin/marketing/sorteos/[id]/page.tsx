"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { PRIZE_STATUS_LABELS, STATUS_LABELS, type RafflePrizeStatus, type RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

type Winner = { id: number; name: string | null; email: string; phone: string | null; whatsapp: string | null; companyName: string | null };
type Prize = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  conditions: string | null;
  sponsorName: string | null;
  deliveryInstructions: string | null;
  estimatedValueArs: number | null;
  award: { id: string; status: RafflePrizeStatus; noticeError: string | null; notifiedAt: string | null } | null;
  winner: Winner | null;
  winnerEntry: { code: string; displayName: string } | null;
};
type Detail = {
  raffle: {
    id: string;
    title: string;
    description: string | null;
    kind: string;
    status: RaffleStatus;
    salesFrom: string;
    salesTo: string;
    minSales: number;
    entriesCloseAt: string;
    drawsAt: string;
    drandRound: number | null;
    entrantsHash: string | null;
    cancelReason: string | null;
    prizes: Prize[];
    events: { id: string; type: string; actorLabel: string | null; note: string | null; createdAt: string }[];
  };
  padron: { position: number; userId: number; code: string; displayName: string; salesCount: number }[];
  padronEnVivo: boolean;
  verificacion: { ok: boolean; mismatches: string[] } | null;
};

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const vacio = { title: "", description: "", sponsorName: "", deliveryInstructions: "", estimatedValueArs: "" };

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="text-gray-900">{children}</p>
    </div>
  );
}

export default function SorteoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [premio, setPremio] = useState(vacio);
  // La hora se toma al cargar, no al dibujar: decide qué botones se muestran.
  const [ahora, setAhora] = useState(0);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/sorteos/${id}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || "No se pudo cargar el sorteo.");
    else {
      setData(d);
      setAhora(Date.now());
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    setError(null);
    setAviso(null);
    const r = await fetch(`/api/admin/sorteos/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      if (d.waiting) setAviso(d.error);
      else setError(d.error || "No se pudo hacer.");
    } else if (ok) setAviso(ok);
    await cargar();
    return r.ok;
  }

  if (!data) return <p className="text-gray-500">{error ?? "Cargando…"}</p>;
  const { raffle: r, padron } = data;
  const borrador = r.status === "BORRADOR";
  const ultimoDia = new Date(new Date(r.salesTo).getTime() - 1);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/marketing/sorteos" className="text-sm text-gray-500 hover:underline">
          ← Sorteos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{r.title}</h1>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {STATUS_LABELS[r.status]} · {r.kind === "MENSUAL" ? "automático" : "manual"}
          </span>
        </div>
        {r.description && <p className="mt-1 text-sm text-gray-600">{r.description}</p>}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{aviso}</p>}

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 text-sm sm:grid-cols-2">
        <Dato label="Quiénes participan">
          Fotógrafos con {r.minSales <= 1 ? "al menos una venta pagada" : `al menos ${r.minSales} ventas pagadas`} del{" "}
          {formatArgentina(new Date(r.salesFrom), false)} al {formatArgentina(ultimoDia, false)}.
        </Dato>
        <Dato label="Cierre de la lista de participantes">{formatArgentina(new Date(r.entriesCloseAt))}</Dato>
        <Dato label="Sorteo">{formatArgentina(new Date(r.drawsAt))}</Dato>
        <Dato label="Número que decide">
          {r.drandRound ? `Tanda ${r.drandRound} de drand (fijada al anunciar)` : "Se fija al anunciar"}
        </Dato>
        {r.cancelReason && <Dato label="Motivo de la cancelación">{r.cancelReason}</Dato>}
      </section>

      <section className="flex flex-wrap gap-2">
        {borrador && (
          <Button disabled={busy} onClick={() => accion({ action: "announce" }, "Sorteo anunciado. Ya lo ven los fotógrafos en su panel.")}>
            Anunciar
          </Button>
        )}
        {r.status === "ANUNCIADO" && new Date(r.entriesCloseAt).getTime() <= ahora && (
          <Button disabled={busy} onClick={() => accion({ action: "seal" }, "Lista de participantes cerrada.")}>
            Cerrar la lista ahora
          </Button>
        )}
        {r.status === "PADRON_SELLADO" && new Date(r.drawsAt).getTime() <= ahora && (
          <Button disabled={busy} onClick={() => accion({ action: "resolve" }, "¡Sorteado! Los ganadores reciben el aviso por correo.")}>
            Sortear ahora
          </Button>
        )}
        {r.status === "SORTEADO" && r.prizes.some((p) => p.award?.status === "GANADO") && (
          <Button variant="secondary" disabled={busy} onClick={() => accion({ action: "notify" }, "Avisos encolados.")}>
            Avisar a los ganadores
          </Button>
        )}
        {(borrador || r.status === "ANUNCIADO") && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              const reason = window.prompt("¿Por qué se cancela? Queda escrito en la historia del sorteo.");
              if (reason) accion({ action: "cancel", reason }, "Sorteo cancelado.");
            }}
          >
            Cancelar sorteo
          </Button>
        )}
        {!borrador && r.status !== "CANCELADO" && (
          <a href={`/sorteos/${r.id}`} target="_blank" rel="noreferrer">
            <Button variant="outline">Ver la página pública</Button>
          </a>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Premios</h2>
        {r.prizes.length === 0 && <p className="text-sm text-gray-500">Todavía no hay premios.</p>}
        <div className="space-y-3">
          {r.prizes.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {p.order}. {p.title}
                    {p.sponsorName ? <span className="font-normal text-gray-500"> · {p.sponsorName}</span> : null}
                  </p>
                  {p.description && <p className="text-gray-600">{p.description}</p>}
                  {p.deliveryInstructions && <p className="text-gray-500">Entrega: {p.deliveryInstructions}</p>}
                  {p.estimatedValueArs ? (
                    <p className="text-gray-500">Valor estimado: ${p.estimatedValueArs.toLocaleString("es-AR")}</p>
                  ) : null}
                </div>
                {borrador && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => accion({ action: "removePrize", prizeId: p.id })}>
                    Quitar
                  </Button>
                )}
              </div>
              {p.award && (
                <div className="mt-3 rounded-lg bg-green-50 p-3">
                  <p className="font-medium text-green-900">
                    Ganó: {p.winner?.name || p.winnerEntry?.displayName || `cuenta N.º ${p.winnerEntry?.code}`}
                    {p.winner?.companyName ? ` (${p.winner.companyName})` : ""} · N.º {p.winnerEntry?.code}
                  </p>
                  {p.winner && (
                    <p className="text-green-900">
                      {p.winner.email}
                      {p.winner.whatsapp || p.winner.phone ? ` · ${p.winner.whatsapp || p.winner.phone}` : ""}
                    </p>
                  )}
                  <p className="text-green-800">
                    Estado: {PRIZE_STATUS_LABELS[p.award.status]}
                    {p.award.noticeError ? ` · ${p.award.noticeError}` : ""}
                  </p>
                  {(p.award.status === "GANADO" || p.award.status === "NOTIFICADO") && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => {
                        const note = window.prompt("¿Cómo se entregó? (opcional)") ?? "";
                        accion({ action: "awardStatus", awardId: p.award!.id, status: "ENTREGADO", note });
                      }}>
                        Marcar entregado
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                        const note = window.prompt("Detalle (opcional)") ?? "";
                        accion({ action: "awardStatus", awardId: p.award!.id, status: "NO_RETIRADO", note });
                      }}>
                        No lo retiró
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                        const note = window.prompt("¿Por qué se anula? Es obligatorio.");
                        if (note) accion({ action: "awardStatus", awardId: p.award!.id, status: "ANULADO", note });
                      }}>
                        Anular
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {borrador && (
          <form
            className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-white p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await accion({
                action: "addPrize",
                prize: { ...premio, estimatedValueArs: premio.estimatedValueArs ? Number(premio.estimatedValueArs) : null },
              });
              if (ok) setPremio(vacio);
            }}
          >
            <p className="text-sm font-medium text-gray-700">Agregar premio</p>
            <input className={input} placeholder="Premio (ej.: Mochila para cámara)" value={premio.title} onChange={(e) => setPremio({ ...premio, title: e.target.value })} required />
            <input className={input} placeholder="Quién lo da (opcional, ej.: CompraMeLaFoto)" value={premio.sponsorName} onChange={(e) => setPremio({ ...premio, sponsorName: e.target.value })} />
            <textarea className={input} rows={2} placeholder="Descripción (opcional)" value={premio.description} onChange={(e) => setPremio({ ...premio, description: e.target.value })} />
            <input className={input} placeholder="Cómo se entrega (va en el correo al ganador)" value={premio.deliveryInstructions} onChange={(e) => setPremio({ ...premio, deliveryInstructions: e.target.value })} />
            <input className={input} type="number" min={0} placeholder="Valor estimado en pesos (opcional)" value={premio.estimatedValueArs} onChange={(e) => setPremio({ ...premio, estimatedValueArs: e.target.value })} />
            <Button type="submit" size="sm" disabled={busy}>Agregar</Button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Participantes ({padron.length})
          {data.padronEnVivo && <span className="ml-2 text-sm font-normal text-gray-500">si la lista se cerrara ahora</span>}
        </h2>
        {r.entrantsHash && (
          <p className="break-all text-xs text-gray-500">
            Huella de la lista: <code>{r.entrantsHash}</code>
          </p>
        )}
        {data.verificacion && (
          <p className={`rounded-lg p-3 text-sm ${data.verificacion.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {data.verificacion.ok
              ? "Verificación: la lista y el resultado coinciden con la cuenta publicada."
              : `Verificación con diferencias: ${data.verificacion.mismatches.join(" ")}`}
          </p>
        )}
        {padron.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Posición</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cuenta</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fotógrafo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {padron.map((e) => (
                  <tr key={e.userId}>
                    <td className="px-4 py-2 text-gray-500">{e.position}</td>
                    <td className="px-4 py-2 text-gray-600">{e.code}</td>
                    <td className="px-4 py-2 text-gray-900">{e.displayName}</td>
                    <td className="px-4 py-2 text-gray-600">{e.salesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Historia</h2>
        <ul className="space-y-1 text-sm text-gray-600">
          {r.events.map((ev) => (
            <li key={ev.id}>
              <span className="text-gray-400">{formatArgentina(new Date(ev.createdAt))}</span> · {ev.type.replace(/_/g, " ").toLowerCase()}
              {ev.actorLabel ? ` · ${ev.actorLabel}` : ""}
              {ev.note ? ` · ${ev.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
