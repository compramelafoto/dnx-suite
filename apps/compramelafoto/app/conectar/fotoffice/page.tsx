import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { recortarNombreEspacio, retornoPermitido } from "@/lib/fotoffice-conexion/llaves";
import { autorizarFotofficeAction, cancelarFotofficeAction } from "./actions";
import { stateValido } from "./state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conectar con FOTOFFICE | CompraMeLaFoto",
  robots: { index: false, follow: false },
};

type Busqueda = { state?: string | string[]; espacio?: string | string[]; vuelta?: string | string[]; invalido?: string };

const uno = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">Conectar una app</p>
      <div className="mt-3 rounded-2xl border border-[#111827]/10 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function EnlaceInvalido() {
  return (
    <Marco>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Este enlace de conexión no es válido</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#5a5a5a]">
        Volvé a FOTOFFICE y tocá de nuevo «Conectar con CompraMeLaFoto». No se compartió ningún dato.
      </p>
      <Link href="/fotografo/dashboard" className="mt-5 inline-block text-sm font-medium text-[#c27b3d] hover:underline">
        Ir a mi panel
      </Link>
    </Marco>
  );
}

/**
 * GET /conectar/fotoffice?state&espacio&vuelta
 * Pantalla de consentimiento: el fotógrafo, con su sesión de CLF, autoriza a un espacio de FOTOFFICE a leer sus
 * ventas (ver docs del diseño §5.1). `vuelta` tiene que estar exactamente en la lista blanca.
 */
export default async function ConectarFotofficePage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const q = await searchParams;
  const state = uno(q.state);
  const vuelta = uno(q.vuelta);
  const espacioCrudo = uno(q.espacio);

  if (q.invalido || !retornoPermitido(vuelta) || !stateValido(state)) return <EnlaceInvalido />;

  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error === "No autenticado") {
    const qs = new URLSearchParams({ state, espacio: espacioCrudo, vuelta }).toString();
    redirect(`/login?redirect=${encodeURIComponent(`/conectar/fotoffice?${qs}`)}`);
  }
  if (!user) {
    return (
      <Marco>
        <h1 className="text-xl font-semibold text-[#1a1a1a]">Necesitás una cuenta de fotógrafo</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a5a5a]">
          Sólo una cuenta de fotógrafo de CompraMeLaFoto puede conectar sus ventas con FOTOFFICE. Iniciá sesión con
          esa cuenta y volvé a intentarlo desde FOTOFFICE.
        </p>
        <form action={cancelarFotofficeAction} className="mt-5">
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="vuelta" value={vuelta} />
          <button type="submit" className="rounded-lg border border-[#111827]/15 px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f9fafb]">
            Volver a FOTOFFICE
          </button>
        </form>
      </Marco>
    );
  }

  const espacio = recortarNombreEspacio(espacioCrudo) || "Un espacio";

  return (
    <Marco>
      <h1 className="text-xl font-semibold leading-snug text-[#1a1a1a]">
        <strong>{espacio} (FOTOFFICE)</strong> quiere ver tus ventas de CompraMeLaFoto
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#5a5a5a]">
        Vas a conectar la cuenta <strong className="text-[#1a1a1a]">{user.name?.trim() || user.email}</strong>. Va a ver
        tus ventas: álbum, pack, fecha, monto e id de pago de Mercado Pago.{" "}
        <strong className="text-[#1a1a1a]">No va a ver datos de compradores ni de alumnos.</strong>
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f0fdf4] p-4">
          <p className="text-sm font-semibold text-[#166534]">Qué comparte</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#14532d]">
            <li>Álbum (nombre) y detalle del pack o las fotos</li>
            <li>Fecha y estado de cada venta</li>
            <li>Lo que pagó la familia, las comisiones y tu neto</li>
            <li>El id del pago y de tu cuenta de Mercado Pago</li>
          </ul>
        </div>
        <div className="rounded-xl bg-[#fef2f2] p-4">
          <p className="text-sm font-semibold text-[#991b1b]">Qué no comparte nunca</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#7f1d1d]">
            <li>Nombre, correo o teléfono de quien compra</li>
            <li>Datos de alumnos (nombre, curso, notas)</li>
            <li>Selfies, fotos ni direcciones</li>
            <li>Tus claves de Mercado Pago</li>
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
        Sólo entran los álbumes de los que sos dueño. Podés quitar el acceso cuando quieras desde Configuración → Apps
        conectadas, o desconectando desde FOTOFFICE.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={autorizarFotofficeAction}>
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="espacio" value={espacio} />
          <input type="hidden" name="vuelta" value={vuelta} />
          <button type="submit" className="rounded-lg bg-[#c27b3d] px-5 py-2 text-sm font-semibold text-white hover:bg-[#a9682f]">
            Autorizar
          </button>
        </form>
        <form action={cancelarFotofficeAction}>
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="vuelta" value={vuelta} />
          <button type="submit" className="rounded-lg border border-[#111827]/15 px-5 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f9fafb]">
            Cancelar
          </button>
        </form>
      </div>
    </Marco>
  );
}
