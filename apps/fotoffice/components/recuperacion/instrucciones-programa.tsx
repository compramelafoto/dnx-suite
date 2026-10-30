"use client";

import { useState } from "react";

/** Cómo correr el programa: el código del caso y los dos caminos, Mac y Windows. */
export function InstruccionesPrograma({ codigo, comandoMac, descargaWindows }: { codigo: string; comandoMac: string; descargaWindows: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, cual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
    } catch {
      setCopiado(null);
    }
  }

  const mensaje = `Para recuperar las fotos de tu tarjeta:\n\n1. Conectá la tarjeta a la computadora.\n2. En Mac: abrí la app Terminal, pegá esto y apretá Enter:\n${comandoMac}\n   En Windows: bajá el programa de ${descargaWindows} y abrilo.\n3. Si te pide el código, es ${codigo}.\n\nLa tarjeta sólo se lee: no se borra ni se modifica nada.`;

  return (
    <section className="fo-card space-y-5 p-5" aria-labelledby="rec-instrucciones">
      <div className="space-y-1">
        <h2 id="rec-instrucciones" className="text-base font-semibold">Esperando el programa</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Conectá la tarjeta a la computadora (con un lector o con la cámara por cable) y corré el programa ahí. Puede ser la computadora del estudio o la del cliente: lo recuperado queda guardado en esa computadora, y acá vas a ver el avance y las miniaturas.
        </p>
      </div>

      <div>
        <p className="text-sm text-[var(--fo-muted)]">Código del caso</p>
        <p className="font-mono text-3xl font-semibold tracking-widest" data-testid="codigo-caso">{codigo}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">En Mac</h3>
        <p className="text-sm text-[var(--fo-muted)]">Abrí la app <strong>Terminal</strong> (está en Aplicaciones → Utilidades), pegá esta línea y apretá Enter. Te va a pedir la contraseña de la Mac: al escribirla no se ven los caracteres.</p>
        <code className="block break-all rounded-md border border-[var(--fo-border)] p-3 text-xs">{comandoMac}</code>
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => copiar(comandoMac, "mac")}>{copiado === "mac" ? "Copiado" : "Copiar comando"}</button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">En Windows</h3>
        <p className="text-sm text-[var(--fo-muted)]">Bajá el programa y abrilo. Windows va a pedir permiso de administrador; si aparece «Windows protegió su PC», tocá «Más información» y «Ejecutar de todas formas». Cuando pida el código, escribí el de arriba.</p>
        <a className="fo-btn fo-btn-primary" href={descargaWindows}>Bajar para Windows</a>
      </div>

      <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
        <p className="text-sm text-[var(--fo-muted)]">¿La tarjeta la tiene el cliente? Mandale estas instrucciones por WhatsApp o correo.</p>
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => copiar(mensaje, "mensaje")}>{copiado === "mensaje" ? "Copiadas" : "Copiar instrucciones para el cliente"}</button>
      </div>
    </section>
  );
}
