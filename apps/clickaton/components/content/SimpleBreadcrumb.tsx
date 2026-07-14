import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { routes } from "@/config/navigation";

type SimpleBreadcrumbProps = {
  current: string;
};

export function SimpleBreadcrumb({ current }: SimpleBreadcrumbProps) {
  return (
    <div className="border-b border-ck-border bg-ck-bg-alt">
      <Container className="py-3">
        <nav aria-label="Miga de pan" className="ck-body-sm text-ck-text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href={routes.home} className="underline-offset-4 hover:text-ck-text hover:underline">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-ck-text" aria-current="page">
              {current}
            </li>
          </ol>
        </nav>
      </Container>
    </div>
  );
}
