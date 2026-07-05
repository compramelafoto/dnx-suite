import CuantoCobroWizard from "@/components/cuantocobro/CuantoCobroWizard";
import CuantoCobroWizardFrame from "@/components/cuantocobro/CuantoCobroWizardFrame";
import { parseConsultaIdParam, parseQuoteIdParam } from "@/lib/cuantocobro/wizard-consulta-context";

type PageProps = {
  searchParams: Promise<{ consultaId?: string; quoteId?: string }>;
};

export default async function CuantoCobroCotizarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialConsultaId = parseConsultaIdParam(params.consultaId);
  const initialQuoteId = parseQuoteIdParam(params.quoteId);

  return (
    <div className="cc-app-wizard-wrap container-custom">
      <CuantoCobroWizardFrame>
        <CuantoCobroWizard initialConsultaId={initialConsultaId} initialQuoteId={initialQuoteId} />
      </CuantoCobroWizardFrame>
    </div>
  );
}
