"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

type OrdersBulkCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
  className?: string;
};

export default function OrdersBulkCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  className,
}: OrdersBulkCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        "h-4 w-4 shrink-0 rounded border-gray-300 text-[#c27b3d]",
        "focus:ring-2 focus:ring-[#c27b3d]/30 focus:ring-offset-0 cursor-pointer",
        className
      )}
    />
  );
}
