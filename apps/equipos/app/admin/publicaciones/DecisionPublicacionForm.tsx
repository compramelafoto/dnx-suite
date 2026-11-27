"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/app/_ui/Aviso";
import { Boton } from "@/app/_ui/Boton";
import { Campo } from "@/app/_ui/Campo";

export function DecisionPublicacionForm({ id }: { id: number }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publicaciones/${id}`, {
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
          <p className="texto-secundario">La publicación sale al catálogo y se avisa al vendedor.</p>
          <div className="acciones">
            <Boton type="button" disabled={busy} onClick={() => enviar({ accion: "aprobar" })}>
              Aprobar la publicación
            </Boton>
          </div>
        </div>
        <div className="formulario">
          <h3>Rechazar</h3>
          <Campo etiqueta="Nota interna" ayuda="Obligatoria. No se le muestra al vendedor.">
            <textarea
              className="control control-texto"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </Campo>
          <div className="acciones">
            <Boton
              type="button"
              variante="peligro"
              disabled={busy || !nota.trim()}
              onClick={() => enviar({ accion: "rechazar", nota })}
            >
              Rechazar la publicación
            </Boton>
          </div>
        </div>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
