import { SelectHTMLAttributes } from "react";
import { dsSelectClassName } from "@/components/ui/form-control-classes";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export default function Select({ className, children, ...props }: SelectProps) {
  return (
    <select className={cn(dsSelectClassName, className)} {...props}>
      {children}
    </select>
  );
}
