"use client";

import { useState, type ReactNode } from "react";

type Props = {
  id: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Accordion item con <details> controlado (toggle fiable + tipado React). */
export function ManualOriginDetails({
  id,
  className,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      id={id}
      className={className}
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      {children}
    </details>
  );
}
