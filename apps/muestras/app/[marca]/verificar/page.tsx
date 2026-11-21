import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeCertificateCode } from "@repo/muestras";
import { NO_ENCONTRADO } from "@/components/ventas/verificacion";
import { boton, campo } from "@/components/ventas/estilos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificar un certificado", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { searchParams: Promise<{ codigo?: string | string[] }> };

/** "Escribí el código del certificado" (etapa 8, D19). */
export default async function Verificar({ searchParams }: Props) {
  const crudo = (await searchParams).codigo;
  const escrito = typeof crudo === "string" ? crudo.slice(0, 40) : "";
  const codigo = escrito ? normalizeCertificateCode(escrito) : null;
  if (codigo) redirect(`/verificar/${codigo}`);
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">Verificar un certificado</h1>
      <p className="text-[15px]">Cada copia vendida en Muestras Fotográficas tiene un certificado con un código y un QR. Escribí el código para ver si es auténtico.</p>
      <form method="get" action="/verificar" className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 space-y-1">
          <span className="text-sm">Escribí el código del certificado</span>
          <input name="codigo" defaultValue={escrito} required maxLength={40} autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH-JKMN" className={`${campo} font-mono uppercase`} />
        </label>
        <button type="submit" className={boton}>Verificar</button>
      </form>
      {escrito && !codigo ? <p role="alert" className="text-[15px]">{NO_ENCONTRADO}</p> : null}
    </main>
  );
}
