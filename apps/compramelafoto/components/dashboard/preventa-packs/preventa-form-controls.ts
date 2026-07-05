import { dsSelectClassName, dsTextareaClassName } from "@/components/ui/form-control-classes";

/** Misma base visual que `components/ui/Input.tsx` para selects nativos. */
export const preventaSelectClassName = `${dsSelectClassName} text-sm disabled:opacity-50`;

export const preventaTextareaClassName = `${dsTextareaClassName} text-sm disabled:opacity-50`;
