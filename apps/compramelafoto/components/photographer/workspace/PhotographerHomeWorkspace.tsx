"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import RecommendLabModal from "@/components/RecommendLabModal";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import PhotographerWorkspacePageHeader from "./PhotographerWorkspacePageHeader";

function ReferralsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h8M8 14h5M4 7a2 2 0 012-2h8l4 4v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm13 0v3h3"
      />
    </svg>
  );
}

function EventsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

type FeaturedAccess = {
  id: string;
  label: string;
  description: string;
  cta: string;
  href: string;
  icon: ReactNode;
  accent: string;
};

const FEATURED_ACCESSES: FeaturedAccess[] = [
  {
    id: "referidos",
    label: "Recomendá ComprameLaFoto",
    description: "Compartí tu link de referido y ganá beneficios por recomendar la plataforma.",
    cta: "Ir a referidos",
    href: "/dashboard/referrals",
    icon: <ReferralsIcon className="w-5 h-5" />,
    accent: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    id: "proximos-eventos",
    label: "Próximos eventos",
    description: "Encontrá convocatorias y eventos activos cerca para participar.",
    cta: "Ver eventos",
    href: "/fotografo/eventos",
    icon: <EventsIcon className="w-5 h-5" />,
    accent: "bg-sky-50 text-sky-700 border-sky-100",
  },
];

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type DashboardStats = {
  totalSalesARS: number;
  totalClientPaidARS?: number;
  digitalSalesARS: number;
  printSalesARS: number;
  activeAlbumsCount: number;
  albumsCount: number;
  eventOrganizerCommissionSalesCount?: number;
};

type PhotographerHomeWorkspaceProps = {
  stats: DashboardStats | null;
  photographer: { id?: number; name?: string | null; email?: string | null } | null;
  pendingRemovalCount: number;
  pendingOrdersCount: number;
  myEventsCount: number;
  mpConnected: boolean;
  preferredLabSet: boolean;
};

const QUICK_LINKS = [
  {
    id: "pedidos",
    label: "Pedidos",
    hint: "Workspace operativo",
    href: "/fotografo/pedidos",
    cta: "Ir a pedidos",
  },
  {
    id: "ventas",
    label: "Ventas",
    hint: "Configuración, productos y cobros",
    href: "/dashboard/sales-settings",
    cta: "Ir a ventas",
  },
  {
    id: "albumes",
    label: "Álbumes",
    hint: "Gestionar galerías",
    href: "/dashboard/albums",
    cta: "Ver álbumes",
  },
  {
    id: "analytics",
    label: "Analytics",
    hint: "Rendimiento de ventas",
    href: "/fotografo/analytics",
    cta: "Ver métricas",
  },
] as const;

export default function PhotographerHomeWorkspace({
  stats,
  photographer,
  pendingRemovalCount,
  pendingOrdersCount,
  myEventsCount,
  mpConnected,
  preferredLabSet,
}: PhotographerHomeWorkspaceProps) {
  const [recommendLabOpen, setRecommendLabOpen] = useState(false);

  const alerts: { id: string; tone: "amber" | "blue"; title: string; body: string; href: string; cta: string }[] =
    [];

  if (!mpConnected) {
    alerts.push({
      id: "mp",
      tone: "amber",
      title: "Mercado Pago sin conectar",
      body: "Conectá tu cuenta para cobrar ventas digitales e impresiones.",
      href: "/fotografo/configuracion?tab=mercadopago",
      cta: "Conectar MP",
    });
  }
  if (!preferredLabSet) {
    alerts.push({
      id: "lab",
      tone: "blue",
      title: "Lab de impresión pendiente",
      body: "Definí tu lab de impresión para calcular márgenes en pedidos de impresión.",
      href: "/fotografo/laboratorio",
      cta: "Configurar impresión",
    });
  }
  if (pendingRemovalCount > 0) {
    alerts.push({
      id: "removal",
      tone: "amber",
      title: `${pendingRemovalCount} solicitud${pendingRemovalCount === 1 ? "" : "es"} de baja`,
      body: "Hay fotos con pedido de remoción esperando tu decisión.",
      href: "/fotografo/remociones",
      cta: "Revisar",
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PhotographerWorkspacePageHeader
        title="Inicio"
        subtitle="Centro operacional: estado del negocio, alertas y accesos rápidos a tus workspaces."
        actions={
          <Link href="/dashboard/albums/new">
            <Button variant="primary">
              Crear álbum
            </Button>
          </Link>
        }
      />

      {alerts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${
                alert.tone === "amber"
                  ? "border-amber-200 bg-amber-50/80"
                  : "border-blue-200 bg-blue-50/80"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900 m-0">{alert.title}</p>
              <p className="text-sm text-gray-600 mt-1 mb-3 m-0">{alert.body}</p>
              <Link href={alert.href}>
                <Button variant="secondary" size="sm">
                  {alert.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      {stats ? (
        <div className="space-y-4">
          {Number(stats.eventOrganizerCommissionSalesCount) > 0 ? (
            <DsInfoPanel title="Ventas en eventos con comisión de organizador">
              <p className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 text-sm">
                Los totales muestran lo que <strong>recibís en tu Mercado Pago</strong> (neto). En{" "}
                {stats.eventOrganizerCommissionSalesCount} venta(s) hubo retención por comisión del organizador.
              </p>
            </DsInfoPanel>
          ) : null}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-gray-500 m-0">Recibido (neto)</p>
              <p className="text-xl font-semibold text-gray-900 tabular-nums mt-1 mb-0">
                {formatARS(stats.totalSalesARS)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 m-0">Digital (neto)</p>
              <p className="text-xl font-semibold text-blue-600 tabular-nums mt-1 mb-0">
                {formatARS(stats.digitalSalesARS)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 m-0">Impresión (neto)</p>
              <p className="text-xl font-semibold text-emerald-600 tabular-nums mt-1 mb-0">
                {formatARS(stats.printSalesARS)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 m-0">Álbumes activos</p>
              <p className="text-xl font-semibold text-amber-600 tabular-nums mt-1 mb-0">
                {stats.activeAlbumsCount} / {stats.albumsCount}
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 w-full min-w-0" aria-label="Accesos rápidos">
        <h2 className="text-base font-semibold text-gray-900 m-0">Accesos rápidos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FEATURED_ACCESSES.map((item) => (
            <Card key={item.id} className="p-4 sm:p-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${item.accent}`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 m-0">{item.label}</p>
                    <p className="text-sm text-gray-600 mt-1.5 mb-0 ds-readable-text ds-readable-text--fluid leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <Link href={item.href} className="self-start">
                    <Button variant="secondary" size="sm">
                      {item.cta}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className="group rounded-lg border border-gray-100 bg-white p-4 hover:border-[#c27b3d]/30 hover:shadow-sm transition-all min-w-0"
            >
              <p className="text-sm font-semibold text-gray-900 m-0 group-hover:text-[#c27b3d]">{link.label}</p>
              <p className="text-xs text-gray-500 mt-1 mb-3 m-0 ds-readable-text ds-readable-text--fluid">
                {link.hint}
              </p>
              <span className="text-xs font-medium text-[#c27b3d]">{link.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Actividad reciente</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
            <span>Pedidos en workspace</span>
            <Link href="/fotografo/pedidos" className="font-medium text-[#c27b3d] hover:underline tabular-nums">
              {pendingOrdersCount > 0 ? `${pendingOrdersCount} para revisar` : "Ver pedidos"}
            </Link>
          </li>
          <li className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
            <span>Eventos activos</span>
            <Link href="/fotografo/eventos" className="font-medium text-[#c27b3d] hover:underline tabular-nums">
              {myEventsCount > 0 ? `${myEventsCount} inscripción${myEventsCount === 1 ? "" : "es"}` : "Explorar eventos"}
            </Link>
          </li>
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Solicitudes de baja</span>
            <Link href="/fotografo/remociones" className="font-medium text-[#c27b3d] hover:underline tabular-nums">
              {pendingRemovalCount > 0 ? `${pendingRemovalCount} pendiente${pendingRemovalCount === 1 ? "" : "s"}` : "Sin pendientes"}
            </Link>
          </li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/fotografo/soporte">
          <Button variant="secondary" size="sm">
            Soporte
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => setRecommendLabOpen(true)}>
          Recomendar laboratorio
        </Button>
      </div>

      <RecommendLabModal
        open={recommendLabOpen}
        onClose={() => setRecommendLabOpen(false)}
        defaultPhotographerName={photographer?.name ?? ""}
      />
    </div>
  );
}
