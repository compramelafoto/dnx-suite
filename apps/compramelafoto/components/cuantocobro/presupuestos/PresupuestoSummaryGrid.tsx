"use client";

import { Briefcase, Calendar, DollarSign, User } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type SummaryItem = {
  label: string;
  value: ReactNode;
  icon: typeof User;
};

type Props = {
  client: ReactNode;
  jobType: ReactNode;
  jobDate: ReactNode;
  price: ReactNode;
  accentColor?: string;
};

export default function PresupuestoSummaryGrid({ client, jobType, jobDate, price, accentColor }: Props) {
  const items: SummaryItem[] = [
    { label: "Cliente", value: client, icon: User },
    { label: "Evento", value: jobType, icon: Briefcase },
    { label: "Fecha", value: jobDate, icon: Calendar },
    { label: "Precio", value: price, icon: DollarSign },
  ];

  return (
    <div
      className="cc-presupuesto-summary-grid"
      style={accentColor ? ({ "--cc-accent": accentColor } as CSSProperties) : undefined}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="cc-presupuesto-summary-grid__item">
            <span className="cc-presupuesto-summary-grid__icon-wrap" aria-hidden>
              <Icon className="cc-presupuesto-summary-grid__icon" />
            </span>
            <span className="cc-presupuesto-summary-grid__content">
              <span className="cc-presupuesto-summary-grid__label">{item.label}</span>
              <span className="cc-presupuesto-summary-grid__value">{item.value}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
