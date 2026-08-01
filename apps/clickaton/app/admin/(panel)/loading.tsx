export default function AdminPanelLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-ck-text">Cargando el panel…</p>
      <p className="max-w-sm text-sm text-ck-text-muted">
        Estamos preparando la información administrativa.
      </p>
    </div>
  );
}
