import Link from "next/link";
import type { Verificacion } from "@/lib/ventas/verificar";

/**
 * Lo que dice `/verificar/<código>` (etapa 8, D19). Sin datos del comprador salvo que haya aceptado
 * figurar; la miniatura sólo si la obra se ve online.
 */
export const NO_ENCONTRADO = "No encontramos un certificado con ese código. Revisá que esté bien escrito.";

const COLOR: Record<string, string> = {
  VALID: "border-[var(--mf-ink)]",
  TEST: "border-[var(--mf-alerta)]",
  VOIDED: "border-[var(--mf-alerta)]",
  INVALID_SIGNATURE: "border-[var(--mf-alerta)]",
};

export function VistaDeVerificacion({ v }: { v: Verificacion }) {
  if (!v.encontrado) return <p className="text-lg">{NO_ENCONTRADO}</p>;
  const valida = v.estado !== "INVALID_SIGNATURE";
  return (
    <div className="space-y-6">
      <p className={`border-l-2 pl-4 text-lg leading-snug ${COLOR[v.estado] ?? ""}`}>{v.titulo}</p>
      {valida ? (
        <>
          {v.miniatura ? (
            <figure className="bg-[var(--mf-surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.miniatura} alt={`${v.obra}, de ${v.autor}`} className="mx-auto max-h-[50vh] w-auto object-contain" />
            </figure>
          ) : null}
          <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
            <dt className="text-[var(--mf-muted)]">Obra</dt>
            <dd>{v.enlaceObra ? <Link href={v.enlaceObra} className="underline underline-offset-[6px]">{v.obra}</Link> : v.obra}</dd>
            <dt className="text-[var(--mf-muted)]">Autor</dt>
            <dd>{v.enlaceAutor ? <Link href={v.enlaceAutor} className="underline underline-offset-[6px]">{v.autor}</Link> : v.autor}</dd>
            <dt className="text-[var(--mf-muted)]">Copia</dt>
            <dd>{v.numero}</dd>
            {v.formato ? (<><dt className="text-[var(--mf-muted)]">Formato</dt><dd>{v.formato}</dd></>) : null}
            {v.papelYMedida ? (<><dt className="text-[var(--mf-muted)]">Papel y medida</dt><dd>{v.papelYMedida}</dd></>) : null}
            <dt className="text-[var(--mf-muted)]">Muestra</dt>
            <dd>{v.muestra}</dd>
            {v.comprador ? (<><dt className="text-[var(--mf-muted)]">A nombre de</dt><dd>{v.comprador}</dd></>) : null}
            <dt className="text-[var(--mf-muted)]">Código</dt>
            <dd className="font-mono">{v.codigo}</dd>
          </dl>
          {v.estado === "VALID" ? <p className="text-sm text-[var(--mf-muted)]">Firma digital verificada.</p> : null}
        </>
      ) : null}
    </div>
  );
}
