import { Printer } from "lucide-react";

/** «Pedir copias impresas» en el enlace del cliente (galería): lleva a la pantalla compartida del pedido. */
export function EnlacePedirCopias({ href }: { href: string }) {
  return (
    <a href={href} className="fo-card flex items-center gap-3 border-2 border-[var(--fo-accent)] p-4 hover:bg-[var(--fo-surface-hover)]">
      <Printer className="size-6 shrink-0 text-[var(--fo-accent)]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Pedir copias impresas</span>
        <span className="block text-sm text-[var(--fo-text-secondary)]">Elegí tus fotos, el tamaño y cuántas copias querés, y pagalas online.</span>
      </span>
    </a>
  );
}
