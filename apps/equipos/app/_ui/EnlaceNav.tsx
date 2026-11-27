"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Enlace del menú que se marca como actual (`aria-current`) en su sección. */
export function EnlaceNav({ href, children }: { href: string; children: ReactNode }) {
  const ruta = usePathname() ?? "";
  const actual = ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link className="nav-enlace" href={href} aria-current={actual ? "page" : undefined}>
      {children}
    </Link>
  );
}
