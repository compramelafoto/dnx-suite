"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/app/_ui/Aviso";
import { Boton } from "@/app/_ui/Boton";
import { Campo } from "@/app/_ui/Campo";

type Cuerpo =
  | { accion: "bloquear"; motivo: string }
  | { accion: "desbloquear" }
  | { accion: "resolver"; reportId: number; resolucion: string };

/** Manda la acción a `/api/admin/usuarios/<id>` y refresca la pantalla si salió bien. */
function useAccion(userId: number) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(cuerpo: Cuerpo): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (res.ok) {
        router.refresh();
        return true;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "No se pudo guardar el cambio");
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
    return false;
  }
  return { enviar, error, busy };
}

/** Bloquear una cuenta: motivo interno obligatorio (la persona nunca lo ve). */
export function BloquearCuenta({ userId }: { userId: number }) {
  const { enviar, error, busy } = useAccion(userId);
  const [motivo, setMotivo] = useState("");
  return (
    <form
      className="formulario"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await enviar({ accion: "bloquear", motivo })) setMotivo("");
      }}
    >
      <Campo
        etiqueta="Motivo interno del bloqueo"
        ayuda="Entre 10 y 500 caracteres. La persona no lo ve: recibe un correo que sólo dice que su cuenta fue suspendida."
      >
        <textarea
          className="control control-texto"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>
      <div className="acciones">
        <Boton variante="peligro" disabled={busy}>
          Bloquear cuenta
        </Boton>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </form>
  );
}

export function DesbloquearCuenta({ userId }: { userId: number }) {
  const { enviar, error, busy } = useAccion(userId);
  return (
    <div className="pila">
      <div className="acciones">
        <Boton
          type="button"
          variante="secundario"
          disabled={busy}
          onClick={() => enviar({ accion: "desbloquear" })}
        >
          Desbloquear
        </Boton>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}

/** Cerrar un reporte con una nota interna de cómo se resolvió. */
export function ResolverReporte({ userId, reportId }: { userId: number; reportId: number }) {
  const { enviar, error, busy } = useAccion(userId);
  const [resolucion, setResolucion] = useState("");
  return (
    <form
      className="formulario"
      onSubmit={async (e) => {
        e.preventDefault();
        await enviar({ accion: "resolver", reportId, resolucion });
      }}
    >
      <Campo etiqueta="Cómo se resolvió" ayuda="Nota interna, hasta 500 caracteres.">
        <textarea
          className="control control-texto"
          rows={2}
          maxLength={500}
          required
          value={resolucion}
          onChange={(e) => setResolucion(e.target.value)}
        />
      </Campo>
      <div className="acciones">
        <Boton variante="secundario" disabled={busy}>
          Marcar como resuelto
        </Boton>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </form>
  );
}
