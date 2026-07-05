import { InputHTMLAttributes } from "react";
import { dsInputClassName } from "@/components/ui/form-control-classes";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className, ...props }: InputProps) {
  return <input className={cn(dsInputClassName, className)} {...props} />;
}
