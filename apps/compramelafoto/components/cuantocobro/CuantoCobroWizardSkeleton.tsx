export default function CuantoCobroWizardSkeleton() {
  return (
    <div className="cc-wizard-skeleton" aria-busy="true" aria-label="Cargando tu cálculo…">
      <div className="cc-wizard-skeleton__sidebar hidden min-[900px]:block" />
      <div className="cc-wizard-skeleton__main">
        <div className="cc-wizard-skeleton__step-head" />
        <div className="cc-wizard-skeleton__field" />
        <div className="cc-wizard-skeleton__field cc-wizard-skeleton__field--short" />
        <div className="cc-wizard-skeleton__field" />
      </div>
    </div>
  );
}
