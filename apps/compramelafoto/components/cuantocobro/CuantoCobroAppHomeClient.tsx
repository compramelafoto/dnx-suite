"use client";

import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import CuantoCobroButtonLink from "@/components/cuantocobro/CuantoCobroButtonLink";
import CuantoCobroListSkeleton from "@/components/cuantocobro/CuantoCobroListSkeleton";
import { useCuantoCobroBusinessProfile } from "@/components/cuantocobro/BusinessProfileContext";
import {
  ConsultaStatusBadge,
} from "@/components/cuantocobro/consultas/ConsultaBadges";
import PresupuestoStatusBadge from "@/components/cuantocobro/presupuestos/PresupuestoBadges";
import Card from "@/components/ui/Card";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { CC_COTIZAR_PATH } from "@/lib/cuantocobro/constants";
import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import {
  formatClientLine,
  formatConsultaJobType,
  formatConsultaRelativeTime,
} from "@/lib/cuantocobro/consulta/consulta-format";
import { fetchConsultas } from "@/lib/cuantocobro/consulta/consulta-api-client";
import type { CuantoCobroConsultaListItemDto } from "@/lib/cuantocobro/consulta/types";
import {
  formatQuoteClientLine,
  formatQuoteJobType,
  formatQuoteMoney,
  formatQuoteRelativeTime,
  formatQuoteVersionLabel,
} from "@/lib/cuantocobro/quote/quote-format";
import { fetchQuotes } from "@/lib/cuantocobro/quote/quote-api-client";
import type { CuantoCobroQuoteListItemDto } from "@/lib/cuantocobro/quote/types";
import { Calculator, FileText, MessageSquare, UserCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function getProfileGaps(profile: CuantoCobroBusinessProfile | null): string[] {
  if (!profile) {
    return ["nombre comercial", "email de contacto", "dirección"];
  }

  const gaps: string[] = [];
  if (!profile.tradeName.trim() && !profile.photographerFirstName.trim()) {
    gaps.push("nombre comercial");
  }
  if (!profile.commercialEmail.trim()) gaps.push("email de contacto");
  if (!profile.address.trim() && !profile.city.trim()) gaps.push("dirección");
  if (!profile.logoUrl.trim()) gaps.push("logo");
  return gaps;
}

const QUICK_ACTIONS = [
  {
    href: CC_COTIZAR_PATH,
    label: "Cotizar",
    description: "Armá un presupuesto con tu perfil y productos.",
    icon: Calculator,
    primary: true,
  },
  {
    href: "/cuantocobro/app/consultas/nueva",
    label: "Nueva consulta",
    description: "Registrá un cliente y un trabajo antes de cotizar.",
    icon: MessageSquare,
    primary: false,
  },
  {
    href: "/cuantocobro/app/presupuestos",
    label: "Presupuestos",
    description: "Revisá versiones guardadas y duplicá cotizaciones.",
    icon: FileText,
    primary: false,
  },
] as const;

export default function CuantoCobroAppHomeClient() {
  const { profile, openBusinessProfileModal } = useCuantoCobroBusinessProfile();
  const [consultas, setConsultas] = useState<CuantoCobroConsultaListItemDto[]>([]);
  const [quotes, setQuotes] = useState<CuantoCobroQuoteListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const profileGaps = useMemo(() => getProfileGaps(profile), [profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecent() {
      setLoading(true);
      try {
        const [consultaResult, quoteResult] = await Promise.all([
          fetchConsultas({ limit: 5 }),
          fetchQuotes({ limit: 5 }),
        ]);
        if (!cancelled) {
          setConsultas(consultaResult.items);
          setQuotes(quoteResult.items);
        }
      } catch {
        if (!cancelled) {
          setConsultas([]);
          setQuotes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DsPageShell className="cc-page cc-app-home py-6 md:py-8">
      <DsDashboardInner className="w-full min-w-0">
        <header className="cc-app-home__header">
          <div className="min-w-0">
            <h1 className="cc-app-home__title m-0">Tu centro de trabajo</h1>
            <p className="cc-app-home__subtitle m-0">
              Cotizá con criterio, seguí consultas comerciales y retomá presupuestos guardados.
            </p>
          </div>
          <CuantoCobroButtonLink href={CC_COTIZAR_PATH} variant="primary" className="min-h-[44px] w-full sm:w-auto shrink-0">
            Nueva cotización
          </CuantoCobroButtonLink>
        </header>

        {profileGaps.length > 0 ? (
          <Card className="cc-app-home__profile-banner !p-4 md:!p-5" role="note">
            <div className="cc-app-home__profile-banner-inner">
              <div className="min-w-0">
                <p className="cc-app-home__profile-banner-title m-0 font-semibold">
                  Completá tu perfil comercial
                </p>
                <p className="cc-app-home__profile-banner-text m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
                  Te falta: {profileGaps.join(", ")}. Así tus presupuestos se ven profesionales al compartirlos.
                </p>
              </div>
              <CuantoCobroButton
                type="button"
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto shrink-0"
                onClick={() => openBusinessProfileModal()}
              >
                <UserCircle className="h-4 w-4" aria-hidden="true" />
                Configurar perfil
              </CuantoCobroButton>
            </div>
          </Card>
        ) : null}

        <section className="cc-app-home__actions" aria-label="Accesos rápidos">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.primary
                    ? "cc-app-home__action-card cc-app-home__action-card--primary"
                    : "cc-app-home__action-card"
                }
              >
                <span className="cc-app-home__action-icon" aria-hidden="true">
                  <Icon strokeWidth={1.75} />
                </span>
                <span className="cc-app-home__action-label">{action.label}</span>
                <span className="cc-app-home__action-desc">{action.description}</span>
              </Link>
            );
          })}
        </section>

        <div className="cc-app-home__recent-grid">
          <section className="cc-app-home__recent" aria-labelledby="cc-home-recent-consultas">
            <div className="cc-app-home__recent-head">
              <h2 id="cc-home-recent-consultas" className="cc-app-home__section-title m-0">
                Consultas recientes
              </h2>
              <Link href="/cuantocobro/app/consultas" className="cc-presupuestos-link text-sm">
                Ver todas
              </Link>
            </div>

            {loading ? (
              <CuantoCobroListSkeleton rows={3} variant="cards" />
            ) : consultas.length === 0 ? (
              <Card className="!p-4 md:!p-5">
                <DsEmptyState title="Sin consultas todavía" variant="tight">
                  <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                    Registrá un cliente y el tipo de trabajo antes de armar el presupuesto.
                  </p>
                  <div className="ds-empty-state__actions mt-4">
                    <CuantoCobroButtonLink
                      href="/cuantocobro/app/consultas/nueva"
                      variant="primary"
                      className="min-h-[44px] w-full sm:w-auto"
                    >
                      Nueva consulta
                    </CuantoCobroButtonLink>
                  </div>
                </DsEmptyState>
              </Card>
            ) : (
              <ul className="cc-app-home__recent-list m-0 list-none p-0">
                {consultas.map((item) => (
                  <li key={item.id}>
                    <Link href={`/cuantocobro/app/consultas/${item.id}`} className="cc-app-home__recent-item">
                      <span className="cc-app-home__recent-item-main">
                        <span className="cc-app-home__recent-item-title">{item.consultaNumber}</span>
                        <span className="cc-app-home__recent-item-sub">
                          {formatClientLine(item.clientDisplayName, item.clientCompany)} ·{" "}
                          {formatConsultaJobType(item.jobType)}
                        </span>
                      </span>
                      <span className="cc-app-home__recent-item-meta">
                        <ConsultaStatusBadge status={item.status} />
                        <span className="cc-consultas-muted text-xs">
                          {formatConsultaRelativeTime(item.lastActivityAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cc-app-home__recent" aria-labelledby="cc-home-recent-presupuestos">
            <div className="cc-app-home__recent-head">
              <h2 id="cc-home-recent-presupuestos" className="cc-app-home__section-title m-0">
                Presupuestos recientes
              </h2>
              <Link href="/cuantocobro/app/presupuestos" className="cc-presupuestos-link text-sm">
                Ver todos
              </Link>
            </div>

            {loading ? (
              <CuantoCobroListSkeleton rows={3} variant="cards" />
            ) : quotes.length === 0 ? (
              <Card className="!p-4 md:!p-5">
                <DsEmptyState title="Sin presupuestos guardados" variant="tight">
                  <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                    Cuando guardes una cotización desde el wizard, aparecerá acá con su historial de versiones.
                  </p>
                  <div className="ds-empty-state__actions mt-4">
                    <CuantoCobroButtonLink href={CC_COTIZAR_PATH} variant="primary" className="min-h-[44px] w-full sm:w-auto">
                      Ir a cotizar
                    </CuantoCobroButtonLink>
                  </div>
                </DsEmptyState>
              </Card>
            ) : (
              <ul className="cc-app-home__recent-list m-0 list-none p-0">
                {quotes.map((item) => (
                  <li key={item.id}>
                    <Link href="/cuantocobro/app/presupuestos" className="cc-app-home__recent-item">
                      <span className="cc-app-home__recent-item-main">
                        <span className="cc-app-home__recent-item-title">
                          {item.quoteNumber} · {formatQuoteVersionLabel(item.currentVersionNumber)}
                        </span>
                        <span className="cc-app-home__recent-item-sub">
                          {formatQuoteClientLine(item.clientDisplayName, item.clientCompany)} ·{" "}
                          {formatQuoteJobType(item.jobType)}
                        </span>
                      </span>
                      <span className="cc-app-home__recent-item-meta">
                        <PresupuestoStatusBadge status={item.status} archivedAt={item.archivedAt} />
                        <span className="cc-consultas-muted text-xs font-medium">
                          {formatQuoteMoney(item.chosenPriceCents, item.currency)}
                        </span>
                        <span className="cc-consultas-muted text-xs">
                          {formatQuoteRelativeTime(item.updatedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DsDashboardInner>
    </DsPageShell>
  );
}
