import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Bloque, Segmento } from "@/lib/contratos/formato";
import { resolverTokenFirmantePorWorkspace } from "@/lib/contratos/enlace";
import { armarVistaFirma, type EstadoFirmante } from "@/lib/contratos/publico";
import { registrarVista } from "@/lib/contratos/firma";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { FirmaFlujo } from "./firma-flujo";
import { abreAlguienDelEquipo, visitanteDelEnlace } from "./visitante";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es del firmante: no se indexa, y la dirección (que lleva el token) no se manda a ningún sitio que se
  // abra desde acá. El encabezado HTTP lo pone `next.config.ts`.
  return { title: "Contrato para firmar", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function Texto({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => (s.negrita ? <strong key={i}>{s.texto}</strong> : <span key={i}>{s.texto}</span>))}
    </>
  );
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {bloques.map((b, i) => {
        if (b.tipo === "titulo") {
          return b.nivel === 1 ? (
            <h2 key={i} className="pt-2 text-lg font-semibold"><Texto segmentos={b.segmentos} /></h2>
          ) : (
            <h3 key={i} className="pt-1 text-base font-semibold"><Texto segmentos={b.segmentos} /></h3>
          );
        }
        if (b.tipo === "parrafo") return <p key={i} className="whitespace-pre-line"><Texto segmentos={b.segmentos} /></p>;
        if (b.tipo === "salto") return <hr key={i} className="my-4 border-dashed" aria-label="Salto de página" />;
        const [cabecera, ...filas] = b.filas;
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>{cabecera?.map((c, j) => <th key={j} className="border-b px-2 py-1 font-semibold">{c}</th>)}</tr>
              </thead>
              <tbody>
                {filas.map((f, j) => (
                  <tr key={j}>{f.map((c, k) => <td key={k} className="border-b px-2 py-1">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const ETIQUETA_ESTADO: Record<EstadoFirmante, string> = { FIRMO: "firmó", RECHAZO: "no está de acuerdo", PENDIENTE: "pendiente" };

/**
 * El enlace de firma de un contrato (etapa 5), sin sesión: el token es la llave y es personal de cada
 * firmante. Enlace desconocido, de otra organización, vencido, de una versión reemplazada o de un contrato
 * anulado: el mismo "Este enlace ya no es válido" (404). La primera apertura deja `viewedAt` y el evento.
 */
export default async function ContratoPublicoPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDelEnlace();
  if (!visitante.permitido) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const r = await resolverTokenFirmantePorWorkspace(workspaceId, token);
  if (!r.ok) notFound();
  // Si lo abre alguien del equipo (con sesión), no cuenta como apertura del firmante.
  if (!(await abreAlguienDelEquipo(workspaceId))) await registrarVista(workspaceId, r);
  const vista = await armarVistaFirma(workspaceId, r);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <header className="flex items-center gap-3">
        {vista.organizacion.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista.organizacion.logoUrl} alt="" className="h-10 w-auto" referrerPolicy="no-referrer" />
        ) : null}
        <div>
          <p className="text-sm opacity-70">{vista.organizacion.nombre}</p>
          <h1 className="text-xl font-semibold">Contrato {vista.contrato.numero}</h1>
        </div>
      </header>

      {vista.aviso ? <p className="fo-card p-4 font-semibold">{vista.aviso}</p> : null}

      {vista.yo.estado === "FIRMO" ? (
        <section className="fo-card space-y-1 p-4 text-sm">
          <h2 className="text-base font-semibold">Firmado</h2>
          <p>Firmaste este contrato{vista.yo.firmadoEn ? ` el ${vista.yo.firmadoEn}` : ""}.</p>
          <p className="opacity-70">{vista.leyenda}</p>
          {vista.pdfDisponible ? (
            // Dirección relativa: sirve igual en `/w/<slug>/contrato/<token>` y en el dominio propio.
            <p className="pt-1">
              <a href={`${encodeURIComponent(token)}/pdf`} className="fo-btn fo-btn-secondary text-sm" download>
                Descargar PDF
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      <article className="fo-card space-y-4 p-4 md:p-6">
        <Bloques bloques={vista.bloques} />
        {vista.empresa.firmaUrl ? (
          <figure className="pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vista.empresa.firmaUrl} alt={`Firma de ${vista.empresa.nombre ?? "la empresa"}`} className="max-h-24 w-auto" referrerPolicy="no-referrer" />
            <figcaption className="text-sm opacity-70">{vista.empresa.nombre ?? "Por la empresa"}</figcaption>
          </figure>
        ) : null}
      </article>

      <section className="fo-card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">Quiénes firman</h2>
        <ul className="space-y-1">
          {vista.firmantes.map((f, i) => (
            <li key={i}>
              {f.nombre}{f.esUsted ? " (vos)" : ""}: {ETIQUETA_ESTADO[f.estado]}
            </li>
          ))}
        </ul>
        <p className="text-xs opacity-70">{vista.leyenda}</p>
      </section>

      {vista.puedeActuar ? (
        <FirmaFlujo
          slug={workspaceSlug}
          token={token}
          nombreInicial={vista.yo.nombreEscrito ?? vista.yo.nombre}
          clausula={vista.clausula}
          leyenda={vista.leyenda}
          verificado={vista.yo.verificado}
        />
      ) : null}
    </main>
  );
}
