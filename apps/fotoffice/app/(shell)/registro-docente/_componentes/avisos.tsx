export function Avisos({ error, ok }: { error?: string; ok?: string }) {
  return (
    <>
      {error ? <p className="fo-alert-error">{error}</p> : null}
      {ok ? <p className="fo-alert-success">{ok}</p> : null}
    </>
  );
}

export type ConAvisos = { searchParams: Promise<{ error?: string; ok?: string }> };
