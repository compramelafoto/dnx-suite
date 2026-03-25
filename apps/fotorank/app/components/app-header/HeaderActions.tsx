import type { ReactNode } from "react";

type HeaderActionsProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderActions({ children, className }: HeaderActionsProps) {
  return (
    <div className={`flex min-w-0 shrink-0 items-center justify-end gap-3 sm:gap-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}
