export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-8 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#a67341]">
        Oleada 0 — Esqueleto monorepo
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] md:text-4xl">
        ComprameLaFoto
      </h1>
      <p className="text-base leading-relaxed text-[#6b7280]">
        App inicializada en <code className="text-sm">apps/compramelafoto</code> con bridges a{" "}
        <code className="text-sm">@repo/db</code>, <code className="text-sm">@repo/auth</code> y{" "}
        <code className="text-sm">@repo/design-system</code>. El código legacy se importará en
        oleadas siguientes según{" "}
        <code className="text-sm">docs/architecture/migration/22-code-import-execution-plan.md</code>
        .
      </p>
      <p className="text-sm text-[#6b7280]">
        Dev local: <code className="text-sm">pnpm --filter compramelafoto dev</code> (puerto 3002)
      </p>
    </main>
  );
}
