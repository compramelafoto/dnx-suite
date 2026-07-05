"use client";

import { createElement } from "react";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import { getEquipmentCategoryIcon } from "@/lib/cuantocobro/equipment/category-icons";
import { RENEWAL_CATEGORY_META } from "@/lib/cuantocobro/equipment/constants";
import type { EquipmentCategoryCardMeta } from "@/lib/cuantocobro/equipment/types";
import { ChevronRight } from "lucide-react";

type Props = {
  card: EquipmentCategoryCardMeta;
  currency: string;
  onConfigure: () => void;
};

const STATUS_LABELS = {
  pending: "Pendiente",
  configured: "Listo",
} as const;

export default function EquipmentCategoryCard({ card, currency, onConfigure }: Props) {
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, currency || "ARS");
  const Icon = getEquipmentCategoryIcon(card.id);
  const modalTitle = RENEWAL_CATEGORY_META[card.id].title;

  return (
    <button
      type="button"
      className={`cc-equipment-card cc-equipment-card--${card.status}`}
      onClick={onConfigure}
      aria-label={`${modalTitle}: ${STATUS_LABELS[card.status]}`}
    >
      <span className="cc-equipment-card__icon" aria-hidden="true">
        {createElement(Icon, { strokeWidth: 1.75 })}
      </span>
      <span className="cc-equipment-card__content">
        <span className="cc-equipment-card__head">
          <span className="cc-equipment-card__title">{card.title}</span>
          <span className={`cc-equipment-card__status cc-equipment-card__status--${card.status}`}>
            {STATUS_LABELS[card.status]}
          </span>
        </span>
        <span className="cc-equipment-card__meta">
          {card.status === "configured" && card.itemCount > 0 ? (
            <span>
              {card.itemCount} {card.itemCount === 1 ? "ítem" : "ítems"}
              {card.monthlyContribution !== null && card.monthlyContribution > 0
                ? ` · ${fmt(card.monthlyContribution)}/mes`
                : ""}
            </span>
          ) : (
            <span className="cc-equipment-card__cta">Tocá para configurar</span>
          )}
        </span>
      </span>
      <ChevronRight className="cc-equipment-card__chevron" aria-hidden="true" strokeWidth={2} />
    </button>
  );
}
