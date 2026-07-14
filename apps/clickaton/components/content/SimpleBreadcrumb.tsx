import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { routes } from "@/config/navigation";

type Crumb = {
  label: string;
  href?: string;
};

type SimpleBreadcrumbProps = {
  current?: string;
  items?: Crumb[];
};

/**
 * Miga de pan simple.
 * - `current`: Inicio / current
 * - `items`: trail completo (último = página actual sin href)
 */
export function SimpleBreadcrumb({ current, items }: SimpleBreadcrumbProps) {
  const crumbs: Crumb[] =
    items ??
    ([
      { label: "Inicio", href: routes.home },
      ...(current ? [{ label: current }] : []),
    ] satisfies Crumb[]);

  return (
    <div className="border-b border-ck-border bg-ck-bg-alt">
      <Container className="py-3">
        <nav aria-label="Miga de pan" className="ck-body-sm text-ck-text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="underline-offset-4 hover:text-ck-text hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-ck-text" aria-current={isLast ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </Container>
    </div>
  );
}
