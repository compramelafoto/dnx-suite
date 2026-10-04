import "server-only";
import { MemberConcurrencyError } from "@repo/db/fotoffice-members";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CONTACTS_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { readSyncCursor, writeSyncCursor } from "@/lib/integrations/store";
import { sanitizeError } from "@/lib/payments/connect/log";
import {
  createContactsClient,
  groupLabelFor,
  isExpiredSyncToken,
  type ContactsClient,
} from "./client";
import { MAX_WRITES_PER_RUN } from "./constants";
import { fieldFingerprintsOf } from "./fingerprint";
import { createLink, listLinks, markRemoteDeleted, updateLink, type ContactLink } from "./links";
import { decideForPerson } from "./merge";
import {
  readFieldValues,
  readRemoteUpdatedAt,
  readSourceMarker,
  toGooglePersonBody,
  type FieldValues,
  type GooglePerson,
  type SyncableField,
  type SyncablePerson,
} from "./person";
import {
  getContactSyncSetting,
  listContactSyncSettings,
  recordSyncResult,
  saveGroupResourceName,
} from "./settings";
import { getContactSource, type ContactSource } from "./sources";

/**
 * El espejo con Google Contacts, en las dos direcciones.
 *
 * ── Google es un reflejo, no el registro ──
 *
 * Ninguna función de acá puede romper el padrón. Si Google está caído, desconectado o el
 * permiso fue revocado, todo devuelve un resultado con su motivo y el padrón sigue su vida.
 * Lo que queda pendiente lo recupera la corrida siguiente, sin ninguna tabla de pendientes:
 * **una persona sin vínculo es una creación pendiente, y una cuya huella dejó de coincidir
 * es una actualización pendiente**.
 *
 * ── Nada se borra ──
 *
 * Ni contactos, ni grupos. Lo más destructivo que hace esto es sacar a alguien de un grupo.
 *
 * ── Qué significa que un contacto NO venga en la lectura ──
 *
 * Con `syncToken`, Google manda solamente lo que cambió. Que un contacto no aparezca NO es
 * que lo borraron —una baja viene marcada, con `metadata.deleted`— sino que Google no lo tocó
 * desde la corrida anterior. Confundir las dos cosas deja al padrón sin poder empujar nada
 * después de la primera corrida: es la diferencia entre "no hay novedades" y "no está".
 *
 * ── Y qué significa que la corrida no haya podido con todo ──
 *
 * Guardar el `syncToken` nuevo es decirle a Google "ya tengo todo lo que me mandaste". Si algo
 * quedó sin aplicar —una persona que se salteó, el tope de escrituras, un módulo que falló—,
 * ese cambio NO vuelve a venir nunca más. Por eso la marca se guarda recién al final y sólo
 * cuando no quedó nada pendiente (ver `quedaronCambiosSinAplicar`): repetir un cambio ya
 * aplicado no cuesta nada —la corrida es idempotente por las huellas— y perderlo, sí.
 */

export type ContactsSyncReport = {
  contactosCreados: number;
  contactosActualizados: number;
  sociosCorregidos: number;
  sacadosDelGrupo: number;
  /**
   * Quedó algo que Google trajo y que esta corrida no pudo aplicar. Mientras sea `true` no se
   * avanza la marca de "dame solo lo que cambió": avanzarla descartaría ese cambio para
   * siempre. No es un error para mostrarle a nadie; es una instrucción para la corrida.
   */
  quedaronCambiosSinAplicar: boolean;
  motivo?: string;
};

const VACIO: ContactsSyncReport = {
  contactosCreados: 0,
  contactosActualizados: 0,
  sociosCorregidos: 0,
  sacadosDelGrupo: 0,
  quedaronCambiosSinAplicar: false,
};

function loguear(mensaje: string, datos: Record<string, unknown>): void {
  // Nunca entra acá un token ni el cuerpo de una respuesta de Google: el detalle pasa siempre
  // por `sanitizeError`, que recorta y enmascara lo que parezca un secreto.
  console.error(`[fotoffice][contactos] ${mensaje}`, datos);
}

/**
 * Última barrera antes de escribir en el padrón.
 *
 * `decideForPerson` ya respeta `pullableFields`, pero estos valores vienen de Google y el
 * tipo sólo alcanza mientras todo esté tipado. Filtrar de nuevo es gratis y es lo que
 * garantiza que una agenda no pueda cambiarle a un socio un campo que el módulo no cede.
 */
function soloPullables(
  changes: Partial<FieldValues>,
  pullables: readonly SyncableField[],
): Partial<FieldValues> {
  const permitidos = new Set<string>(pullables);
  const filtrados: Partial<FieldValues> = {};
  for (const [campo, valor] of Object.entries(changes)) {
    if (permitidos.has(campo)) filtrados[campo as SyncableField] = valor;
  }
  return filtrados;
}

/**
 * La huella remota que corresponde guardar DESPUÉS de escribir un contacto en Google.
 *
 * Tiene que calcularse sobre la persona que la respuesta de Google efectivamente trae —no
 * sobre lo que se le mandó—. Si Google normaliza o reformatea algo (un teléfono, un espacio
 * de más), las dos huellas quedan distintas, y la corrida siguiente lee esa diferencia como
 * "lo tocó Google": vuelve a empujar a esa persona. Para siempre, cada quince minutos, porque
 * lo que Google devuelve nunca va a coincidir con "lo enviado" — el socio queda trabado.
 *
 * Si por lo que sea la respuesta no trajera la persona, se degrada a la huella de lo enviado:
 * vuelve al riesgo de arriba en el caso raro en que Google reformatee algo, pero nunca rompe
 * la corrida por eso.
 */
function huellaRemotaTrasEscribir(person: GooglePerson | null, huellaEnviada: string): string {
  return person ? fieldFingerprintsOf(readFieldValues(person)) : huellaEnviada;
}

/**
 * Los contactos de este módulo que tienen nuestra marca y todavía no tienen vínculo.
 *
 * Existen por un camino concreto: Google aceptó la creación y la respuesta no llegó —el
 * contacto quedó hecho y el vínculo no—. Sin esto, cada corrida crearía otro contacto para el
 * mismo socio, y como acá nada se borra, los duplicados se acumularían para siempre.
 *
 * Si el mismo socio aparece en más de un contacto, se elige SIEMPRE el mismo (el primero por
 * `resourceName`): una elección que cambia de corrida en corrida haría saltar al socio de un
 * contacto al otro. El duplicado queda donde está; borrarlo no es una opción.
 */
function indexarHuerfanos(
  remotos: Map<string, GooglePerson>,
  moduleKey: string,
  yaVinculados: Set<string>,
): Map<string, GooglePerson> {
  const porSourceId = new Map<string, GooglePerson>();
  const ordenados = [...remotos.values()].sort((a, b) =>
    (a.resourceName ?? "").localeCompare(b.resourceName ?? ""),
  );
  for (const person of ordenados) {
    if (!person.resourceName || yaVinculados.has(person.resourceName)) continue;
    const marca = readSourceMarker(person);
    if (!marca || marca.moduleKey !== moduleKey) continue;
    if (!porSourceId.has(marca.sourceId)) porSourceId.set(marca.sourceId, person);
  }
  return porSourceId;
}

/**
 * Lee de Google lo que cambió y arma el índice de contactos propios, por `resourceName`.
 *
 * Los contactos que la institución ya tenía pasan por acá y se descartan: no tienen la
 * marca. La primera lectura de una agenda grande trae todo, y está bien — es solo lectura.
 *
 * Devuelve el `syncToken` nuevo en vez de guardarlo: quien decide si se puede guardar es la
 * corrida completa, una vez que sabe si pudo aplicar todo (ver el encabezado del archivo).
 */
async function leerRemotos(
  workspaceId: string,
  client: ContactsClient,
): Promise<{
  porResourceName: Map<string, GooglePerson>;
  borrados: string[];
  nuevoSyncToken: string | null;
}> {
  const porResourceName = new Map<string, GooglePerson>();
  const borrados: string[] = [];

  let syncToken = await readSyncCursor(workspaceId, GOOGLE_CONTACTS_INTEGRATION_KEY);
  let pageToken: string | null = null;
  let nuevoSyncToken: string | null = null;

  for (let pagina = 0; pagina < 50; pagina++) {
    let page;
    try {
      page = await client.listChanges({ syncToken, pageToken });
    } catch (error) {
      // Vencido a los 7 días: se borra el token y se recarga todo. Es normal, no es falla.
      // Se borra ANTES de reintentar: si la corrida se cae en el medio, lo que queda guardado
      // es "no tengo marca" —una lectura completa de más— y no una marca que ya no sirve.
      if (isExpiredSyncToken(error) && syncToken) {
        await writeSyncCursor(workspaceId, GOOGLE_CONTACTS_INTEGRATION_KEY, null);
        syncToken = null;
        pageToken = null;
        porResourceName.clear();
        borrados.length = 0;
        continue;
      }
      throw error;
    }

    for (const person of page.people) {
      if (!person.resourceName) continue;
      if (!readSourceMarker(person)) continue; // Ajeno: invisible para la sincronización.
      if (person.metadata?.deleted) {
        borrados.push(person.resourceName);
        continue;
      }
      porResourceName.set(person.resourceName, person);
    }

    if (page.nextSyncToken) nuevoSyncToken = page.nextSyncToken;
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  return { porResourceName, borrados, nuevoSyncToken };
}

/**
 * La corrida de UN módulo. Exportada para poder probarla con un doble.
 *
 * Orden: primero se trae, después se empuja. Al revés, una corrección hecha en el celular
 * se pisaría con el dato viejo antes de llegar al padrón.
 */
export async function syncModuleContacts(input: {
  workspaceId: string;
  source: ContactSource;
  client: ContactsClient;
  groupResourceName: string;
  remotos: Map<string, GooglePerson>;
}): Promise<ContactsSyncReport> {
  const { workspaceId, source, client, groupResourceName, remotos } = input;
  const reporte: ContactsSyncReport = { ...VACIO };

  const personas = await source.list(workspaceId);
  const vinculos = await listLinks(workspaceId, source.moduleKey);
  const porSourceId = new Map(vinculos.map((v) => [v.sourceId, v]));
  const vigentes = new Set(personas.map((p) => p.sourceId));
  const huerfanos = indexarHuerfanos(
    remotos,
    source.moduleKey,
    new Set(vinculos.map((v) => v.resourceName)),
  );

  let escrituras = 0;

  /** El cuerpo que se le manda a Google por una persona. */
  const cuerpoDe = (persona: SyncablePerson, values: FieldValues, conGrupo: boolean) =>
    toGooglePersonBody(
      { ...persona, values },
      {
        moduleKey: source.moduleKey,
        // Al ACTUALIZAR no se manda la pertenencia al grupo: `UPDATE_PERSON_FIELDS` no la
        // incluye —a propósito, para no tocar los grupos de nadie— así que mandarla sería,
        // en el mejor de los casos, ruido.
        groupResourceName: conGrupo ? groupResourceName : null,
      },
    );

  for (const persona of personas) {
    if (escrituras >= MAX_WRITES_PER_RUN) {
      // Se corta acá y sigue la corrida siguiente. Entre los que quedaron sin mirar puede
      // haber una corrección hecha en el celular, así que la marca no se puede avanzar.
      reporte.quedaronCambiosSinAplicar = true;
      break;
    }

    const vinculo = porSourceId.get(persona.sourceId) ?? null;
    // Un contacto borrado en Google no se recrea: se anotó y ahí queda.
    if (vinculo?.status === "REMOTE_DELETED") continue;

    // Volvió a estar vigente después de una baja: vuelve al grupo, sin crear nada. Va en su
    // propio try para que una falla acá no deje a la persona sin sincronizar los datos.
    if (vinculo && vinculo.status !== "LINKED") {
      try {
        await client.setGroupMembership({
          groupResourceName,
          resourceName: vinculo.resourceName,
          member: true,
        });
        await updateLink(workspaceId, vinculo.id, { status: "LINKED" });
        escrituras += 1;
      } catch (error) {
        loguear("no se pudo devolver a alguien a su grupo", {
          workspaceId,
          moduleKey: source.moduleKey,
          sourceId: persona.sourceId,
          detalle: sanitizeError(error),
        });
      }
    }

    // Se prende justo antes de escribir en el padrón y se apaga apenas la escritura salió
    // bien: si la corrida se cae con esto prendido, lo que Google trajo NO se aplicó.
    let traiaCambiosDeGoogle = false;
    // Declarado ACÁ AFUERA, no adentro del `try`, para que el `catch` de más abajo lo pueda
    // leer: si el contacto vino en el delta y algo falla después, hace falta saber que había
    // un etag fresco de por medio (ver el comentario del `catch`).
    let remoto: GooglePerson | null = null;

    try {
      remoto = vinculo ? (remotos.get(vinculo.resourceName) ?? null) : null;

      // ── El contacto tiene vínculo pero no vino en la lectura ──
      // Google no lo tocó. No hay nada que traer, y `merge.ts` no sirve acá: sin los valores
      // remotos daría `NOTHING` —su `remote: null` significa "lo borraron"— y el padrón se
      // quedaría sin poder empujar nunca más. La huella remota guardada describe el estado
      // actual de Google, así que alcanza con compararla contra el padrón de ahora.
      if (vinculo && !remoto) {
        const huellaLocal = fieldFingerprintsOf(persona.values);
        if (huellaLocal === vinculo.remoteFingerprint) continue;

        const actualizado = await client.updateContact({
          resourceName: vinculo.resourceName,
          etag: vinculo.etag,
          body: cuerpoDe(persona, persona.values, false),
        });
        await updateLink(workspaceId, vinculo.id, {
          etag: actualizado.etag,
          localFingerprint: huellaLocal,
          remoteFingerprint: huellaRemotaTrasEscribir(actualizado.person, huellaLocal),
          lastPushedAt: new Date(),
        });
        reporte.contactosActualizados += 1;
        escrituras += 1;
        continue;
      }

      // ── Sin vínculo, pero el contacto ya existe con nuestra marca ──
      // Se adopta en vez de crear un duplicado. No se escribe nada en Google: el vínculo queda
      // con el estado REAL de los dos lados, tal cual están ahora mismo. La corrida siguiente
      // NO pasa por `decideForPerson` para resolver una diferencia con atribución campo por
      // campo: como acá no se tocó Google, este contacto no vuelve a aparecer en el delta, y
      // se entra por la rama `vinculo && !remoto` de más arriba. Ahí, si el padrón difiere de
      // la huella remota que se acaba de guardar, se empuja ENTERO —sin comparar campo por
      // campo—, así que gana el padrón directamente. Es el resultado correcto (el padrón es el
      // registro), pero sin la atribución fina que sí tiene `decideForPerson`.
      if (!vinculo) {
        const huerfano = huerfanos.get(persona.sourceId);
        if (huerfano?.resourceName) {
          await createLink({
            workspaceId,
            moduleKey: source.moduleKey,
            sourceType: source.sourceType,
            sourceId: persona.sourceId,
            resourceName: huerfano.resourceName,
            etag: huerfano.etag ?? null,
            localFingerprint: fieldFingerprintsOf(persona.values),
            remoteFingerprint: fieldFingerprintsOf(readFieldValues(huerfano)),
          });
          continue;
        }
      }

      const decision = decideForPerson({
        local: persona.values,
        // `decideForPerson` ignora estas dos huellas y las recalcula de los valores que tiene
        // delante. Van igual porque el tipo las pide, y van honestas por las dudas.
        localFingerprint: fieldFingerprintsOf(persona.values),
        localUpdatedAt: persona.updatedAt,
        remote: remoto ? readFieldValues(remoto) : null,
        remoteFingerprint: remoto ? fieldFingerprintsOf(readFieldValues(remoto)) : null,
        remoteUpdatedAt: remoto ? readRemoteUpdatedAt(remoto) : null,
        link: vinculo
          ? {
              localFingerprint: vinculo.localFingerprint,
              remoteFingerprint: vinculo.remoteFingerprint,
            }
          : null,
        pullableFields: source.pullableFields,
      });
      const huellas = decision.fingerprints;

      // El etag es el testigo de concurrencia de Google y se mueve con CADA edición, incluida
      // una que no cambie nada nuestro. Si no se guardara el de la lectura, el vínculo
      // quedaría con uno viejo y la próxima actualización de esa persona sería rechazada —y
      // como sin cambios en Google el contacto ya no vuelve a venir, quedaría rechazada para
      // siempre.
      const etagFresco = remoto?.etag ?? vinculo?.etag ?? null;

      if (decision.kind === "NOTHING") {
        // No hay nada que escribir en ningún lado, pero las huellas guardadas pueden haber
        // quedado viejas —de la versión que guardaba una huella del conjunto entero—. Se
        // ponen al día sólo si cambiaron: escribir por escribir, cada quince minutos y por
        // cada socio, es el costo que este `if` evita.
        if (
          vinculo &&
          huellas.remote !== null &&
          (vinculo.localFingerprint !== huellas.localAfterChanges ||
            vinculo.remoteFingerprint !== huellas.remote ||
            vinculo.etag !== etagFresco)
        ) {
          await updateLink(workspaceId, vinculo.id, {
            etag: etagFresco,
            localFingerprint: huellas.localAfterChanges,
            remoteFingerprint: huellas.remote,
          });
        }
        continue;
      }

      if (decision.kind === "CREATE") {
        const creado = await client.createContact(cuerpoDe(persona, persona.values, true));
        await createLink({
          workspaceId,
          moduleKey: source.moduleKey,
          sourceType: source.sourceType,
          sourceId: persona.sourceId,
          resourceName: creado.resourceName,
          etag: creado.etag,
          localFingerprint: huellas.localAfterChanges,
          remoteFingerprint: huellaRemotaTrasEscribir(creado.person, huellas.localAfterChanges),
        });
        reporte.contactosCreados += 1;
        escrituras += 1;
        continue;
      }

      // Traer primero, siempre.
      if (decision.kind === "PULL" || decision.kind === "BOTH") {
        const changes = soloPullables(decision.changes, source.pullableFields);
        if (Object.keys(changes).length !== Object.keys(decision.changes).length) {
          // No debería pasar —`decideForPerson` ya filtra—, así que si pasa hay un bug y lo
          // único seguro es no escribir NADA de esta persona: ni el padrón, ni Google, ni el
          // vínculo. Queda a la vista en el log y se repite en cada corrida hasta que se mire.
          loguear("una corrección de Google tocaba un campo que el módulo no cede", {
            workspaceId,
            moduleKey: source.moduleKey,
            sourceId: persona.sourceId,
            campos: Object.keys(decision.changes),
          });
          continue;
        }
        traiaCambiosDeGoogle = true;
        await source.applyPull(workspaceId, persona.sourceId, changes);
        traiaCambiosDeGoogle = false;
        reporte.sociosCorregidos += 1;
      }

      if (decision.kind === "PULL") {
        // No se escribió en Google, así que la huella remota es la que el módulo leyó.
        if (vinculo && huellas.remote !== null) {
          await updateLink(workspaceId, vinculo.id, {
            etag: etagFresco,
            localFingerprint: huellas.localAfterChanges,
            remoteFingerprint: huellas.remote,
            lastPulledAt: new Date(),
          });
        }
        continue;
      }

      if (vinculo) {
        const actualizado = await client.updateContact({
          resourceName: vinculo.resourceName,
          // El etag de la lectura antes que el guardado: es el fresco. Si una corrida escribió
          // bien y no llegó a guardar el vínculo, el etag guardado quedó viejo y Google
          // rechazaría TODAS las actualizaciones siguientes de esa persona, para siempre.
          etag: remoto?.etag ?? vinculo.etag,
          body: cuerpoDe(persona, decision.values, false),
        });
        await updateLink(workspaceId, vinculo.id, {
          etag: actualizado.etag,
          localFingerprint: huellas.localAfterChanges,
          remoteFingerprint: huellaRemotaTrasEscribir(
            actualizado.person,
            fieldFingerprintsOf(decision.values),
          ),
          ...(decision.kind === "BOTH" ? { lastPulledAt: new Date() } : {}),
          lastPushedAt: new Date(),
        });
        reporte.contactosActualizados += 1;
        escrituras += 1;
      }
    } catch (error) {
      if (traiaCambiosDeGoogle || remoto) {
        // Dos motivos para lo mismo, y los dos bloquean la marca por igual:
        // - `traiaCambiosDeGoogle`: lo que Google trajo no llegó al padrón.
        // - `remoto`: el contacto SÍ vino en este delta —trajera o no una corrección para
        //   traer— y algo falló después (un `updateContact` transitorio, un `updateLink` que
        //   sólo guardaba el etag fresco de la rama `NOTHING`). Si se avanzara la marca igual,
        //   la corrida siguiente ya no va a tener a este contacto en el delta: entra por la
        //   rama `vinculo && !remoto` de más arriba con el etag GUARDADO, que quedó viejo, y
        //   Google rechaza esa escritura —y la va a rechazar en cada corrida siguiente, porque
        //   sin una edición nueva del lado de Google el contacto no vuelve a aparecer con un
        //   etag fresco. No avanzar la marca cuesta releer la misma ventana mientras esta
        //   persona siga fallando; perder el etag fresco para siempre no tiene vuelta atrás.
        reporte.quedaronCambiosSinAplicar = true;
      }
      if (error instanceof MemberConcurrencyError) {
        // No es una falla: es la corrida perdiendo una carrera contra alguien que guardó al
        // socio primero. No se pisa su cambio; esta persona la agarra la corrida siguiente.
        continue;
      }
      // Que falle una persona no puede dejar sin sincronizar a las demás.
      loguear("no se pudo sincronizar a una persona", {
        workspaceId,
        moduleKey: source.moduleKey,
        sourceId: persona.sourceId,
        detalle: sanitizeError(error),
      });
    }
  }

  // Quien dejó de estar vigente sale del grupo. El contacto NO se borra: sigue en la agenda
  // general de la institución, que es donde alguien puede necesitarlo igual.
  for (const vinculo of vinculos) {
    if (escrituras >= MAX_WRITES_PER_RUN) break;
    if (vigentes.has(vinculo.sourceId) || vinculo.status !== "LINKED") continue;
    try {
      await client.setGroupMembership({
        groupResourceName,
        resourceName: vinculo.resourceName,
        member: false,
      });
      await updateLink(workspaceId, vinculo.id, { status: "UNGROUPED" });
      reporte.sacadosDelGrupo += 1;
      escrituras += 1;
    } catch (error) {
      loguear("no se pudo sacar del grupo", {
        workspaceId,
        resourceName: vinculo.resourceName,
        detalle: sanitizeError(error),
      });
    }
  }

  return reporte;
}

const MOTIVOS_DE_PERMISO: Record<string, string> = {
  NOT_CONNECTED: "la institución no conectó su cuenta de Google",
  NEEDS_RECONSENT: "el permiso de Google fue revocado y hay que volver a conectar",
  CONFIG: "falta configurar las credenciales de Google en la plataforma",
  UNAVAILABLE: "Google no está respondiendo",
};

/** La corrida completa de una institución: todos sus módulos encendidos. Nunca lanza. */
export async function syncWorkspaceContacts(workspaceId: string): Promise<ContactsSyncReport> {
  try {
    return await correrInstitucion(workspaceId);
  } catch (error) {
    // Ni siquiera una base caída puede hacer que esto lance: quien llama es un cron que
    // recorre instituciones, y una que falle no puede dejar sin sincronizar a las demás.
    loguear("la corrida de una institución se cortó", {
      workspaceId,
      detalle: sanitizeError(error),
    });
    return { ...VACIO, motivo: "no se pudo completar la corrida" };
  }
}

async function correrInstitucion(workspaceId: string): Promise<ContactsSyncReport> {
  const token = await getGoogleAccessToken(workspaceId, GOOGLE_CONTACTS_INTEGRATION_KEY);
  if (!token.ok) {
    return { ...VACIO, motivo: MOTIVOS_DE_PERMISO[token.reason] ?? "no se pudo obtener el permiso" };
  }

  const client = createContactsClient(token.accessToken);
  const encendidos = (await listContactSyncSettings(workspaceId)).filter((s) => s.enabled);
  if (encendidos.length === 0) {
    return { ...VACIO, motivo: "ningún módulo tiene el interruptor encendido" };
  }

  let remotos: Map<string, GooglePerson>;
  let borrados: string[];
  let nuevoSyncToken: string | null;
  try {
    const leidos = await leerRemotos(workspaceId, client);
    remotos = leidos.porResourceName;
    borrados = leidos.borrados;
    nuevoSyncToken = leidos.nuevoSyncToken;
  } catch (error) {
    loguear("no se pudo leer la agenda", { workspaceId, detalle: sanitizeError(error) });
    return { ...VACIO, motivo: "no se pudo leer la agenda de Google" };
  }

  const total: ContactsSyncReport = { ...VACIO };

  for (const resourceName of borrados) {
    try {
      await markRemoteDeleted(workspaceId, resourceName);
    } catch (error) {
      // La baja no quedó anotada: si se avanzara la marca, esa baja no vuelve a venir.
      total.quedaronCambiosSinAplicar = true;
      loguear("no se pudo anotar un contacto borrado en Google", {
        workspaceId,
        resourceName,
        detalle: sanitizeError(error),
      });
    }
  }

  for (const setting of encendidos) {
    const source = getContactSource(setting.moduleKey);
    if (!source) {
      // Un interruptor encendido de un módulo que ya no está registrado. No hay nada que
      // sincronizar y tampoco nada que esperar: no frena la marca.
      loguear("un interruptor apunta a un módulo que no existe", {
        workspaceId,
        moduleKey: setting.moduleKey,
      });
      continue;
    }

    try {
      // El grupo se crea la primera vez y se reusa siempre. Nunca se borra.
      let groupResourceName = setting.googleGroupResourceName;
      if (!groupResourceName) {
        groupResourceName = await client.ensureGroup(groupLabelFor(source.moduleLabel));
        await saveGroupResourceName(workspaceId, setting.moduleKey, groupResourceName);
      }

      const r = await syncModuleContacts({
        workspaceId,
        source,
        client,
        groupResourceName,
        remotos,
      });

      total.contactosCreados += r.contactosCreados;
      total.contactosActualizados += r.contactosActualizados;
      total.sociosCorregidos += r.sociosCorregidos;
      total.sacadosDelGrupo += r.sacadosDelGrupo;
      total.quedaronCambiosSinAplicar ||= r.quedaronCambiosSinAplicar;

      const actuales: ContactLink[] = await listLinks(workspaceId, setting.moduleKey);
      await recordSyncResult({
        workspaceId,
        moduleKey: setting.moduleKey,
        ok: true,
        message: null,
        syncedContacts: actuales.filter((v) => v.status === "LINKED").length,
      });
    } catch (error) {
      // El módulo entero quedó a medias: puede haber gente cuyo cambio de Google no se miró.
      total.quedaronCambiosSinAplicar = true;
      loguear("falló la corrida de un módulo", {
        workspaceId,
        moduleKey: setting.moduleKey,
        detalle: sanitizeError(error),
      });
      const anterior = await getContactSyncSetting(workspaceId, setting.moduleKey).catch(
        () => null,
      );
      await recordSyncResult({
        workspaceId,
        moduleKey: setting.moduleKey,
        ok: false,
        message: "Google no respondió como se esperaba. Se reintenta en la próxima corrida.",
        syncedContacts: anterior?.syncedContacts ?? 0,
      }).catch(() => undefined);
    }
  }

  // Recién ahora, y sólo si se aplicó todo. Ver el encabezado del archivo.
  if (nuevoSyncToken && !total.quedaronCambiosSinAplicar) {
    await writeSyncCursor(workspaceId, GOOGLE_CONTACTS_INTEGRATION_KEY, nuevoSyncToken).catch(
      (error: unknown) => {
        // No pasa nada: sin marca nueva, la corrida siguiente vuelve a leer lo mismo.
        loguear("no se pudo guardar la marca de sincronización", {
          workspaceId,
          detalle: sanitizeError(error),
        });
      },
    );
  }

  return total;
}
