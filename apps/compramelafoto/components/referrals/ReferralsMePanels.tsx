"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { ReferralSharePath } from "@/lib/referral-link";
import {
  REFERRAL_SHARE_OPTIONS,
  referralShareHelperText,
} from "@/lib/referrals/referral-share-options";
import { useReferralsMe, type ReferredRow } from "@/components/referrals/ReferralsMeProvider";

function ShareLinkIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="1.5" />
      <path d="M20 12v16M12 20h16" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 26l6-6 6 6M14 14l6 6 6-6" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyReferralsIllu({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="48" cy="48" r="44" fill="#FEF3C7" />
      <circle cx="48" cy="42" r="14" fill="#FCD34D" opacity="0.8" />
      <path d="M32 56c0-8 6-14 16-14s16 6 16 14" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M24 70c0-12 10-20 24-20s24 8 24 20" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="36" cy="38" r="4" fill="#F97316" />
      <circle cx="60" cy="38" r="4" fill="#F97316" />
      <path d="M48 28v4M48 52v6" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="48" cy="72" rx="20" ry="6" fill="#FDE68A" opacity="0.6" />
    </svg>
  );
}

type ReferralsSharePanelProps = {
  title?: string;
  embedded?: boolean;
};

type ReferralCommercialBlockProps = {
  embedded?: boolean;
  referralLink?: string;
  canCopy?: boolean;
  copied?: boolean;
  onCopyLink?: () => void;
  mpConnected?: boolean;
  mercadopagoLink?: string;
};

export function ReferralCommercialBlock({
  embedded = false,
  referralLink = "",
  canCopy = false,
  copied = false,
  onCopyLink,
  mpConnected,
  mercadopagoLink,
}: ReferralCommercialBlockProps) {
  return (
    <Card
      className={
        embedded
          ? "p-0 border-0 bg-transparent shadow-none space-y-4"
          : "p-6 md:p-8 border-[#c27b3d]/25 bg-gradient-to-br from-[#fffaf5] via-white to-orange-50/20 space-y-5"
      }
    >
      <div>
        <h2
          className={
            embedded
              ? "text-lg font-semibold text-[#1a1a1a]"
              : "text-xl font-semibold text-[#1a1a1a]"
          }
        >
          Recomendá y ganá comisiones
        </h2>
        <p className="mt-2 text-sm text-[#4b5563]">
          Tu mismo enlace sirve para recomendar fotógrafos y organizadores.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-orange-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">
            Fotógrafos recomendados
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">
            Ganás el 50% del fee de plataforma durante 12 meses.
          </p>
        </article>
        <article className="rounded-xl border border-violet-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Organizadores recomendados
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">
            Ganás el 20% del fee de plataforma durante 12 meses.
          </p>
        </article>
      </div>

      <p className="text-sm leading-relaxed text-[#6b7280]">
        Compartilo con fotógrafos, organizadores de carreras, clubes, profes de educación física,
        entrenadores, laboratorios o cualquier persona que pueda acercar nuevos eventos a
        ComprameLaFoto.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {mpConnected === false && mercadopagoLink ? (
          <Link href={mercadopagoLink} className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto">
              Conectar Mercado Pago
            </Button>
          </Link>
        ) : onCopyLink ? (
          <Button
            variant="primary"
            onClick={onCopyLink}
            disabled={!canCopy}
            className="w-full sm:w-auto"
          >
            {copied ? "Enlace copiado" : "Copiar enlace de invitación"}
          </Button>
        ) : null}
        {!canCopy && mpConnected && !referralLink ? (
          <p className="text-sm text-[#6b7280]">Tu enlace se generará en unos segundos.</p>
        ) : null}
      </div>
    </Card>
  );
}

export function ReferralCommercialBlockConnected({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const {
    selectedReferralLink,
    canCopyAndQR,
    copied,
    copyLink,
    data,
    mercadopagoLink,
  } = useReferralsMe();

  return (
    <ReferralCommercialBlock
      embedded={embedded}
      referralLink={selectedReferralLink}
      canCopy={canCopyAndQR && !!selectedReferralLink}
      copied={copied}
      onCopyLink={() => copyLink(selectedReferralLink)}
      mpConnected={data?.mpConnected}
      mercadopagoLink={mercadopagoLink}
    />
  );
}

/** @deprecated Usar ReferralCommercialBlock */
export function ReferralProgramRulesPanel({ embedded = false }: { embedded?: boolean }) {
  return <ReferralCommercialBlockConnected embedded={embedded} />;
}

export function ReferralsSharePanel({
  title = "Tu link de referido",
  embedded = false,
}: ReferralsSharePanelProps) {
  const {
    data,
    selectedSharePath,
    setSelectedSharePath,
    selectedReferralLink,
    canCopyAndQR,
    copied,
    copyLink,
    shareByWhatsApp,
    downloadQR,
    creating,
    setShowTerms,
    mercadopagoLink,
  } = useReferralsMe();

  const mpConnected = data?.mpConnected ?? false;
  const referralCode = data?.referralCode ?? null;

  return (
    <Card
      className={
        embedded
          ? "p-0 border-0 bg-transparent shadow-none"
          : "p-6 border-orange-100 bg-gradient-to-br from-white to-orange-50/30"
      }
    >
      <div className="flex items-start gap-4">
        {!embedded && (
          <div className="flex-shrink-0 mt-0.5 text-orange-400">
            <ShareLinkIcon />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-4">
          <h3 className={embedded ? "text-lg font-semibold text-[#1a1a1a]" : "text-sm font-semibold text-[#374151]"}>
            {title}
          </h3>
          {!mpConnected ? (
            <>
              <p className="text-base text-[#1a1a1a] font-medium mb-2">
                Para generar y usar tu link de referidos tenés que conectar Mercado Pago.
              </p>
              <p className="text-sm text-[#6b7280] mb-4">
                Si alguien se registra con tu link y hace ventas pero vos no tenés MP conectado en ese momento, esa comisión se pierde (no se acumula).
              </p>
              <Link href={mercadopagoLink}>
                <Button variant="primary">Conectar Mercado Pago</Button>
              </Link>
            </>
          ) : referralCode ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="referral-share-page"
                  className="mb-1 block text-xs font-medium text-[#6b7280]"
                >
                  Elegí qué página querés compartir
                </label>
                <select
                  id="referral-share-page"
                  value={selectedSharePath}
                  onChange={(event) =>
                    setSelectedSharePath(event.target.value as ReferralSharePath)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1f2937]"
                >
                  {REFERRAL_SHARE_OPTIONS.map((option) => (
                    <option key={option.path} value={option.path}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs leading-relaxed text-[#6b7280]">
                {referralShareHelperText(selectedSharePath)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => copyLink(selectedReferralLink)}
                  disabled={!canCopyAndQR}
                  className="w-full sm:w-auto"
                >
                  {copied ? "Enlace copiado" : "Copiar enlace de invitación"}
                </Button>
                <input
                  type="text"
                  readOnly
                  value={selectedReferralLink}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={() => shareByWhatsApp(selectedReferralLink)}
                  disabled={!canCopyAndQR}
                >
                  Compartir por WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadQR(selectedReferralLink)}
                  disabled={!canCopyAndQR}
                >
                  Descargar QR
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">
              {creating
                ? "Creando tu código..."
                : "No tenés código de referido aún. Entrá a esta pestaña y se creará automáticamente."}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowTerms(true)}>
            Ver condiciones
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ReferralsTrainingPanel() {
  const { data, canCopyAndQR, copiedTrainingId, copyTrainingLink } = useReferralsMe();
  const promos = data?.trainingPromos ?? [];

  if (!canCopyAndQR || promos.length === 0) return null;

  return (
    <Card className="p-6 border-violet-100 bg-gradient-to-br from-white to-violet-50/25">
      <h3 className="text-sm font-semibold text-[#374151] mb-1">Promocionar capacitaciones</h3>
      <p className="text-sm text-[#6b7280] mb-4">
        Compartí el link de una charla con tu código de referido. Si alguien se registra como fotógrafo desde ese enlace, queda atribuido a vos e indicamos que vino desde esa capacitación.
      </p>
      <ul className="space-y-3">
        {promos.map((p) => (
          <li
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-violet-100/80 bg-white/80 px-3 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {p.thumbnailUrl ? (
                <img
                  src={p.thumbnailUrl}
                  alt={p.title}
                  className="h-14 w-24 shrink-0 rounded-md object-cover border border-violet-100 bg-violet-50"
                />
              ) : (
                <div
                  className="h-14 w-24 shrink-0 rounded-md border border-dashed border-violet-200 bg-violet-50/80 flex items-center justify-center"
                  aria-hidden
                >
                  <svg className="w-7 h-7 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
                    <path d="M3 17l5-5 4 4 5-6 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1a1a] truncate">{p.title}</p>
                {p.eventDate && (
                  <p className="text-xs text-gray-500">
                    {new Date(p.eventDate).toLocaleString("es-AR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => copyTrainingLink(p)}
            >
              {copiedTrainingId === p.id ? "Copiado" : "Copiar link"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReferralsReferredPanel() {
  const { data, formatPesos } = useReferralsMe();
  const [tab, setTab] = useState<"photographers" | "organizers">("photographers");

  const photographers = (data?.referred ?? []).filter(
    (r) => r.referralProgram === "PHOTOGRAPHER_REFERRAL" || !r.referralProgram
  );
  const organizers = (data?.referred ?? []).filter(
    (r) => r.referralProgram === "ORGANIZER_REFERRAL"
  );
  const activeTabRows = tab === "photographers" ? photographers : organizers;
  const totalCount = tab === "photographers" ? photographers.length : organizers.length;

  return (
    <Card className="p-6 border-amber-100 bg-gradient-to-br from-white to-amber-50/20">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#374151]">
            Referidos dados de alta:{" "}
            <span className="text-orange-600">{data?.totalReferred ?? 0}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={tab === "photographers" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("photographers")}
            >
              Fotógrafos ({photographers.length})
            </Button>
            <Button
              type="button"
              variant={tab === "organizers" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("organizers")}
            >
              Organizadores ({organizers.length})
            </Button>
          </div>
        </div>

        {activeTabRows.length > 0 ? (
          <div className="overflow-x-auto">
            <ReferredTable rows={activeTabRows} tab={tab} formatPesos={formatPesos} />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0 flex justify-center sm:block">
              <EmptyReferralsIllu className="w-20 h-20 sm:w-16 sm:h-16 text-amber-400/90" />
            </div>
            <p className="text-sm text-[#6b7280]">
              {tab === "photographers"
                ? "Aún no tenés fotógrafos referidos. Compartí tu link para que se registren como fotógrafos y empezar a cobrar el 50% del fee."
                : "Aún no tenés organizadores referidos. Compartí tu link para que se registren como organizadores y empezar a cobrar el 20% del fee en ventas de sus eventos."}
            </p>
          </div>
        )}

        {totalCount > 0 && (
          <p className="text-xs text-[#9ca3af]">
            {tab === "photographers"
              ? "Las ventas incluyen pedidos de álbumes e impresiones del fotógrafo referido."
              : "Las ventas incluyen pedidos pagados en eventos creados por el organizador referido."}
          </p>
        )}
      </div>
    </Card>
  );
}

function ReferredTable({
  rows,
  tab,
  formatPesos,
}: {
  rows: ReferredRow[];
  tab: "photographers" | "organizers";
  formatPesos: (amount: number) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b">
          <th className="py-2 pr-4">Referido</th>
          {tab === "photographers" && <th className="py-2 pr-4">Origen</th>}
          <th className="py-2 pr-4">Fecha alta</th>
          {tab === "photographers" && <th className="py-2 pr-4">Ventas</th>}
          <th className="py-2 pr-4">Ganancias</th>
          <th className="py-2">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-gray-100">
            <td className="py-2 pr-4">
              <span className="text-[#1a1a1a]">{r.maskedEmail}</span>
              {r.maskedName !== "—" && (
                <span className="text-gray-500 ml-1">({r.maskedName})</span>
              )}
            </td>
            {tab === "photographers" && (
              <td className="py-2 pr-4 text-gray-600 text-xs max-w-[10rem]">
                {r.referralOriginLabel ?? (
                  <span className="text-gray-400">Link general</span>
                )}
              </td>
            )}
            <td className="py-2 pr-4 text-gray-600">
              {new Date(r.createdAt).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </td>
            {tab === "photographers" && <td className="py-2 pr-4">{r.salesCount}</td>}
            <td className="py-2 pr-4 text-[#1a1a1a]">
              {formatPesos(r.earningsGeneratedCents ?? 0)}
            </td>
            <td className="py-2">
              <span
                className={
                  r.status === "ACTIVE"
                    ? "text-green-600"
                    : r.status === "EXPIRED"
                      ? "text-amber-600"
                      : "text-gray-500"
                }
              >
                {r.status === "ACTIVE"
                  ? "Activo"
                  : r.status === "EXPIRED"
                    ? "Expirado"
                    : "Bloqueado"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReferralsFinancesPanel() {
  const {
    data,
    cbuInput,
    setCbuInput,
    cbuTitularInput,
    setCbuTitularInput,
    savingCbu,
    cbuSaved,
    saveCbu,
    requestingPayout,
    payoutMessage,
    requestPayout,
    canRequestPayout,
    hasPendingPayout,
    hasCbuData,
    balanceCents,
    totalPaidCents,
    formatPesos,
  } = useReferralsMe();

  if (!data?.mpConnected) return null;

  return (
    <div className="space-y-6">
      <Card className="p-6 border-slate-100">
        <h3 className="text-sm font-semibold text-[#374151] mb-2">
          Datos para cobro (transferencia bancaria)
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Ingresá tu CBU (o Alias) y el titular de la cuenta para recibir las comisiones por transferencia. Sin estos datos no podés solicitar cobro.
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">CBU o Alias</label>
              <input
                type="text"
                value={cbuInput}
                onChange={(e) => setCbuInput(e.target.value)}
                placeholder="Ej: 0000000000000000000000 o mi.alias"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                maxLength={30}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Titular de la cuenta</label>
              <input
                type="text"
                value={cbuTitularInput}
                onChange={(e) => setCbuTitularInput(e.target.value)}
                placeholder="Nombre del titular"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                maxLength={120}
              />
            </div>
            <Button variant="secondary" onClick={() => void saveCbu()} disabled={savingCbu}>
              {savingCbu ? "Guardando..." : cbuSaved ? "Guardado" : "Guardar"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#374151] mb-1">Comisiones por referidos</h3>
            <p className="text-2xl font-semibold text-emerald-700">
              {formatPesos(balanceCents)}{" "}
              <span className="text-sm font-normal text-gray-500">disponibles</span>
            </p>
            {totalPaidCents > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Ya cobraste: {formatPesos(totalPaidCents)}
              </p>
            )}
            {(data?.photographerBalanceCents != null ||
              data?.organizerBalanceCents != null) && (
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>
                    Por fotógrafos: {formatPesos(data?.photographerBalanceCents ?? 0)}
                  </p>
                  <p>
                    Por organizadores: {formatPesos(data?.organizerBalanceCents ?? 0)}
                  </p>
                </div>
              )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              onClick={() => void requestPayout()}
              disabled={!canRequestPayout || requestingPayout}
            >
              {requestingPayout ? "Enviando..." : "Solicitar cobro"}
            </Button>
            {!canRequestPayout && balanceCents > 0 && balanceCents < 1 && (
              <span className="text-xs text-gray-500">Mínimo $1 para solicitar</span>
            )}
            {!canRequestPayout && balanceCents >= 1 && !hasCbuData && (
              <span className="text-xs text-amber-600">
                Completá CBU y titular de la cuenta arriba para solicitar cobro
              </span>
            )}
            {hasPendingPayout && (
              <span className="text-xs text-amber-600">Tenés una solicitud pendiente</span>
            )}
          </div>
        </div>
        {payoutMessage && (
          <p
            className={`mt-3 text-sm ${payoutMessage.startsWith("Tu solicitud") ? "text-emerald-600" : "text-amber-600"}`}
          >
            {payoutMessage}
          </p>
        )}
        {data.payoutRequests && data.payoutRequests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Últimas solicitudes</p>
            <ul className="text-sm space-y-1">
              {data.payoutRequests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>{formatPesos(r.amountCents)}</span>
                  <span
                    className={
                      r.status === "PAID"
                        ? "text-emerald-600"
                        : r.status === "PENDING"
                          ? "text-amber-600"
                          : "text-gray-500"
                    }
                  >
                    {r.status === "PAID"
                      ? "Pagado"
                      : r.status === "PENDING"
                        ? "Pendiente"
                        : "Cancelado"}
                    {r.paidAt && r.status === "PAID" &&
                      ` · ${new Date(r.paidAt).toLocaleDateString("es-AR")}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
