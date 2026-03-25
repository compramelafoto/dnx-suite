interface PageContainerProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <div className="space-y-12">
      <div className="fr-title-to-content fr-title-to-content-dashboard">
        <h1 className="font-sans text-3xl font-semibold leading-[1.05] tracking-tight text-fr-primary md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 fr-body-small text-fr-muted leading-[1.25]">{description}</p>
      </div>
      {children}
    </div>
  );
}
