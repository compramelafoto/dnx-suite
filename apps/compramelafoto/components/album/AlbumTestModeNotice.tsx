/**
 * Avisos de modo prueba (TEST) para vista pública simulada y panel del fotógrafo.
 */
export function AlbumTestModeClientBanner() {
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2.5 text-center text-sm font-medium">
      Vista simulada — modo TEST
    </div>
  );
}

export function AlbumTestModeDashboardAlert() {
  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center gap-2"
      role="status"
    >
      <span className="inline-flex shrink-0 items-center rounded bg-amber-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950">
        TEST
      </span>
      <span>
        Este proyecto está en modo prueba. No es visible para clientes y no genera ventas reales.
      </span>
    </div>
  );
}
