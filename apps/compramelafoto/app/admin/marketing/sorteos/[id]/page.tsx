"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  ExternalLink,
  Gift,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import { dsTextareaClassName } from "@/components/ui/form-control-classes";
import ImageUpload from "@/components/raffles/ImageUpload";
import PrizeForm, { emptyPrize, type PrizeDraft } from "@/components/raffles/PrizeForm";
import SponsorsEditor, { type SponsorDraft } from "@/components/raffles/SponsorsEditor";
import StatusBadge from "@/components/raffles/StatusBadge";
import RaffleStepper from "@/components/raffles/RaffleStepper";
import { PRIZE_STATUS_LABELS, type RafflePrizeStatus, type RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

type Winner = { id: number; name: string | null; email: string; phone: string | null; whatsapp: string | null; companyName: string | null };
type Prize = PrizeDraft & {
  id: string;
  order: number;
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
    coverImageUrl: string | null;
    sponsors: SponsorDraft[];
    sealedAt: string | null;
    drawnAt: string | null;
    createdAt: string;
    prizes: Prize[];
    events: { id: string; type: string; actorLabel: string | null; note: string | null; createdAt: string }[];
  };
  padron: { position: number; userId: number; code: string; displayName: string; salesCount: number }[];
  padronEnVivo: boolean;
  verificacion: { ok: boolean; mismatches: string[] } | null;
};

/** Una pregunta con texto (motivo, nota) en una ventana, en vez del cuadro del navegador. */
type Pregunta = {
  title: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  confirm: string;
  danger?: boolean;
  onConfirm: (texto: string) => void;
};

const fecha = (v: string | null | undefined, hora = true) => (v ? formatArgentina(new Date(v), hora) : "");

function Card({ title, icon, actions, children }: { title: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#111827]/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#111827]">
          {icon}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function SorteoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // La hora se toma al cargar, no al dibujar: decide qué botones se muestran.
  const [ahora, setAhora] = useState(0);
  // Premio en edición: null = cerrado; sin id = premio nuevo.
  const [editando, setEditando] = useState<(PrizeDraft & { id?: string }) | null>(null);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [portada, setPortada] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<SponsorDraft[]>([]);
  const [lookCambiado, setLookCambiado] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/sorteos/${id}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || "No se pudo cargar el sorteo.");
    else {
      setData(d);
      setPortada(d.raffle.coverImageUrl ?? null);
      setSponsors(d.raffle.sponsors ?? []);
      setLookCambiado(false);
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

  function preguntar(p: Pregunta) {
    setRespuesta("");
    setPregunta(p);
  }

  if (!data) return <p className="p-6 text-[#6b7280]">{error ?? "Cargando…"}</p>;
  const { raffle: r, padron } = data;
  const borrador = r.status === "BORRADOR";
  const vivo = r.status !== "CANCELADO";
  const ultimoDia = new Date(new Date(r.salesTo).getTime() - 1);
  const cierrePasado = new Date(r.entriesCloseAt).getTime() <= ahora;
  const sorteoPasado = new Date(r.drawsAt).getTime() <= ahora;
  const pendientesDeAviso = r.prizes.some((p) => p.award?.status === "GANADO");
  const filtrados = busqueda.trim()
    ? padron.filter((e) => `${e.displayName} ${e.code}`.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : padron;

  // El próximo paso, explicado, con su botón cuando corresponde.
  let paso: { titulo: string; texto: string; boton?: React.ReactNode } | null = null;
  if (borrador) {
    paso = {
      titulo: r.prizes.length ? "Listo para anunciar" : "Cargá al menos un premio",
      texto: r.prizes.length
        ? "Al anunciarlo lo ven los fotógrafos en su panel y en la página pública. Después ya no se cambian las fechas ni el orden de los premios."
        : "Sin premios no se puede anunciar. Sumá los premios con su foto y el logo de quien los da.",
      boton: (
        <Button disabled={busy || r.prizes.length === 0} onClick={() => accion({ action: "announce" }, "Sorteo anunciado. Ya lo ven los fotógrafos en su panel.")}>
          Anunciar sorteo
        </Button>
      ),
    };
  } else if (r.status === "ANUNCIADO") {
    paso = cierrePasado
      ? {
          titulo: "Ya terminó el período de ventas",
          texto: "La lista se cierra sola en la próxima hora. Si no querés esperar, cerrala ahora.",
          boton: <Button disabled={busy} onClick={() => accion({ action: "seal" }, "Lista de participantes cerrada.")}>Cerrar la lista ahora</Button>,
        }
      : {
          titulo: "Juntando participantes",
          texto: `Entra solo cada fotógrafo que venda en el período. La lista se cierra sola el ${fecha(r.entriesCloseAt)}.`,
        };
  } else if (r.status === "PADRON_SELLADO") {
    paso = sorteoPasado
      ? {
          titulo: "Llegó la hora del sorteo",
          texto: "Se sortea solo en la próxima hora. Podés hacerlo ahora: a los ganadores les llega el correo.",
          boton: <Button disabled={busy} onClick={() => accion({ action: "resolve" }, "¡Sorteado! Los ganadores reciben el aviso por correo.")}>Sortear ahora</Button>,
        }
      : {
          titulo: "Lista cerrada, esperando el sorteo",
          texto: `Se sortea solo el ${fecha(r.drawsAt)}, con el número de la tanda ${r.drandRound} de drand.`,
        };
  } else if (r.status === "SORTEADO") {
    paso = {
      titulo: pendientesDeAviso ? "Falta avisar a algún ganador" : "Coordiná las entregas",
      texto: pendientesDeAviso
        ? "Hay ganadores sin el correo enviado. Reintentá el aviso."
        : "Cuando entregues cada premio, marcalo como entregado. Con todos resueltos, el sorteo se cierra.",
      boton: pendientesDeAviso ? (
        <Button disabled={busy} onClick={() => accion({ action: "notify" }, "Avisos encolados.")}>
          Avisar a los ganadores
        </Button>
      ) : undefined,
    };
  } else if (r.status === "CERRADO") {
    paso = { titulo: "Sorteo terminado", texto: "Todos los premios están resueltos." };
  }

  async function guardarPremio() {
    if (!editando) return;
    const ok = editando.id
      ? await accion({ action: "updatePrize", prizeId: editando.id, prize: editando }, "Premio guardado.")
      : await accion({ action: "addPrize", prize: editando }, "Premio agregado.");
    if (ok) setEditando(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/marketing/sorteos" className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#111827]">
        <ArrowLeft className="h-4 w-4" /> Sorteos
      </Link>

      {/* Encabezado con la portada */}
      <header className="overflow-hidden rounded-3xl border border-[#111827]/10 bg-white shadow-sm">
        <div className="relative h-40 bg-gradient-to-br from-[#2a1d12] via-[#5b3a1f] to-[#c27b3d] sm:h-48">
          {r.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- portada subida a R2
            <img src={r.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                {r.kind === "MENSUAL" ? "Automático" : "Manual"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{r.title}</h1>
            {r.description && <p className="mt-1 max-w-3xl text-sm text-white/85">{r.description}</p>}
          </div>
        </div>
        {vivo ? (
          <div className="border-t border-[#111827]/5 px-4 py-5 sm:px-8">
            <RaffleStepper
              status={r.status}
              dates={{
                BORRADOR: fecha(r.createdAt, false),
                PADRON_SELLADO: fecha(r.sealedAt ?? r.entriesCloseAt, false),
                SORTEADO: fecha(r.drawnAt ?? r.drawsAt, false),
              }}
            />
          </div>
        ) : (
          <p className="border-t border-[#111827]/5 bg-[#fef2f2] px-6 py-4 text-sm text-[#b91c1c]">
            Cancelado{r.cancelReason ? `: ${r.cancelReason}` : "."}
          </p>
        )}
      </header>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">{aviso}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {/* Próximo paso */}
          {paso && (
            <section className="flex flex-col gap-4 rounded-3xl border border-[#c27b3d]/25 bg-gradient-to-r from-[#fdf6ef] to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#c27b3d]">Próximo paso</p>
                <p className="mt-1 text-lg font-bold text-[#111827]">{paso.titulo}</p>
                <p className="mt-1 text-sm text-[#4b5563]">{paso.texto}</p>
              </div>
              {paso.boton && <div className="shrink-0">{paso.boton}</div>}
            </section>
          )}

          {/* Premios */}
          <Card
            title={`Premios (${r.prizes.length})`}
            icon={<Gift className="h-5 w-5 text-[#c27b3d]" />}
            actions={
              borrador ? (
                <Button size="sm" onClick={() => setEditando({ ...emptyPrize })}>
                  <Plus className="h-4 w-4" /> Agregar premio
                </Button>
              ) : null
            }
          >
            {r.prizes.length === 0 ? (
              <button
                type="button"
                onClick={() => borrador && setEditando({ ...emptyPrize })}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#111827]/15 py-12 text-[#6b7280] hover:border-[#c27b3d]/60"
              >
                <Gift className="h-8 w-8 text-[#c27b3d]" />
                <span className="font-semibold text-[#374151]">Todavía no hay premios</span>
                {borrador && <span className="text-sm">Tocá para cargar el primero</span>}
              </button>
            ) : (
              <ul className="space-y-3">
                {r.prizes.map((p, i) => (
                  <li key={p.id} className="overflow-hidden rounded-2xl border border-[#111827]/10">
                    <div className="flex gap-4 p-3 sm:p-4">
                      <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#fdf3ea] to-[#eec9a4] sm:h-28 sm:w-36">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- fotos subidas a R2
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Gift className="absolute inset-0 m-auto h-8 w-8 text-[#c27b3d]/60" />
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-[#c27b3d]">
                          {p.order}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-[#111827]">{p.title}</p>
                          {vivo && (
                            <div className="flex shrink-0 items-center gap-0.5">
                              {borrador && (
                                <>
                                  <button type="button" disabled={busy || i === 0} onClick={() => accion({ action: "movePrize", prizeId: p.id, dir: "up" })} className="rounded-full p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-30" aria-label="Subir">
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button type="button" disabled={busy || i === r.prizes.length - 1} onClick={() => accion({ action: "movePrize", prizeId: p.id, dir: "down" })} className="rounded-full p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-30" aria-label="Bajar">
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => setEditando({ ...p })} className="rounded-full p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Editar">
                                <Pencil className="h-4 w-4" />
                              </button>
                              {borrador && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => accion({ action: "removePrize", prizeId: p.id })}
                                  className="rounded-full p-1.5 text-[#6b7280] hover:bg-red-50 hover:text-[#b91c1c]"
                                  aria-label="Quitar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-[#4b5563]">{p.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
                          {(p.sponsorLogoUrl || p.sponsorName) && (
                            <span className="inline-flex items-center gap-1.5">
                              {p.sponsorLogoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2
                                <img src={p.sponsorLogoUrl} alt="" className="h-5 w-auto max-w-[5rem] object-contain" />
                              )}
                              {p.sponsorName}
                            </span>
                          )}
                          {p.estimatedValueArs ? <span>${p.estimatedValueArs.toLocaleString("es-AR")}</span> : null}
                          {p.deliveryInstructions && <span>Entrega: {p.deliveryInstructions}</span>}
                        </div>
                      </div>
                    </div>

                    {p.award && (
                      <div className="border-t border-[#a7f3d0] bg-[#ecfdf5] p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-bold text-[#065f46]">
                              🏆 {p.winner?.name || p.winnerEntry?.displayName || `Cuenta N.º ${p.winnerEntry?.code}`}
                              {p.winner?.companyName ? <span className="font-normal"> · {p.winner.companyName}</span> : null}
                              <span className="font-normal text-[#047857]"> · cuenta N.º {p.winnerEntry?.code}</span>
                            </p>
                            {p.winner && (
                              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[#065f46]">
                                <a href={`mailto:${p.winner.email}`} className="inline-flex items-center gap-1 hover:underline">
                                  <Mail className="h-3.5 w-3.5" /> {p.winner.email}
                                </a>
                                {(p.winner.whatsapp || p.winner.phone) && (
                                  <a
                                    href={`https://wa.me/${String(p.winner.whatsapp || p.winner.phone).replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    <Phone className="h-3.5 w-3.5" /> {p.winner.whatsapp || p.winner.phone}
                                  </a>
                                )}
                              </p>
                            )}
                            <p className="text-[#047857]">
                              {PRIZE_STATUS_LABELS[p.award.status]}
                              {p.award.noticeError ? ` · ${p.award.noticeError}` : ""}
                            </p>
                          </div>
                          {(p.award.status === "GANADO" || p.award.status === "NOTIFICADO") && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  preguntar({
                                    title: "Marcar como entregado",
                                    placeholder: "¿Cómo se entregó? (opcional)",
                                    confirm: "Marcar entregado",
                                    onConfirm: (note) => accion({ action: "awardStatus", awardId: p.award!.id, status: "ENTREGADO", note }),
                                  })
                                }
                              >
                                Entregado
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  preguntar({
                                    title: "No lo retiró",
                                    placeholder: "Detalle (opcional)",
                                    confirm: "Confirmar",
                                    onConfirm: (note) => accion({ action: "awardStatus", awardId: p.award!.id, status: "NO_RETIRADO", note }),
                                  })
                                }
                              >
                                No lo retiró
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  preguntar({
                                    title: "Anular el premio",
                                    description: "Queda escrito en la historia del sorteo y deja de figurar como ganado en la página pública.",
                                    placeholder: "¿Por qué se anula?",
                                    required: true,
                                    danger: true,
                                    confirm: "Anular",
                                    onConfirm: (note) => accion({ action: "awardStatus", awardId: p.award!.id, status: "ANULADO", note }),
                                  })
                                }
                              >
                                Anular
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Portada y sponsors */}
          {vivo && (
            <Card
              title="Portada y sponsors"
              actions={
                lookCambiado ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      accion({ action: "look", coverImageUrl: portada, sponsors: sponsors.filter((s) => s.logoUrl) }, "Portada y sponsors guardados.")
                    }
                  >
                    Guardar cambios
                  </Button>
                ) : null
              }
            >
              <p className="-mt-2 mb-4 text-sm text-[#6b7280]">
                Se pueden cambiar en cualquier momento: no tocan el resultado. Los logos de quienes donan un premio ya aparecen solos.
              </p>
              <div className="space-y-6">
                <ImageUpload
                  kind="portada"
                  label="Portada"
                  hint="Horizontal, ideal 1500 × 500. Se ve arriba de la página pública."
                  value={portada}
                  onChange={(url) => {
                    setPortada(url);
                    setLookCambiado(true);
                  }}
                />
                <div>
                  <p className="mb-2 text-sm font-medium text-[#1a1a1a]">Sponsors del sorteo</p>
                  <SponsorsEditor
                    value={sponsors}
                    onChange={(v) => {
                      setSponsors(v);
                      setLookCambiado(true);
                    }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Participantes */}
          <Card
            title={`Participantes (${padron.length})`}
            icon={<Users className="h-5 w-5 text-[#c27b3d]" />}
            actions={
              padron.length > 8 ? (
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar fotógrafo o cuenta"
                  className="w-full rounded-full border border-[#111827]/10 px-4 py-2 text-sm sm:w-64"
                />
              ) : null
            }
          >
            {data.padronEnVivo && (
              <p className="-mt-2 mb-3 text-sm text-[#6b7280]">Así quedaría la lista si se cerrara ahora. Se actualiza con cada venta.</p>
            )}
            {padron.length === 0 ? (
              <p className="rounded-2xl bg-[#fafafa] p-6 text-center text-sm text-[#6b7280]">Todavía nadie vendió en el período.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-2xl border border-[#111827]/10">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[#fafafa] text-left text-xs font-semibold uppercase text-[#6b7280]">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Fotógrafo</th>
                      <th className="px-4 py-2.5">Cuenta</th>
                      <th className="px-4 py-2.5 text-right">Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111827]/5">
                    {filtrados.map((e) => (
                      <tr key={e.userId} className="hover:bg-[#fafafa]">
                        <td className="px-4 py-2 text-[#9ca3af]">{e.position}</td>
                        <td className="px-4 py-2 font-medium text-[#111827]">{e.displayName}</td>
                        <td className="px-4 py-2 text-[#6b7280]">{e.code}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#374151]">{e.salesCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Columna lateral */}
        <aside className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-[#111827]/10 bg-white p-5 text-sm shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-[#111827]">
              <CalendarClock className="h-4 w-4 text-[#c27b3d]" /> Fechas y condición
            </h2>
            <div>
              <p className="text-xs font-semibold uppercase text-[#9ca3af]">Participan</p>
              <p className="text-[#111827]">
                Fotógrafos con {r.minSales <= 1 ? "al menos una venta pagada" : `al menos ${r.minSales} ventas pagadas`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#9ca3af]">Ventas que cuentan</p>
              <p className="text-[#111827]">
                Del {fecha(r.salesFrom, false)} al {formatArgentina(ultimoDia, false)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#9ca3af]">Cierre de la lista</p>
              <p className="text-[#111827]">{fecha(r.entriesCloseAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#9ca3af]">Sorteo</p>
              <p className="text-[#111827]">{fecha(r.drawsAt)}</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-[#111827]/5 pt-4">
              {!borrador && vivo && (
                <a href={`/sorteos/${r.id}`} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4" /> Ver la página pública
                  </Button>
                </a>
              )}
              {(borrador || r.status === "ANUNCIADO") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[#b91c1c]"
                  disabled={busy}
                  onClick={() =>
                    preguntar({
                      title: "Cancelar el sorteo",
                      description: "No se puede deshacer. El motivo queda escrito en la historia del sorteo.",
                      placeholder: "¿Por qué se cancela?",
                      required: true,
                      danger: true,
                      confirm: "Cancelar sorteo",
                      onConfirm: (reason) => accion({ action: "cancel", reason }, "Sorteo cancelado."),
                    })
                  }
                >
                  Cancelar sorteo
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-[#111827]/10 bg-white p-5 text-sm shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-[#111827]">
              <ShieldCheck className="h-4 w-4 text-[#c27b3d]" /> Verificación
            </h2>
            <p className="text-[#4b5563]">
              {r.drandRound ? `Decide la tanda ${r.drandRound} de drand, fijada al anunciar.` : "La tanda de drand se fija al anunciar."}
            </p>
            {r.entrantsHash && (
              <p className="break-all rounded-xl bg-[#fafafa] p-2 font-mono text-[11px] text-[#6b7280]">{r.entrantsHash}</p>
            )}
            {data.verificacion && (
              <p className={`rounded-xl p-3 ${data.verificacion.ok ? "bg-[#ecfdf5] text-[#065f46]" : "bg-red-50 text-red-700"}`}>
                {data.verificacion.ok
                  ? "La lista y el resultado coinciden con lo publicado."
                  : `Hay diferencias: ${data.verificacion.mismatches.join(" ")}`}
              </p>
            )}
          </section>

          {r.events.length > 0 && (
            <section className="rounded-3xl border border-[#111827]/10 bg-white p-5 text-sm shadow-sm">
              <h2 className="mb-3 font-bold text-[#111827]">Historia</h2>
              <ol className="relative space-y-3 border-l border-[#111827]/10 pl-4">
                {r.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-[#c27b3d]" />
                    <p className="font-medium first-letter:uppercase text-[#111827]">{ev.type.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-[#6b7280]">
                      {fecha(ev.createdAt)}
                      {ev.actorLabel ? ` · ${ev.actorLabel}` : ""}
                    </p>
                    {ev.note && <p className="text-xs text-[#4b5563]">{ev.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      {/* Ventana del premio */}
      <AppModal open={editando !== null} onClose={() => setEditando(null)} size="lg" title={editando?.id ? "Editar premio" : "Nuevo premio"}>
        {editando && (
          <form
            className="space-y-5 overflow-y-auto p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              guardarPremio();
            }}
          >
            <PrizeForm value={editando} onChange={(v) => setEditando({ ...editando, ...v })} titleLocked={Boolean(editando.id) && !borrador} />
            <div className="flex justify-end gap-2 border-t border-[#111827]/5 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !editando.title.trim()}>
                {busy ? "Guardando…" : "Guardar premio"}
              </Button>
            </div>
          </form>
        )}
      </AppModal>

      {/* Ventana de pregunta */}
      <AppModal open={pregunta !== null} onClose={() => setPregunta(null)} size="sm" title={pregunta?.title} description={pregunta?.description}>
        {pregunta && (
          <form
            className="space-y-4 p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (pregunta.required && !respuesta.trim()) return;
              pregunta.onConfirm(respuesta.trim());
              setPregunta(null);
            }}
          >
            <textarea
              className={dsTextareaClassName}
              rows={3}
              autoFocus
              placeholder={pregunta.placeholder}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPregunta(null)}>
                Volver
              </Button>
              <Button type="submit" disabled={pregunta.required && !respuesta.trim()} accentColor={pregunta.danger ? "#b91c1c" : undefined}>
                {pregunta.confirm}
              </Button>
            </div>
          </form>
        )}
      </AppModal>
    </div>
  );
}
