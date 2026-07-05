"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/blog", label: "Artículos", match: (p: string) => p === "/admin/blog" || /^\/admin\/blog\/\d+/.test(p) || p === "/admin/blog/new" },
  { href: "/admin/blog/categorias", label: "Categorías" },
  { href: "/admin/blog/tags", label: "Tags" },
  { href: "/admin/blog/autores", label: "Autores" },
  { href: "/admin/blog/media", label: "Multimedia" },
];

export default function BlogAdminNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {LINKS.map((link) => {
        const active =
          typeof link.match === "function"
            ? link.match(pathname)
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[#c27b3d] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
