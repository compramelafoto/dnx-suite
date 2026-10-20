import { PageHeader } from "@/components/page-header";
import { INTRO_DATOS, SECCIONES_DATOS, TITULO_DATOS } from "@/lib/dnx-bot/pagina-datos";

/**
 * «Cómo cuidamos tus datos»: qué guarda DNX Bot, quién lo ve y cuándo se borra. Es el enlace del
 * aviso de privacidad del bot. Página del panel (pide sesión, como todo `(shell)`); el texto vive
 * en `lib/dnx-bot/pagina-datos.ts`, verificado contra el código.
 */
export default function DatosDnxBotPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={TITULO_DATOS} description={INTRO_DATOS} />
      {SECCIONES_DATOS.map((s) => (
        <section key={s.titulo} className="fo-card space-y-2 p-4">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">{s.titulo}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--fo-text)]">
            {s.puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
