import { createHash, randomBytes } from "node:crypto";

/**
 * Freno en memoria para lo que cualquier cuenta de Google puede disparar: buscar direcciones,
 * subir imágenes, crear borradores y enviarlos a revisión.
 *
 * Es el mismo limitador que usa CompraMeLaFoto en `lib/rate-limit.ts`. Que sea de memoria tiene
 * una consecuencia que conviene decir en voz alta: en Vercel cada instancia lleva su propio
 * conteo, así que el tope real es "N por instancia". No es un control de seguridad fuerte; es lo
 * que evita que una pestaña con un bucle —o alguien con una cuenta descartable— llene el bucket
 * de imágenes, la base de borradores o la bandeja de revisión, o nos haga bloquear en Nominatim.
 */

type Registro = { count: number; resetAt: number };

const memoria = new Map<string, Registro>();

/**
 * Limpieza perezosa: sólo cuando el mapa ya creció, y sólo lo vencido.
 *
 * Sin esto, una instancia de larga vida acumula una entrada por cada persona que pasó alguna vez.
 * Con esto, el costo se paga una vez cada tanto y no en cada pedido.
 */
function limpiar(ahora: number) {
  if (memoria.size < 500) return;
  for (const [clave, registro] of memoria.entries()) {
    if (registro.resetAt <= ahora) memoria.delete(clave);
  }
  // Tope duro: si aun así quedan demasiadas (muchas IPs en poco tiempo), se van las más viejas.
  // Un Map recorre en orden de alta, así que las primeras son las más antiguas.
  for (const clave of memoria.keys()) {
    if (memoria.size < MAX_ENTRADAS) break;
    memoria.delete(clave);
  }
}

/** Cuántas claves puede guardar el freno en una instancia. */
export const MAX_ENTRADAS = 10_000;

export type DecisionDeFreno = { allowed: boolean; remaining: number; resetAt: number };

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): DecisionDeFreno {
  const { key, limit, windowMs } = params;
  const ahora = Date.now();
  limpiar(ahora);

  const registro = memoria.get(key);
  if (!registro || registro.resetAt <= ahora) {
    const nuevo: Registro = { count: 1, resetAt: ahora + windowMs };
    // Se borra antes para que vuelva al final del orden de alta (el desalojo saca las primeras).
    memoria.delete(key);
    memoria.set(key, nuevo);
    return { allowed: true, remaining: limit - 1, resetAt: nuevo.resetAt };
  }

  if (registro.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: registro.resetAt };
  }

  registro.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - registro.count), resetAt: registro.resetAt };
}

/** Sólo para los tests: deja el conteo en cero entre casos. */
export function resetRateLimit() {
  memoria.clear();
}

/** Sólo para los tests: cuántas claves hay guardadas. */
export const tamanoDelFreno = () => memoria.size;


/** Los topes de cada cosa, todos por persona con sesión. */
export const LIMITES = {
  geocode: { limit: 60, windowMs: 60_000 },
  imagenes: { limit: 60, windowMs: 10 * 60_000 },
  crearBorrador: { limit: 20, windowMs: 60 * 60_000 },
  guardarPerfil: { limit: 30, windowMs: 60 * 60_000 },
  buscarPerfiles: { limit: 60, windowMs: 60_000 },
  // Una muestra grande llega al tope técnico de 300 obras (MAX_WORKS, etapa 6): bajar la ficha de
  // cada una más el PDF completo en dos tamaños entra. Contar sólo el PDF completo dejaría sin tope
  // las fichas sueltas, que también arman un PDF en el servidor.
  fichas: { limit: 400, windowMs: 10 * 60_000 },
  enviarARevision: { limit: 10, windowMs: 60 * 60_000 },
  // Etapa 3: convocatorias y curaduría.
  crearConvocatoria: { limit: 10, windowMs: 60 * 60_000 },
  // Cada guardado de un envío manda un correo de "recibimos tus obras".
  guardarEnvio: { limit: 20, windowMs: 60 * 60_000 },
  invitarCurador: { limit: 30, windowMs: 60 * 60_000 },
  aceptarInvitacion: { limit: 20, windowMs: 60 * 60_000 },
  // Un curador con 300 obras puntúa y corrige rápido con el teclado: tope holgado.
  puntuar: { limit: 1200, windowMs: 10 * 60_000 },
  decidir: { limit: 600, windowMs: 10 * 60_000 },
  // La imagen anónima pasa por nuestra función (no por el bucket): frena el raspado.
  imagenCuraduria: { limit: 1500, windowMs: 10 * 60_000 },
  // Etapa 4: la sala. Un PDF de muchas obras (tanda de marcos, catálogo, cartel, plano) tarda:
  // 60 cada 10 minutos. El marco de una sola obra es liviano y con 300 obras se pide uno por obra:
  // va aparte, con 400 (etapa 6).
  piezas: { limit: 60, windowMs: 10 * 60_000 },
  piezaObra: { limit: 400, windowMs: 10 * 60_000 },
  guardarMontaje: { limit: 120, windowMs: 60 * 60_000 },
  moderarLibro: { limit: 600, windowMs: 10 * 60_000 },
  cambiarModoLibro: { limit: 60, windowMs: 60 * 60_000 },
  // Etapa 5: equipo de la muestra.
  invitarEquipo: { limit: 30, windowMs: 60 * 60_000 },
  aceptarEquipo: { limit: 20, windowMs: 60 * 60_000 },
  guardarTextos: { limit: 120, windowMs: 60 * 60_000 },
  guardarInauguracion: { limit: 60, windowMs: 60 * 60_000 },
  gestionarAsistencias: { limit: 600, windowMs: 10 * 60_000 },
  exportarAsistencias: { limit: 30, windowMs: 60 * 60_000 },
  // Piezas para redes: cada vista previa arma una imagen en el servidor (≈ 0,5–1 s).
  redes: { limit: 120, windowMs: 10 * 60_000 },
  // Etapa 6: sorpresa de la muestra.
  guardarVisibilidad: { limit: 60, windowMs: 60 * 60_000 },
  // Portfolio del artista: subir, editar, borrar y ordenar (60 fotos a lo sumo).
  guardarPortfolio: { limit: 300, windowMs: 60 * 60_000 },
  // Enlace de expositores: generar, guardar topes, cerrar, abrir y renovar.
  enlaceExpositores: { limit: 30, windowMs: 60 * 60_000 },
  // Sumarse con el enlace (crea el perfil y la participación).
  sumarseExpositor: { limit: 20, windowMs: 60 * 60_000 },
  // "Donde expongo": guardar, borrar y retirar obras (con 300 obras de tope técnico), y enviarlas.
  guardarObraExpositor: { limit: 300, windowMs: 60 * 60_000 },
  enviarObraExpositor: { limit: 60, windowMs: 60 * 60_000 },
  // Quien organiza revisa con muchas obras: aprobar, pedir cambios, corregir y sacar.
  revisarExpositores: { limit: 600, windowMs: 10 * 60_000 },
} as const;

/**
 * Los topes de lo que se puede hacer sin sesión, contados por IP (por su huella, nunca la IP en
 * claro). "Buscá muestras cerca tuyo" de la portada: cada búsqueda es un pedido a Nominatim con
 * nuestro nombre, y su política pide no pasar de uno por segundo. 10 por minuto alcanza para
 * buscar, corregir y volver a buscar; un bucle se frena enseguida.
 */
export const LIMITES_PUBLICOS = {
  buscarCerca: { limit: 10, windowMs: 60_000 },
  // Etapa 4. Pasarse sólo deja de contar: la página y la redirección andan igual.
  visitas: { limit: 300, windowMs: 10 * 60_000 },
  escaneos: { limit: 120, windowMs: 10 * 60_000 },
  // Además del tope general, por IP y por obra (o muestra): recargar una misma página no la infla.
  visitasPorPagina: { limit: 30, windowMs: 10 * 60_000 },
  escaneosPorPagina: { limit: 30, windowMs: 10 * 60_000 },
  // Antes de mirar la base en /q: holgado (un grupo escolar en la red del lugar comparte IP), pero
  // un bucle no consulta la base en cada vuelta.
  qr: { limit: 1000, windowMs: 10 * 60_000 },
  // Por IP y por muestra: un grupo escolar en la red del lugar comparte IP.
  libro: { limit: 10, windowMs: 10 * 60_000 },
  // Antes de buscar la muestra del libro: holgado, sólo para que un bucle no consulte la base.
  libroConsultas: { limit: 120, windowMs: 10 * 60_000 },
  // Etapa 5: confirmación de asistencia. Por IP y por muestra (un grupo en la misma red puede anotarse).
  asistencia: { limit: 10, windowMs: 10 * 60_000 },
  // Antes de buscar la muestra: holgado, sólo para que un bucle no consulte la base.
  asistenciaConsultas: { limit: 120, windowMs: 10 * 60_000 },
  // Ver o cancelar con el enlace personal.
  miAsistencia: { limit: 30, windowMs: 10 * 60_000 },
  // Etapa 6: "cambian para cada visitante". Cada pedido sortea otras obras: el tope frena a quien
  // recarga en bucle para verlas todas (pasado el tope, recibe las mismas que la última vez).
  anticipo: { limit: 60, windowMs: 10 * 60_000 },
  // Y por IP y por muestra (el slug como ámbito): en una sola muestra se ven menos sorteos seguidos.
  anticipoPorMuestra: { limit: 20, windowMs: 10 * 60_000 },
  // La página del enlace de expositores: frena a quien prueba tokens (pasado el tope, el mismo 404).
  paginaExpositores: { limit: 60, windowMs: 10 * 60_000 },
  // Vista de sala (con pase) y sus imágenes por proxy: holgado para quien recorre la sala, pero un
  // bucle no lee el bucket sin fin.
  vistaSala: { limit: 300, windowMs: 10 * 60_000 },
  imagenSala: { limit: 600, windowMs: 10 * 60_000 },
} as const;

export type QueSeLimitaSinSesion = keyof typeof LIMITES_PUBLICOS;

/**
 * La IP de quien pide, según los encabezados del proxy (en Vercel, `x-forwarded-for` lo pone la
 * plataforma y el primer valor es el cliente). Sin encabezados, todos comparten un mismo balde:
 * peor para ellos, nunca un pase libre.
 */
export function ipDeLaPeticion(h: { get(nombre: string): string | null }): string {
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = reenviada || h.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "sin-ip";
}

/** Topes por muestra, sumando a todas las personas: frena una inundación repartida en muchas IPs. */
export const LIMITES_POR_MUESTRA = {
  libro: { limit: 200, windowMs: 60 * 60_000 },
  asistencia: { limit: 300, windowMs: 60 * 60_000 },
} as const;

// Sal al azar por instancia: la huella no se puede revertir ni cruzar entre instancias, y nunca se
// guarda en la base. La IP en claro no queda ni en memoria.
const SAL = randomBytes(16).toString("hex");

/**
 * Lo que se cuenta de una IP. Una IPv4 tal cual. Una IPv6, sólo su prefijo /64: a una conexión
 * hogareña o móvil le dan un /64 entero, y contar por dirección dejaría a cualquiera cambiar de IP en
 * cada pedido. Una IPv4 escrita como IPv6 (`::ffff:1.2.3.4`) cuenta como la IPv4. Lo que no se
 * entiende como IPv6 vuelve igual (cae en su propio balde).
 */
export function prefijoDeIp(ip: string): string {
  if (!ip.includes(":")) return ip;
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapeada) return mapeada[1]!;
  const partes = ip.split("::");
  if (partes.length > 2) return ip;
  const grupos = (s: string | undefined) => (s ? s.split(":") : []);
  const izquierda = grupos(partes[0]);
  const derecha = grupos(partes[1]);
  const faltan = partes.length === 2 ? 8 - izquierda.length - derecha.length : 0;
  if (faltan < 0) return ip;
  const todos = [...izquierda, ...Array<string>(faltan).fill("0"), ...derecha];
  const primeros = todos.slice(0, 4);
  if (primeros.length < 4 || !primeros.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return ip;
  return `${primeros.map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}

/** Huella de una IP (de su /64, si es IPv6) para usar como clave del freno (decisión D15 de la etapa 4). */
export function huellaDeIp(ip: string, sal: string = SAL): string {
  return createHash("sha256").update(sal).update(prefijoDeIp(ip)).digest("base64url").slice(0, 22);
}

/**
 * Cuenta un uso de `que` para esa IP (opcionalmente dentro de un `ambito`, p. ej. una muestra).
 * Frenar después de validar el `activityId` (o lo que vaya en `ambito`): con valores inventados,
 * cada pedido sumaría una clave nueva al mapa.
 */
export function frenarPorIp(que: QueSeLimitaSinSesion, ip: string, ambito?: string): DecisionDeFreno {
  return checkRateLimit({ key: `ip:${que}:${ambito ?? "-"}:${huellaDeIp(ip)}`, ...LIMITES_PUBLICOS[que] });
}

export type QueSeLimitaPorMuestra = keyof typeof LIMITES_POR_MUESTRA;

/** Igual que `frenarPorIp`: llamar con un `activityId` ya validado. */
export function frenarPorMuestra(que: QueSeLimitaPorMuestra, activityId: string): DecisionDeFreno {
  return checkRateLimit({ key: `muestra:${que}:${activityId}`, ...LIMITES_POR_MUESTRA[que] });
}

export type QueSeLimita = keyof typeof LIMITES;

/** Cuenta un uso de `que` para la persona y dice si todavía está dentro del tope. */
export function frenarPorUsuario(que: QueSeLimita, userId: number): DecisionDeFreno {
  return checkRateLimit({ key: `${que}:${userId}`, ...LIMITES[que] });
}
