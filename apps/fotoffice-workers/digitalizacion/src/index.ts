import { tomarRelleno, tomarSiguiente, recuperarTrabadas, type PrismaRelleno, type Tomada } from "./cola";
import { getConfig, loadEnvFiles } from "./config";
import { detectarAudio, sondearConFfprobe } from "./audio";
import { convertirGrabacion } from "./convertir";
import { disconnectPrisma, getPrisma } from "./prisma";
import { preflightBucket } from "./preflight";
import { rellenarHls } from "./rellenar";
import { crearR2 } from "./r2";
import { crearRepo } from "./repo";

async function main() {
  loadEnvFiles();
  const modo = process.argv[2] === "once" ? "once" : "drain";
  const config = getConfig();
  const db = getPrisma() as unknown as PrismaRelleno;
  const r2 = crearR2(config);
  const registrar = (m: string) => console.log(`[digitalizacion] ${m}`);
  const sondear = sondearConFfprobe();
  const deps = {
    repo: crearRepo(db),
    ...r2,
    preset: config.preset,
    registrar,
    detectarAudio: (clave: string) => detectarAudio(clave, { leerInicio: r2.leerInicio, sondear, registrar }),
  };

  if (!(await preflightBucket(r2, config.bucket, console.error))) {
    process.exitCode = 1;
    return;
  }

  const recuperadas = await recuperarTrabadas(db, new Date());
  if (recuperadas > 0) console.log(`[digitalizacion] recuperadas ${recuperadas} trabadas`);

  // Versión para mirar (E10): SIEMPRE aparte de la conversión, desde el final.mp4 ya subido. Un
  // fallo acá nunca toca el MP4.
  const rellenar = async (r: Tomada) => {
    console.log(`[digitalizacion] versión para mirar de ${r.id}`);
    try {
      await rellenarHls(deps, r.id, r.lockAt);
    } catch (e) {
      console.error(`[digitalizacion] falló el relleno de ${r.id}, sigo con la cola:`, e);
    }
  };

  const limite = Date.now() + config.maxHoras * 3_600_000;
  let hechas = 0;
  while (Date.now() < limite) {
    const tomada = await tomarSiguiente(db, new Date());
    if (tomada) {
      const { id, lockAt } = tomada;
      console.log(`[digitalizacion] convirtiendo ${id}`);
      try {
        await convertirGrabacion(deps, id, lockAt);
      } catch (e) {
        console.error(`[digitalizacion] falló ${id}, sigo con la cola:`, e);
      }
      // Recién convertida: su versión para mirar va ya (sólo si quedó LISTA y nadie más rellena).
      try {
        const encadenada = await tomarRelleno(db, new Date(), id);
        if (encadenada) await rellenar(encadenada);
      } catch (e) {
        console.error(`[digitalizacion] no se pudo encadenar el relleno de ${id}:`, e);
      }
    } else {
      // Sin conversiones pendientes: versión para mirar de lo ya convertido (E10). Después de cada
      // relleno se vuelve a mirar la cola de conversión, que tiene prioridad.
      const relleno = await tomarRelleno(db, new Date());
      if (!relleno) break;
      await rellenar(relleno);
    }
    hechas++;
    if (modo === "once") break;
  }
  console.log(`[digitalizacion] terminado: ${hechas} grabaciones`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
