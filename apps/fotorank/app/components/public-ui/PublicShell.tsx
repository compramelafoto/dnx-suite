import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader, type PublicHeaderProps } from "./PublicHeader";

type Props = {
  children: ReactNode;
  header?: PublicHeaderProps;
  showHeader?: boolean;
  showFooter?: boolean;
  organizationName?: string | null;
  supportEmail?: string | null;
  className?: string;
  mainClassName?: string;
};

export function PublicShell({
  children,
  header,
  showHeader = true,
  showFooter = true,
  organizationName,
  supportEmail,
  className,
  mainClassName,
}: Props) {
  return (
    <div className={cn("fr-public-shell", className)} data-public-shell>
      {showHeader ? <PublicHeader {...header} /> : null}
      <main id="contenido-principal" className={cn(mainClassName)}>
        {children}
      </main>
      {showFooter ? (
        <PublicFooter organizationName={organizationName} supportEmail={supportEmail} />
      ) : null}
    </div>
  );
}
