import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { VistaDeVerificacion } from "@/components/ventas/verificacion";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { verificarCodigo } from "@/lib/ventas/verificar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificado de autenticidad", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ codigo: string }> };

/**
 * La verificación pública de un certificado (etapa 8, D19): dinámica, sin indexar, con freno por IP.
 * La firma se verifica en cada visita con la clave pública.
 */
export default async function Certificado({ params }: Props) {
  const { codigo } = await params;
  const ip = ipDeLaPeticion(await headers());
  const frenado = !frenarPorIp("verificar", ip).allowed;
  const v = frenado ? null : await verificarCodigo(decodeURIComponent(codigo).slice(0, 40));
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p className="text-sm text-[var(--mf-muted)]">Certificado de autenticidad</p>
      {v ? <VistaDeVerificacion v={v} /> : <p className="text-lg">Hiciste muchas consultas seguidas. Esperá unos minutos.</p>}
      <p className="border-t border-[var(--mf-line)] pt-4 text-sm text-[var(--mf-muted)]">
        <Link href="/verificar" className="underline underline-offset-[6px]">Verificar otro código</Link>
        {" · "}
        <Link href="/verificar/clave" className="underline underline-offset-[6px]">Clave pública de DNX</Link>
      </p>
    </main>
  );
}
