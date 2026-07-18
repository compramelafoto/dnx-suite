import { parseCuantoCobroAmount } from "./amount-format.js";
import { normalizeCameraProfileFields } from "./camera-equipment.js";
import { normalizeEquipmentProfileFields } from "./equipment/normalize.js";
import { normalizeProfileAvailability } from "./availability.js";
import {
  createDefaultPersonalExpenseGroups,
  createCustomExpenseItemId,
} from "./default-expense-groups.js";
import {
  INITIAL_CUANTO_COBRO_PROFILE,
  type CuantoCobroProfileInput,
  type MonthlyExpenseGroup,
  type MonthlyExpenseItem,
} from "./types.js";

type LegacyProfileFields = {
  personalHousing?: string;
  personalLiving?: string;
  personalOther?: string;
  personalExpenseGroups?: MonthlyExpenseGroup[];
};

export function sumExpenseGroup(group: MonthlyExpenseGroup): number {
  return group.items.reduce((total, item) => total + (parseCuantoCobroAmount(item.amount) ?? 0), 0);
}

export function sumPersonalExpenseGroups(groups: MonthlyExpenseGroup[]): number {
  return groups.reduce((total, group) => total + sumExpenseGroup(group), 0);
}

export function mergePersonalExpenseGroups(saved: MonthlyExpenseGroup[]): MonthlyExpenseGroup[] {
  const defaults = createDefaultPersonalExpenseGroups();

  return defaults.map((defaultGroup) => {
    const savedGroup = saved.find((group) => group.id === defaultGroup.id);
    if (!savedGroup) return defaultGroup;

    const savedCustom = savedGroup.items.filter((item) => item.isCustom);
    const mergedPredefined = defaultGroup.items.map((defaultItem) => {
      const savedItem = savedGroup.items.find((item) => item.id === defaultItem.id && !item.isCustom);
      return savedItem ? { ...defaultItem, amount: savedItem.amount } : defaultItem;
    });

    return {
      ...defaultGroup,
      items: [...mergedPredefined, ...savedCustom],
    };
  });
}

function setItemAmount(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  itemId: string,
  amount: string,
): void {
  if (!amount.trim()) return;
  const group = groups.find((g) => g.id === groupId);
  const item = group?.items.find((i) => i.id === itemId);
  if (item) item.amount = amount;
}

function migrateLegacyPersonalFields(
  groups: MonthlyExpenseGroup[],
  legacy: LegacyProfileFields,
): MonthlyExpenseGroup[] {
  const migrated = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));

  if (legacy.personalHousing) {
    setItemAmount(migrated, "housing", "rent-mortgage", legacy.personalHousing);
  }
  if (legacy.personalLiving) {
    setItemAmount(migrated, "food", "supermarket", legacy.personalLiving);
  }
  if (legacy.personalOther) {
    setItemAmount(migrated, "other", "other-misc", legacy.personalOther);
  }

  return migrated;
}

export function normalizePersonalExpenseGroups(
  input: LegacyProfileFields,
): MonthlyExpenseGroup[] {
  if (Array.isArray(input.personalExpenseGroups) && input.personalExpenseGroups.length > 0) {
    const merged = mergePersonalExpenseGroups(input.personalExpenseGroups);
    return migrateLegacyPersonalFields(merged, input);
  }

  const defaults = createDefaultPersonalExpenseGroups();
  return migrateLegacyPersonalFields(defaults, input);
}

export function normalizeCuantoCobroProfile(
  raw: Partial<CuantoCobroProfileInput> & LegacyProfileFields,
): CuantoCobroProfileInput {
  const personalExpenseGroups = normalizePersonalExpenseGroups(raw);

  return {
    ...INITIAL_CUANTO_COBRO_PROFILE,
    ...raw,
    personalExpenseGroups,
    ...normalizeProfileAvailability(raw),
    ...normalizeCameraProfileFields(raw),
    ...normalizeEquipmentProfileFields(raw),
  };
}

export function updateGroupItemAmount(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  itemId: string,
  amount: string,
): MonthlyExpenseGroup[] {
  return groups.map((group) =>
    group.id !== groupId
      ? group
      : {
          ...group,
          items: group.items.map((item) => (item.id === itemId ? { ...item, amount } : item)),
        },
  );
}

export function updateCustomItemLabel(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  itemId: string,
  label: string,
): MonthlyExpenseGroup[] {
  return groups.map((group) =>
    group.id !== groupId
      ? group
      : {
          ...group,
          items: group.items.map((item) =>
            item.id === itemId && item.isCustom ? { ...item, label } : item,
          ),
        },
  );
}

export function addCustomExpenseItem(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  label = "Otro gasto",
): MonthlyExpenseGroup[] {
  const newItem: MonthlyExpenseItem = {
    id: createCustomExpenseItemId(groupId),
    label,
    amount: "",
    isCustom: true,
  };

  return groups.map((group) =>
    group.id !== groupId ? group : { ...group, items: [...group.items, newItem] },
  );
}

export function removeCustomExpenseItem(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  itemId: string,
): MonthlyExpenseGroup[] {
  return groups.map((group) =>
    group.id !== groupId
      ? group
      : {
          ...group,
          items: group.items.filter((item) => !(item.id === itemId && item.isCustom)),
        },
  );
}
