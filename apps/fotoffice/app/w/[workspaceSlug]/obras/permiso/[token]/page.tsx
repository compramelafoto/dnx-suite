import type { Metadata } from "next";
import { formatMinorArs } from "@/lib/membership/money";
import { loadConsentView, type ConsentView } from "@/lib/store/artworks/consent";
import { royaltyPercentLabel } from "@/lib/store/artworks/consent-email";
import { buildPreviewUrl } from "@/lib/store/artworks/fotorank-client";
import { loadStoreWorkspace } from "@/lib/store/repository";
import { ConsentActions } from "./consent-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es del autor: no se indexa, y la dirección (que lleva el token) no se manda a ningún sitio
  // que se abra desde acá. El encabezado HTTP lo pone `next.config.ts`.
  return { title: "Tu obra en la tienda", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function fechaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Vista previa: la guardada en el R2 de FOTOFFICE si la obra ya se preparó; si no, un enlace
 * firmado de FotoRank recién hecho (vence en 10 minutos, alcanza para esta visita). Sin vínculo,
 * o si el autor ya dijo que no, no se firma nada.
 */
function vistaPrevia(v: ConsentView): string | null {
  if (v.storedPreviewUrl) return v.storedPreviewUrl;
  if (!v.contestLinked || v.status === "DECLINED" || v.status === "WITHDRAWN") return null;
  try {
    return buildPreviewUrl(v.entryId, `Muestra · ${v.institution}`);
  } catch {
    return null;
  }
}

function Estado({ v }: { v: ConsentView }) {
  const texto: Record<ConsentView["status"], string> = {
    NOTIFIED: `Las bases del concurso permiten que ${v.institution} ofrezca tu obra en su tienda. Si preferís que no esté, podés retirarla cuando quieras.`,
    PENDING: `${v.institution} quiere ofrecer tu obra en su tienda y necesita tu permiso. Si aceptás, más adelante podés retirarla cuando quieras.`,
    GRANTED: "Aceptaste que tu obra se ofrezca en la tienda. Gracias. Si cambiás de idea, podés retirarla cuando quieras.",
    DECLINED: "No aceptaste que tu obra se venda. No va a estar en la tienda.",
    WITHDRAWN: "Retiraste tu obra de la tienda. Ya no está a la venta. Los pedidos que ya se habían pagado se entregan igual.",
  };
  return <p className="text-[var(--fo-muted)]">{texto[v.status]}</p>;
}

/**
 * La página del enlace del correo al autor (spec O5). Sin cuenta: el token es la llave. Funciona
 * con la tienda cerrada. Enlace desconocido, de otra institución o vencido → el mismo mensaje.
 */
export default async function ArtworkConsentPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const store = await loadStoreWorkspace(workspaceSlug);
  const v = store ? await loadConsentView(store.workspace.id, token) : null;

  if (!store || !v) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-12 md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Enlace no válido</h1>
        <p className="text-[var(--fo-muted)]">Este enlace ya no es válido. Pedile uno nuevo a la institución.</p>
      </main>
    );
  }

  const imagen = vistaPrevia(v);
  const regalia = royaltyPercentLabel(v.royaltyBps);
  const muestraCondiciones = v.status !== "DECLINED" && v.status !== "WITHDRAWN";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <header className="space-y-1">
        <p className="text-sm text-[var(--fo-muted)]">
          {v.institution}
          {v.contestTitle ? ` · ${v.contestTitle}` : ""}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">«{v.artworkTitle}»</h1>
      </header>

      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa en R2 o enlace firmado de FotoRank
        <img
          src={imagen}
          alt={`Vista previa de «${v.artworkTitle}»`}
          className="w-full rounded-lg border border-[var(--fo-border)]"
          referrerPolicy="no-referrer"
        />
      ) : null}

      <section className="fo-card space-y-4 p-6">
        <Estado v={v} />
        <ConsentActions workspaceSlug={store.workspace.slug} token={token} actions={v.actions} />
      </section>

      {muestraCondiciones ? (
        <section className="fo-card space-y-3 p-6">
          <h2 className="text-lg font-semibold">Qué significa para vos</h2>
          <p>
            Tu obra se ofrecería impresa en la tienda online de {v.institution}, siempre con la calidad que permite tu
            archivo original. Por cada copia que se venda te corresponde el <strong>{regalia}</strong> del precio de la
            obra (sin contar el envío).
          </p>
          {v.formats.length > 0 ? (
            <ul className="divide-y divide-[var(--fo-border)]">
              {v.formats.map((f, i) => (
                <li key={i} className="flex items-start justify-between gap-4 py-2 text-sm">
                  <span>
                    {f.name} ({f.widthCm} × {f.heightCm} cm)
                  </span>
                  <span className="shrink-0 font-medium">{formatMinorArs(f.priceMinor)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-[var(--fo-muted)]">
            Algunos formatos pueden no ofrecerse si el archivo no tiene resolución suficiente para ese tamaño.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-[var(--fo-muted)]">
        Este enlace es personal y vale hasta el {fechaArgentina(v.expiresAt)}. Si tenés dudas, escribile a{" "}
        {v.institution}.
      </p>
    </main>
  );
}
