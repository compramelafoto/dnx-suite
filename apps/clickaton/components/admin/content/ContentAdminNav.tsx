import Link from "next/link";
import { adminRoutes } from "@/config/admin/navigation";
import { cn } from "@/lib/cn";

export type ContentAdminSection =
  | "posts"
  | "categorias"
  | "tags"
  | "autores"
  | "media";

const SECTIONS: readonly { key: ContentAdminSection; label: string; href: string }[] = [
  { key: "posts", label: "Notas", href: adminRoutes.contents },
  { key: "categorias", label: "Categorías", href: `${adminRoutes.contents}/categorias` },
  { key: "tags", label: "Tags", href: `${adminRoutes.contents}/tags` },
  { key: "autores", label: "Autores", href: `${adminRoutes.contents}/autores` },
  { key: "media", label: "Multimedia", href: `${adminRoutes.contents}/media` },
] as const;

export function ContentAdminNav({ active }: { active: ContentAdminSection }) {
  return (
    <nav aria-label="Secciones de contenidos">
      <ul className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => {
          const isActive = section.key === active;
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
                  isActive
                    ? "border-ck-yellow bg-ck-yellow text-[var(--ck-text-on-brand)]"
                    : "border-ck-border text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
