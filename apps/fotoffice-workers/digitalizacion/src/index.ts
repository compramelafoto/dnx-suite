import { tomarSiguiente, recuperarTrabadas } from "./cola";
import { getConfig, loadEnvFiles } from "./config";
import { convertirGrabacion } from "./convertir";
import { disconnectPrisma, getPrisma } from "./prisma";
import { preflightBucket } from "./preflight";
import { crearR2 } from "./r2";
import { crearRepo } from "./repo";

async function main() {
  loadEnvFiles();
  const modo = process.argv[2] === "once" ? "once" : "drain";
  const config = getConfig();
  const db = getPrisma() as unknown as Parameters<typeof tomarSiguiente>[0];
  const r2 = crearR2(config);
  const deps = {
    repo: crearRepo(db),
    ...r2,
    preset: config.preset,
    registrar: (m: string) => console.log(`[digitalizacion] ${m}`),
  };

  if (!(await preflightBucket(r2, config.bucket, console.error))) {
    process.exitCode = 1;
    return;
  }

  const recuperadas = await recuperarTrabadas(db, new Date());
  if (recuperadas > 0) console.log(`[digitalizacion] recuperadas ${recuperadas} trabadas`);

  const limite = Date.now() + config.maxHoras * 3_600_000;
  let hechas = 0;
  while (Date.now() < limite) {
    const tomada = await tomarSiguiente(db, new Date());
    if (!tomada) break;
    const { id, lockAt } = tomada;
    console.log(`[digitalizacion] convirtiendo ${id}`);
    try {
      await convertirGrabacion(deps, id, lockAt);
    } catch (e) {
      console.error(`[digitalizacion] falló ${id}, sigo con la cola:`, e);
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
