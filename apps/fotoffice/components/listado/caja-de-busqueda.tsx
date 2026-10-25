"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const ESPERA_MS = 500;

/**
 * Búsqueda mientras se escribe: espera medio segundo sin teclear y busca con dos letras o más
 * (o cuando el campo quedó vacío). Cambiar la búsqueda vuelve a la página 1 y cierra el panel.
 */
export function CajaDeBusqueda({ valorInicial, placeholder }: { valorInicial: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(valorInicial);
  // Lo último que esta caja mandó a la dirección, para distinguirlo de un cambio de afuera (un chip).
  const [aplicado, setAplicado] = useState(valorInicial);
  const [previo, setPrevio] = useState(valorInicial);

  if (valorInicial !== previo) {
    setPrevio(valorInicial);
    if (valorInicial !== aplicado) {
      setValor(valorInicial);
      setAplicado(valorInicial);
    }
  }

  useEffect(() => {
    const texto = valor.trim();
    if (texto === aplicado.trim()) return;
    if (!(texto.length >= 2 || texto.length === 0)) return;
    const t = window.setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (texto) sp.set("q", texto);
      else sp.delete("q");
      for (const k of ["pagina", "ver", "limpio", "vista"]) sp.delete(k);
      // Sin nada en la dirección el listado volvería a la última consulta, que tenía esta búsqueda.
      if (sp.size === 0) sp.set("limpio", "1");
      setAplicado(texto);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }, ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [valor, aplicado, searchParams, pathname, router]);

  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:max-w-sm">
      <span className="sr-only">Buscar</span>
      <Search className="pointer-events-none absolute left-3 size-4 text-[var(--fo-muted)]" aria-hidden />
      <input
        type="search"
        className="fo-input !pl-9"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={100}
      />
    </label>
  );
}

/** Mientras la caja real se hidrata (usa la dirección del navegador), se muestra una igual y quieta. */
export function CajaDeBusquedaQuieta({ valorInicial, placeholder }: { valorInicial: string; placeholder: string }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:max-w-sm">
      <span className="sr-only">Buscar</span>
      <Search className="pointer-events-none absolute left-3 size-4 text-[var(--fo-muted)]" aria-hidden />
      <input type="search" className="fo-input !pl-9" placeholder={placeholder} defaultValue={valorInicial} readOnly />
    </label>
  );
}
