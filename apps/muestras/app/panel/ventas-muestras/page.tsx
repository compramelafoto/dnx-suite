import Link from "next/link";
import { formatArDay } from "@repo/muestras";
import { enlace, nota } from "@/components/ventas/estilos";
import { muestrasConVenta } from "@/lib/ventas/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas" };

const ESTADO: Record<string, string> = { DRAFT: "Sin abrir", OPEN: "Venta abierta", PAUSED: "Venta pausada", CLOSED: "Venta terminada" };

/** "Ventas" del menú: cada muestra con su venta (etapa 8). */
export default async function VentasDeMisMuestras() {
  const usuario = await requireUsuario("/panel/ventas-muestras");
  const muestras = await muestrasConVenta(usuario);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Ventas</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Vendé copias digitales firmadas e impresas Fine Art de las obras de tu muestra, únicas o en ediciones limitadas con certificado y QR. Mercado Pago reparte cada cobro en el momento entre la organización, el fotógrafo/a y la plataforma.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando organices una muestra, acá vas a encender su venta. <Link href="/panel/proponer" className={enlace}>Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => (
            <li key={m.id} className="space-y-1 border-b border-[var(--mf-line)] py-5">
              <h2 className="mf-titulo text-[1.6rem]"><Link href={m.href} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
              <p className={nota}>
                {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)} · {m.saleSetup ? ESTADO[m.saleSetup.status] ?? m.saleSetup.status : "Venta sin configurar"}
                {m.isCancelled ? " · Cancelada" : ""}
              </p>
              {m.paraRevisar ? <p className="text-[15px] text-[var(--mf-alerta)]">{m.paraRevisar === 1 ? "Un formato para revisar." : `${m.paraRevisar} formatos para revisar.`}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className={nota}>Para recibir tu parte, conectá tu Mercado Pago en <Link href="/panel/cobros" className={enlace}>Cobros</Link>.</p>
    </main>
  );
}
