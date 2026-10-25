import Link from "next/link";
import { SALE_ASK_TEXT, SALE_UNAVAILABLE_TEXT } from "@repo/muestras";
import type { PaginaDeCompra } from "@/lib/ventas/compra";
import { FormularioDeCompra } from "./formulario-compra";

/**
 * "Adquirir obra" (etapa 8): la misma pantalla en la sala (con el pase) y en la página pública. Sin
 * la venta encendida para quien mira, es exactamente lo de antes: título, autor, "La venta de esta
 * obra todavía no está disponible" y volver. **Sin precio.**
 */
export function Compra({
  d, obra, volver,
}: {
  d: Exclude<PaginaDeCompra, { estado: "NOT_FOR_SALE" }>;
  obra: { title: string; authorName: string; imagen: string | null };
  volver: string;
}) {
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p className="text-sm text-[var(--mf-muted)]">Adquirir obra</p>
      {d.estado === "AVAILABLE" && d.modoPrueba ? (
        <p className="rounded-[2px] bg-[var(--mf-surface)] p-3 text-[15px]">Modo prueba: sólo vos ves esto. Usá tarjetas y emails de prueba.</p>
      ) : null}
      {d.estado === "AVAILABLE" && obra.imagen ? (
        <figure className="bg-[var(--mf-surface)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={obra.imagen} alt={`${obra.title}, de ${obra.authorName}`} className="mx-auto max-h-[60vh] w-auto object-contain" />
        </figure>
      ) : null}
      <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{obra.title}</h1>
      <p className="text-lg">{obra.authorName}</p>
      {d.estado === "UNAVAILABLE" ? (
        <>
          <p className="border-t border-[var(--mf-line)] pt-6 text-lg">{SALE_UNAVAILABLE_TEXT}</p>
          <p className="text-[15px]">{SALE_ASK_TEXT}</p>
        </>
      ) : null}
      {d.estado === "SOLD_OUT" ? (
        <>
          <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Se vendieron todas las copias de esta obra.</p>
          <p className="text-[15px]">{SALE_ASK_TEXT}</p>
        </>
      ) : null}
      {d.estado === "AVAILABLE" ? <FormularioDeCompra d={d} /> : null}
      <p><Link href={volver} className="underline underline-offset-[6px]">Volver a la obra</Link></p>
    </main>
  );
}
