import type { ReactNode } from "react";

type BlogAdminPageShellProps = {
  children: ReactNode;
};

/** Wrapper estándar para páginas /admin/blog/* con ancho legible. */
export default function BlogAdminPageShell({ children }: BlogAdminPageShellProps) {
  return <div className="blog-admin-page ds-fill-width ds-stack-section">{children}</div>;
}
