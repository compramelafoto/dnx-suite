"use client";

import Link from "next/link";

const LINKS = [
  {
    id: "instituciones",
    label: "Instituciones",
    hint: "Escuelas y datos de contacto",
    href: "/fotografo/escuelas",
  },
  {
    id: "pedidos",
    label: "Pedidos escolares",
    hint: "Preventa y entregas",
    href: "/fotografo/escuelas/pedidos",
  },
  {
    id: "disenos",
    label: "Diseños escolares",
    hint: "Plantillas y biblioteca",
    href: "/dashboard/designs",
  },
  {
    id: "revisiones",
    label: "Revisiones",
    hint: "Aprobaciones de diseño",
    href: "/dashboard/design-projects",
  },
] as const;

export default function EscolarQuickLinks() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {LINKS.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          className="group rounded-lg border border-gray-100 bg-white p-4 hover:border-[#c27b3d]/30 hover:shadow-sm transition-all min-w-0"
        >
          <p className="text-sm font-semibold text-gray-900 m-0 group-hover:text-[#c27b3d]">{link.label}</p>
          <p className="text-xs text-gray-500 mt-1 mb-2 m-0">{link.hint}</p>
          <span className="text-xs font-medium text-[#c27b3d]">Abrir →</span>
        </Link>
      ))}
    </div>
  );
}
