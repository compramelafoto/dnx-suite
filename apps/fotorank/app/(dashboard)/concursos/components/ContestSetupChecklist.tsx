"use client";

import { ContestSetupCard } from "./ContestSetupCard";
import type { ModuleInfo } from "../../../lib/fotorank/contestProgress";

interface ContestSetupChecklistProps {
  modules: ModuleInfo[];
  onModuleClick?: (moduleId: string) => void;
  onLockedClick?: (restrictionMessage: string | null) => void;
}

export function ContestSetupChecklist({
  modules,
  onModuleClick,
  onLockedClick,
}: ContestSetupChecklistProps) {
  return (
    <section className="pt-8 sm:pt-9 lg:pt-10">
      <div className="grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
        {modules.map((module) => {
          const isLocked = module.editPermission === "locked";
          const canEdit = !isLocked;
          return (
            <ContestSetupCard
              key={module.id}
              module={module}
              onClick={
                canEdit && onModuleClick
                  ? () => onModuleClick(module.id)
                  : isLocked && onLockedClick
                    ? () => onLockedClick(module.restrictionMessage)
                    : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
