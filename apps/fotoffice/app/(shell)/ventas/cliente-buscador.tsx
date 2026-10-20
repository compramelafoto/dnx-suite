"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Search, UserRound, X } from "lucide-react";
import { Dialogo } from "./dialogo";
import { altaRapidaClienteAction, buscarClientesAction, type ClienteBuscado } from "./mostrador-actions";

function detalle(c: ClienteBuscado): string {
  return [c.documento ? `DNI ${c.documento}` : null, c.telefono, c.email].filter(Boolean).join(" · ") || `Cliente #${c.numero}`;
}

/**
 * El cliente de la venta: se busca por cualquier dato (nombre, apellido, DNI, correo o teléfono)
 * y, si no aparece, el "+" abre el alta en una ventana sin perder el ticket. Elegido, la venta
 * queda en su historial.
 */
export function ClienteBuscador({
  cliente,
  onElegir,
  puedeAlta,
}: {
  cliente: ClienteBuscado | null;
  onElegir: (c: ClienteBuscado | null) => void;
  puedeAlta: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ClienteBuscado[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, startBuscar] = useTransition();
  const [alta, setAlta] = useState(false);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => {
      startBuscar(async () => setResultados(await buscarClientesAction(q)));
    }, 250);
    return () => clearTimeout(id);
  }, [texto]);

  if (cliente) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-3 py-2">
        <UserRound className="size-5 shrink-0 text-[var(--fo-accent)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{cliente.nombre}</p>
          <p className="truncate text-xs text-[var(--fo-muted)]">{detalle(cliente)}</p>
        </div>
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
          aria-label="Sacar el cliente"
          title="Sacar el cliente"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  const q = texto.trim();
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]" aria-hidden />
          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setAbierto(false)}
            className="fo-input !pl-9 text-sm"
            placeholder="Buscar cliente"
            title="Por nombre, apellido, DNI, teléfono o correo"
            aria-label="Buscar cliente"
            autoComplete="off"
          />
        </div>
        {puedeAlta ? (
          <button
            type="button"
            onClick={() => setAlta(true)}
            className="fo-btn fo-btn-secondary shrink-0 px-3"
            aria-label="Cliente nuevo"
            title="Cliente nuevo"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {abierto && q.length >= 2 ? (
        <div
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] py-1 shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {resultados.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-[var(--fo-muted)]">
              {buscando ? "Buscando…" : "No hay ningún cliente con ese dato."}
              {!buscando && puedeAlta ? (
                <button
                  type="button"
                  onClick={() => setAlta(true)}
                  className="mt-1 block font-medium text-[var(--fo-accent)] hover:underline"
                >
                  + Darlo de alta
                </button>
              ) : null}
            </div>
          ) : (
            resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onElegir(c);
                  setTexto("");
                }}
                className="block w-full px-3 py-2 text-left hover:bg-[var(--fo-accent-muted)]"
              >
                <p className="truncate text-sm font-medium">{c.nombre}</p>
                <p className="truncate text-xs text-[var(--fo-muted)]">{detalle(c)}</p>
              </button>
            ))
          )}
        </div>
      ) : null}

      {alta ? (
        <AltaCliente
          inicial={texto}
          onCerrar={() => setAlta(false)}
          onListo={(c) => {
            onElegir(c);
            setTexto("");
            setAlta(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Lo que se tipeó en el buscador se usa para precargar el alta: un número es DNI o teléfono, con @ es correo. */
function precarga(inicial: string) {
  const t = inicial.trim();
  if (t.includes("@")) return { email: t };
  const digitos = t.replace(/\D/g, "");
  if (digitos.length >= 7 && digitos.length <= 8 && digitos.length === t.replace(/[.\s-]/g, "").length) return { docNumber: digitos };
  if (digitos.length >= 9) return { phone: t };
  const [nombre, ...resto] = t.split(/\s+/);
  return { firstName: nombre ?? "", lastName: resto.join(" ") };
}

function AltaCliente({
  inicial,
  onCerrar,
  onListo,
}: {
  inicial: string;
  onCerrar: () => void;
  onListo: (c: ClienteBuscado) => void;
}) {
  const p = precarga(inicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  return (
    <Dialogo titulo="Cliente nuevo" onCerrar={onCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startGuardar(async () => {
            const r = await altaRapidaClienteAction(fd);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            if (r.yaExistia) {
              setAviso(`Ya estaba cargado como ${r.cliente.nombre}: se usa esa ficha.`);
              setTimeout(() => onListo(r.cliente), 1200);
              return;
            }
            onListo(r.cliente);
          });
        }}
      >
        <input type="hidden" name="kind" value="PERSONA" />
        <div className="grid grid-cols-2 gap-3">
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Nombre</span>
            <input name="firstName" defaultValue={p.firstName ?? ""} className="fo-input" autoComplete="off" />
          </label>
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Apellido</span>
            <input name="lastName" defaultValue={p.lastName ?? ""} className="fo-input" autoComplete="off" />
          </label>
        </div>
        <label className="fo-field-stack text-sm">
          <span className="fo-label">DNI</span>
          <input name="docNumber" defaultValue={p.docNumber ?? ""} className="fo-input" inputMode="numeric" autoComplete="off" />
        </label>
        <label className="fo-field-stack text-sm">
          <span className="fo-label">Teléfono o WhatsApp</span>
          <input name="phone" defaultValue={p.phone ?? ""} className="fo-input" inputMode="tel" autoComplete="off" />
        </label>
        <label className="fo-field-stack text-sm">
          <span className="fo-label">Correo</span>
          <input name="email" type="email" defaultValue={p.email ?? ""} className="fo-input" autoComplete="off" />
        </label>
        <p className="fo-helper">Alcanza con el nombre o el apellido. Si el DNI, el teléfono o el correo ya son de un cliente, se usa esa ficha.</p>
        {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
        {aviso ? <p className="text-sm text-[var(--fo-success)]">{aviso}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="fo-btn fo-btn-secondary text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="fo-btn fo-btn-primary text-sm">
            {guardando ? "Guardando…" : "Guardar y usar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
