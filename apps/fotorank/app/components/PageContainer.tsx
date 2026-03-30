interface PageContainerProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

/**
 * Cabecera de página dashboard: H1 → descripción con gap y leading alineados al design system
 * (`compositionSpacing.stack.pageTitleToDescription`, `typography` / `--fr-leading-reading*`).
 */
export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <div className="space-y-12">
      <div className="fr-title-to-content fr-title-to-content-dashboard">
        <div className="flex flex-col gap-6">
          <h1 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-fr-primary md:text-4xl">
            {title}
          </h1>
          <p className="fr-page-description">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
