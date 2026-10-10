import Link from "next/link";
import { formatArDay } from "@repo/muestras";
import { listarConEstadisticas } from "@/lib/estadisticas/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estadísticas" };

const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default async function Estadisticas() {
  const usuario = await requireUsuario("/panel/estadisticas");
  const actividades = await listarConEstadisticas(usuario.id);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Estadísticas</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Cuánta gente mira tu muestra online, escanea los QR de la sala y deja su comentario.
        </p>
      </header>
      {actividades.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando tengas una muestra publicada, acá vas a ver sus visitas y escaneos.
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {actividades.map((a) => (
            <li key={a.id} className="space-y-1 border-b border-[var(--mf-line)] py-5">
              <h2 className="mf-titulo text-[1.6rem]">
                <Link href={`/panel/estadisticas/${a.id}`} className="underline-offset-[5px] hover:underline">{a.title}</Link>
              </h2>
              <p className="text-sm text-[var(--mf-muted)]">{formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}</p>
              <p className="text-[15px]">
                {cantidad(a.resumen.visitas, "visita", "visitas")}
                {a.type === "MUESTRA" ? (
                  <>
                    {" · "}{cantidad(a.resumen.escaneos, "escaneo", "escaneos")}
                    {" · "}{cantidad(a.resumen.comentarios, "comentario", "comentarios")}
                    {a.resumen.pendientes > 0 ? (
                      <>{" · "}<Link href={`/panel/estadisticas/${a.id}/libro`} className="underline underline-offset-[6px]">{a.resumen.pendientes} para revisar</Link></>
                    ) : null}
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-[var(--mf-muted)]">
        Contamos sin guardar datos de quien visita: ni IP, ni cookies, ni cuentas. No cuentan tus propias visitas ni las de robots. Los números son por día, en hora argentina.
      </p>
    </main>
  );
}
