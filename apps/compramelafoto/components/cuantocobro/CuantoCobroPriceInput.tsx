"use client";

import Input from "@/components/ui/Input";
import { normalizeCuantoCobroPriceInput } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { InputHTMLAttributes } from "react";

type CuantoCobroPriceInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function CuantoCobroPriceInput({
  value,
  onValueChange,
  ...props
}: CuantoCobroPriceInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(normalizeCuantoCobroPriceInput(e.target.value))}
    />
  );
}
