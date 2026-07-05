"use client";

import ConsultaFormFields from "@/components/cuantocobro/consultas/ConsultaFormFields";
import CuantoCobroButtonLink from "@/components/cuantocobro/CuantoCobroButtonLink";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import Card from "@/components/ui/Card";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { createConsulta } from "@/lib/cuantocobro/consulta/consulta-api-client";
import { INITIAL_CUANTO_COBRO_CONSULTA_INPUT, type CuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ConsultaCreateClient() {
  const router = useRouter();
  const [form, setForm] = useState<CuantoCobroConsultaInput>(INITIAL_CUANTO_COBRO_CONSULTA_INPUT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createConsulta(form);
      router.push(`/cuantocobro/app/consultas/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la consulta");
      setSaving(false);
    }
  }

  return (
    <DsPageShell className="cc-page cc-consultas-page py-6 md:py-8">
      <DsDashboardInner className="w-full min-w-0">
        <nav className="cc-consultas-breadcrumb">
          <Link href="/cuantocobro/app/consultas">Consultas</Link>
          <span aria-hidden>/</span>
          <span>Nueva</span>
        </nav>

        <header className="cc-consultas-header">
          <div className="min-w-0">
            <h1 className="cc-consultas-header__title m-0">Nueva consulta</h1>
            <p className="cc-consultas-header__subtitle m-0">
              Registrá el cliente y el trabajo. Podés armar el presupuesto después.
            </p>
          </div>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <Card className="!p-4 md:!p-6">
            {error ? <p className="cc-consultas-error-text">{error}</p> : null}
            <ConsultaFormFields value={form} onChange={setForm} idPrefix="consulta-new" />
          </Card>

          <div className="cc-consultas-form-actions">
            <CuantoCobroButtonLink
              href="/cuantocobro/app/consultas"
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancelar
            </CuantoCobroButtonLink>
            <CuantoCobroButton
              type="submit"
              variant="primary"

              className="min-h-[44px] w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? "Creando…" : "Crear consulta"}
            </CuantoCobroButton>
          </div>
        </form>
      </DsDashboardInner>
    </DsPageShell>
  );
}
