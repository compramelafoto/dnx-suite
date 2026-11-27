"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/app/_ui/Aviso";
import { Boton } from "@/app/_ui/Boton";
import { Campo } from "@/app/_ui/Campo";

export function DecisionForm({ id }: { id: number }) {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [legalName, setLegalName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/verificaciones/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "No se pudo guardar la decisión");
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pila">
      <div className="formulario-dos">
        <div className="formulario">
          <h3>Aprobar</h3>
          <Campo etiqueta="DNI" ayuda="Sólo números.">
            <input
              className="control"
              inputMode="numeric"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Nombre completo como figura en el DNI">
            <input
              className="control"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </Campo>
          <div className="acciones">
            <Boton
              type="button"
              disabled={busy}
              onClick={() => enviar({ action: "approve", documentNumber, legalName })}
            >
              Aprobar la identidad
            </Boton>
          </div>
        </div>
        <div className="formulario">
          <h3>Rechazar</h3>
          <Campo etiqueta="Motivo" ayuda="Se le muestra a la persona.">
            <textarea
              className="control control-texto"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Campo>
          <div className="acciones">
            <Boton
              type="button"
              variante="peligro"
              disabled={busy}
              onClick={() => enviar({ action: "reject", reason })}
            >
              Rechazar la identidad
            </Boton>
          </div>
        </div>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
