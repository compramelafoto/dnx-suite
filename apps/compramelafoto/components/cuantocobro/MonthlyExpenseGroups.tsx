"use client";

import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import Input from "@/components/ui/Input";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  addCustomExpenseItem,
  removeCustomExpenseItem,
  sumExpenseGroup,
  sumPersonalExpenseGroups,
  updateCustomItemLabel,
  updateGroupItemAmount,
} from "@/lib/cuantocobro/personal-expenses";
import {
  CC_PERSONAL_EXPENSES_EDUCATION,
  CC_PERSONAL_EXPENSES_SECURITY,
  type MonthlyExpenseGroup,
} from "@/lib/cuantocobro/types";
import { PERSONAL_EXPENSE_ITEM_HINTS } from "@/lib/cuantocobro/default-expense-groups";
import { scheduleScrollCuantoCobroSectionIntoView } from "@/lib/cuantocobro/scroll-section-into-view";
import { useEffect, useRef, useState } from "react";

type Props = {
  groups: MonthlyExpenseGroup[];
  currency: string;
  onChange: (groups: MonthlyExpenseGroup[]) => void;
};

export default function MonthlyExpenseGroups({ groups, currency, onChange }: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const groupRefs = useRef(new Map<string, HTMLDetailsElement>());
  const grandTotal = sumPersonalExpenseGroups(groups);

  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, currency || "ARS");

  useEffect(() => {
    if (!openGroupId) return;
    const element = groupRefs.current.get(openGroupId);
    if (element?.open) {
      scheduleScrollCuantoCobroSectionIntoView(element);
    }
  }, [openGroupId]);

  return (
    <div className="ds-stack-section cc-expense-groups">
      <div className="ds-info-panel cc-info-panel--accent">
        <p className="ds-info-panel__body m-0 text-sm leading-relaxed">{CC_PERSONAL_EXPENSES_EDUCATION}</p>
      </div>
      <div className="ds-info-panel cc-info-panel--accent">
        <p className="ds-info-panel__body m-0 text-xs sm:text-sm leading-relaxed">{CC_PERSONAL_EXPENSES_SECURITY}</p>
      </div>

      <div className="cc-expense-groups__list ds-stack-section">
        {groups.map((group) => {
          const subtotal = sumExpenseGroup(group);
          const isOpen = openGroupId === group.id;

          return (
            <details
              key={group.id}
              ref={(node) => {
                if (node) groupRefs.current.set(group.id, node);
                else groupRefs.current.delete(group.id);
              }}
              className="cc-expense-group"
              open={isOpen}
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) {
                  setOpenGroupId(group.id);
                } else if (openGroupId === group.id) {
                  setOpenGroupId(null);
                }
              }}
            >
              <summary className="cc-expense-group__summary">
                <span className="cc-expense-group__title">{group.title}</span>
                <span className="cc-expense-group__subtotal">{fmt(subtotal)}</span>
              </summary>

              <div className="cc-expense-group__body ds-form-stack">
                {group.description ? (
                  <p className="cc-expense-group__description m-0">{group.description}</p>
                ) : null}

                {group.items.map((item) => {
                  const itemHint = item.isCustom ? undefined : PERSONAL_EXPENSE_ITEM_HINTS[item.id];

                  return (
                  <div key={item.id} className="cc-expense-item">
                    <div className="cc-expense-item__label-row min-w-0 flex-1">
                      {item.isCustom ? (
                        <Input
                          aria-label="Nombre del gasto personalizado"
                          value={item.label}
                          onChange={(e) =>
                            onChange(updateCustomItemLabel(groups, group.id, item.id, e.target.value))
                          }
                          placeholder="Nombre del gasto"
                          className="cc-expense-item__custom-label"
                        />
                      ) : (
                        <>
                          <label htmlFor={`cc-expense-${group.id}-${item.id}`} className="cc-expense-item__label">
                            {item.label}
                          </label>
                          {itemHint ? (
                            <p className="cc-expense-item__hint m-0">{itemHint}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="cc-expense-item__amount-row">
                      <CuantoCobroPriceInput
                        id={`cc-expense-${group.id}-${item.id}`}
                        aria-label={item.label}
                        placeholder="0"
                        value={item.amount}
                        onValueChange={(value) =>
                          onChange(updateGroupItemAmount(groups, group.id, item.id, value))
                        }
                        className="cc-expense-item__input"
                      />
                      {item.isCustom ? (
                        <CuantoCobroButton
                          type="button"
                          variant="secondary"

                          className="cc-expense-item__remove min-h-[44px] shrink-0"
                          onClick={() => onChange(removeCustomExpenseItem(groups, group.id, item.id))}
                        >
                          Quitar
                        </CuantoCobroButton>
                      ) : null}
                    </div>
                  </div>
                  );
                })}

                <CuantoCobroButton
                  type="button"
                  variant="secondary"

                  className="w-full sm:w-auto min-h-[44px] self-start"
                  onClick={() => onChange(addCustomExpenseItem(groups, group.id))}
                >
                  Agregar ítem
                </CuantoCobroButton>
              </div>
            </details>
          );
        })}
      </div>

      <div className="cc-expense-groups__total" role="status">
        <span className="cc-expense-groups__total-label">Total gastos personales / mes</span>
        <span className="cc-expense-groups__total-value">{fmt(grandTotal)}</span>
      </div>
    </div>
  );
}
