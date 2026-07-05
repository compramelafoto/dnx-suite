import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BlogPageShellProps = {
  children: ReactNode;
  /** `article` usa ancho completo del blog (72rem); `list` para home, categorías y tags */
  variant?: "list" | "article";
  className?: string;
  innerClassName?: string;
};

export default function BlogPageShell({
  children,
  variant = "list",
  className,
  innerClassName,
}: BlogPageShellProps) {
  return (
    <section className={cn("blog-page section-spacing", className)}>
      <div className="container-custom ds-fill-width">
        <div
          className={cn(
            variant === "article" ? "blog-article-inner" : "blog-page-inner",
            innerClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
