import { TextareaHTMLAttributes, forwardRef } from "react";
import { dsTextareaClassName } from "@/components/ui/form-control-classes";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** Altura mínima de una línea (chat, respuestas rápidas). */
  compact?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, compact, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        dsTextareaClassName,
        compact && "ds-textarea-compact text-sm",
        error && "border-[#ef4444] focus:ring-[#ef4444]",
        className
      )}
      {...props}
    />
  );
});

export default Textarea;
