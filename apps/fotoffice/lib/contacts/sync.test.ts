import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_DATA_KEY, MAX_WRITES_PER_RUN } from "./constants";
import type { GooglePerson, SyncablePerson } from "./person";

const listLinks = vi.fn();
const createLink = vi.fn();
const updateLink = vi.fn();
const markRemoteDeleted = vi.fn();

// `sync.ts` arrastra `./settings` y `lib/integrations/*`, que importan @repo/db. Instanciar
// Prisma de verdad haría fallar el test por una razón ajena a lo que prueba.
vi.mock("@repo/db", () => ({ prisma: {} }));

// Y arrastra también `./sources` → `./sources/members`, que importa OTRO especificador:
// `@repo/db/fotoffice-members`. El mock de arriba no lo cubre y sin éste el test ni siquiera
// llega a importar `sync.ts`.
vi.mock("@repo/db/fotoffice-members", () => ({
  searchMembers: vi.fn(),
  updateMember: vi.fn(),
  MemberConcurrencyError: class MemberConcurrencyError extends Error {},
}));

vi.mock("./links", () => ({
  listLinks: (...a: unknown[]) => listLinks(...a),
  createLink: (...a: unknown[]) => createLink(...a),
  updateLink: (...a: unknown[]) => updateLink(...a),
  markRemoteDeleted: (...a: unknown[]) => markRemoteDeleted(...a),
}));

const { syncModuleContacts } = await import("./sync");
const { fieldFingerprintsOf } = await import("./fingerprint");
const { readFieldValues } = await import("./person");
const { MemberConcurrencyError } = await import("@repo/db/fotoffice-members");

const applyPull = vi.fn();

const fuente = (personas: SyncablePerson[]) => ({
  moduleKey: "members",
  sourceType: "MEMBER",
  moduleLabel: "Socios",
  list: async () => personas,
  pullableFields: ["email", "phone"] as const,
  applyPull,
});

const socio = (over: Partial<SyncablePerson> = {}): SyncablePerson => ({
  sourceId: "m-1",
  values: {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@ejemplo.com",
    phone: "342 5550000",
    address: null,
    city: null,
    province: null,
    postalCode: null,
    birthDate: null,
  },
  organization: null,
  labels: { "Nº de socio": "124" },
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  ...over,
});

/** El contacto de Google que le corresponde a `socio()`, con el teléfono que se le pase. */
const contacto = (phone: string, over: Partial<GooglePerson> = {}): GooglePerson => ({
  resourceName: "people/c1",
  names: [{ givenName: "Ana", familyName: "Pérez" }],
  emailAddresses: [{ value: "ana@ejemplo.com" }],
  phoneNumbers: [{ value: phone }],
  clientData: [{ key: CLIENT_DATA_KEY, value: "members:m-1" }],
  ...over,
});

/** Un vínculo con las huellas POR CAMPO de los dos lados, que es lo que guarda la corrida. */
const vinculo = (over: Record<string, unknown> = {}) => ({
  id: "l-1",
  moduleKey: "members",
  sourceType: "MEMBER",
  sourceId: "m-1",
  resourceName: "people/c1",
  etag: "%e1",
  localFingerprint: fieldFingerprintsOf(socio().values),
  remoteFingerprint: fieldFingerprintsOf(readFieldValues(contacto("342 5550000"))),
  status: "LINKED",
  ...over,
});

// `person: null` a propósito: estos tests no le prestan atención a lo que Google devuelve, así
// que el doble se queda en el comportamiento degradado (huella de lo ENVIADO). El contrato de
// "la huella remota sale de la respuesta de Google" lo fija su propio test, más abajo, con un
// doble que sí la manda.
const clienteFalso = () => ({
  ensureGroup: vi.fn().mockResolvedValue("contactGroups/socios"),
  listChanges: vi.fn(),
  createContact: vi
    .fn()
    .mockResolvedValue({ resourceName: "people/c1", etag: "%e1", person: null }),
  updateContact: vi.fn().mockResolvedValue({ etag: "%e2", person: null }),
  setGroupMembership: vi.fn().mockResolvedValue(undefined),
});

const correr = (over: Record<string, unknown> = {}) =>
  syncModuleContacts({
    workspaceId: "w-1",
    source: fuente([socio()]),
    client: clienteFalso(),
    groupResourceName: "contactGroups/socios",
    remotos: new Map(),
    ...over,
  } as Parameters<typeof syncModuleContacts>[0]);

beforeEach(() => {
  listLinks.mockReset().mockResolvedValue([]);
  createLink.mockReset().mockResolvedValue(undefined);
  updateLink.mockReset().mockResolvedValue(undefined);
  markRemoteDeleted.mockReset().mockResolvedValue(undefined);
  applyPull.mockReset().mockResolvedValue(undefined);
});

describe("la corrida de un módulo", () => {
  it("un socio nuevo se crea en Google y queda vinculado", async () => {
    const client = clienteFalso();
    const r = await correr({ client });

    expect(r.contactosCreados).toBe(1);
    expect(createLink).toHaveBeenCalledTimes(1);
    // Nace adentro del grupo del módulo, no suelto en la agenda.
    const body = client.createContact.mock.calls[0][0];
    expect(body.memberships[0].contactGroupMembership.contactGroupResourceName).toBe(
      "contactGroups/socios",
    );
  });

  it("si Google devuelve un contacto distinto del que se le mandó, la huella que se guarda es la de lo que Google devolvió", async () => {
    // Google puede normalizar o reformatear lo que se le manda —acá, el teléfono—. Si la
    // huella remota se calculara sobre lo ENVIADO en vez de sobre la respuesta, la corrida
    // siguiente vería ahí una diferencia que nadie provocó (el padrón dice una cosa, la huella
    // guardada dice otra) y volvería a empujar a este socio. Para siempre, cada quince
    // minutos, porque lo que Google devuelve nunca va a coincidir con "lo enviado".
    const client = clienteFalso();
    const comoLoGuardoGoogle = contacto("+54 9 342 555-0000"); // Google reformateó el teléfono.
    client.createContact.mockResolvedValue({
      resourceName: "people/c1",
      etag: "%e1",
      person: comoLoGuardoGoogle,
    });

    await correr({ client });

    expect(createLink).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(comoLoGuardoGoogle)),
      }),
    );
    // Y no la de lo que se mandó: si el teléfono reformateado no cambiara la huella, este test
    // no probaría nada.
    const huellaDeLoEnviado = fieldFingerprintsOf(socio().values);
    const huellaGuardada = createLink.mock.calls[0][0].remoteFingerprint;
    expect(huellaGuardada).not.toBe(huellaDeLoEnviado);
  });

  it("una segunda corrida sin cambios no escribe nada, ni en Google ni en la base", async () => {
    // Es el caso normal. Si escribiera igual, cada 15 minutos se reescribiría el padrón —y,
    // peor, se renovaría el `updateTime` del contacto, que es el desempate de los conflictos.
    listLinks.mockResolvedValue([vinculo()]);
    const client = clienteFalso();

    const r = await correr({
      client,
      remotos: new Map([["people/c1", contacto("342 5550000")]]),
    });

    expect(client.createContact).not.toHaveBeenCalled();
    expect(client.updateContact).not.toHaveBeenCalled();
    expect(updateLink).not.toHaveBeenCalled();
    expect(r.contactosActualizados).toBe(0);
  });

  it("el etag nuevo se guarda aunque no haya nada que sincronizar", async () => {
    // Alguien editó en Google algo que no espejamos (una nota, una foto): no hay nada que
    // traer ni que empujar, pero el etag se movió. Si no se guardara, la próxima vez que el
    // padrón corrija a este socio Google rechazaría la escritura, y no habría forma de salir:
    // sin cambios de su lado, el contacto ya no vuelve a venir con un etag fresco.
    listLinks.mockResolvedValue([vinculo({ etag: "%viejo" })]);
    const client = clienteFalso();

    await correr({
      client,
      remotos: new Map([["people/c1", contacto("342 5550000", { etag: "%fresco" })]]),
    });

    expect(client.updateContact).not.toHaveBeenCalled();
    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({ etag: "%fresco" }),
    );
  });

  it("si falla el guardado del etag fresco cuando no hay nada que sincronizar, la marca tampoco puede avanzar", async () => {
    // El mismo agujero que el test anterior, pero en la rama `NOTHING` (sync.ts): ahí también
    // se guarda el etag que vino en el delta, sin escribir nada en Google. Si ese `updateLink`
    // falla y el `catch` no lo nota, la corrida avanza el `syncToken` igual, el etag fresco se
    // pierde, y la corrida siguiente entra a `vinculo && !remoto` con el etag guardado, viejo
    // —trabada, por la misma razón que el caso de arriba.
    listLinks.mockResolvedValue([vinculo({ etag: "%viejo" })]);
    updateLink.mockRejectedValue(new Error("la base no contestó"));
    const client = clienteFalso();

    const r = await correr({
      client,
      remotos: new Map([["people/c1", contacto("342 5550000", { etag: "%fresco" })]]),
    });

    expect(r.quedaronCambiosSinAplicar).toBe(true);
  });

  it("un socio que dejó de estar vigente sale del grupo, pero su contacto NO se borra", async () => {
    listLinks.mockResolvedValue([vinculo({ sourceId: "m-viejo", resourceName: "people/c9" })]);
    const client = clienteFalso();

    const r = await correr({ source: fuente([]), client });

    expect(r.sacadosDelGrupo).toBe(1);
    expect(client.setGroupMembership).toHaveBeenCalledWith({
      groupResourceName: "contactGroups/socios",
      resourceName: "people/c9",
      member: false,
    });
    // `updateLink` lleva el workspaceId adelante: aísla la escritura por institución.
    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({ status: "UNGROUPED" }),
    );
  });

  it("un socio que vuelve a estar vigente vuelve al grupo, sin crear un contacto nuevo", async () => {
    // Lo dice el propio schema: "si vuelve a estar vigente, vuelve al grupo sin crear nada".
    listLinks.mockResolvedValue([vinculo({ status: "UNGROUPED" })]);
    const client = clienteFalso();

    await correr({ client, remotos: new Map([["people/c1", contacto("342 5550000")]]) });

    expect(client.createContact).not.toHaveBeenCalled();
    expect(client.setGroupMembership).toHaveBeenCalledWith({
      groupResourceName: "contactGroups/socios",
      resourceName: "people/c1",
      member: true,
    });
    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({ status: "LINKED" }),
    );
  });

  it("una corrección hecha en el celular vuelve al padrón", async () => {
    const remoto = contacto("342 5559999", {
      metadata: { sources: [{ updateTime: "2026-09-16T12:00:00Z" }] },
    });
    listLinks.mockResolvedValue([vinculo()]);

    const r = await correr({ remotos: new Map([["people/c1", remoto]]) });

    expect(r.sociosCorregidos).toBe(1);
    expect(applyPull).toHaveBeenCalledWith("w-1", "m-1", { phone: "342 5559999" });
  });

  it("después de traer una corrección se guardan las huellas de la decisión, no otras", async () => {
    // El contrato de `merge.ts`: la huella local es SIEMPRE `localAfterChanges` —el padrón ya
    // corregido— y, como acá no se escribió en Google, la remota es la que el módulo leyó.
    const remoto = contacto("342 5559999", {
      metadata: { sources: [{ updateTime: "2026-09-16T12:00:00Z" }] },
    });
    listLinks.mockResolvedValue([vinculo()]);

    await correr({ remotos: new Map([["people/c1", remoto]]) });

    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    );
  });

  it("lo que corrigió el padrón se empuja a Google y el vínculo queda con la huella escrita", async () => {
    // Google no tocó nada (su huella coincide con la guardada) y el padrón sí: gana el padrón.
    const remoto = contacto("342 5559999");
    listLinks.mockResolvedValue([
      vinculo({
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    ]);
    const client = clienteFalso();

    const r = await correr({ client, remotos: new Map([["people/c1", remoto]]) });

    expect(r.contactosActualizados).toBe(1);
    expect(client.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ resourceName: "people/c1", etag: "%e1" }),
    );
    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({
        etag: "%e2",
        localFingerprint: fieldFingerprintsOf(socio().values),
        remoteFingerprint: fieldFingerprintsOf(socio().values),
      }),
    );
  });

  it("en la rama PUSH/BOTH, si Google devuelve la persona que quedó guardada, la huella remota sale de ESA respuesta", async () => {
    // El doble por defecto (`clienteFalso`) responde `person: null` en `updateContact`, así
    // que el único test de arriba que mira `remoteFingerprint` en esta rama (sync.ts, el
    // `if (vinculo)` final) se queda siempre en el camino degradado —la huella de lo enviado—.
    // Si el cableado real (`actualizado.person`) estuviera mal, ningún test lo agarraría. Éste
    // hace que el doble SÍ devuelva la persona, como la People API real.
    const remoto = contacto("342 5559999");
    listLinks.mockResolvedValue([
      vinculo({
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    ]);
    const client = clienteFalso();
    const comoLoGuardoGoogle = contacto("+54 9 342 555-0000"); // Google reformateó el teléfono.
    client.updateContact.mockResolvedValue({ etag: "%e2", person: comoLoGuardoGoogle });

    await correr({ client, remotos: new Map([["people/c1", remoto]]) });

    expect(updateLink).toHaveBeenCalledWith(
      "w-1",
      "l-1",
      expect.objectContaining({
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(comoLoGuardoGoogle)),
      }),
    );
    // Y no la de lo que se mandó: si el reformateo no cambiara la huella, este test no
    // probaría nada.
    const huellaDeLoEnviado = fieldFingerprintsOf(socio().values);
    const huellaGuardada = updateLink.mock.calls[0][2].remoteFingerprint;
    expect(huellaGuardada).not.toBe(huellaDeLoEnviado);
  });

  it("para actualizar usa el etag que vino en la lectura, no el guardado", async () => {
    // Si una corrida escribió bien y no llegó a guardar el vínculo, el etag guardado quedó
    // viejo. Sin esto, Google rechazaría todas las actualizaciones siguientes de esa persona.
    const remoto = contacto("342 5559999", { etag: "%fresco" });
    listLinks.mockResolvedValue([
      vinculo({
        etag: "%viejo",
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    ]);
    const client = clienteFalso();

    await correr({ client, remotos: new Map([["people/c1", remoto]]) });

    expect(client.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ etag: "%fresco" }),
    );
  });

  it("si la escritura en Google falla, el vínculo NO se toca", async () => {
    // Un vínculo que describe un estado que no se alcanzó es peor que uno viejo: la corrida
    // siguiente atribuiría mal el cambio y se perdería el dato de alguno de los dos lados.
    const remoto = contacto("342 5559999");
    listLinks.mockResolvedValue([
      vinculo({
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    ]);
    const client = clienteFalso();
    client.updateContact.mockRejectedValue(new Error("Google dijo que no"));

    const r = await correr({ client, remotos: new Map([["people/c1", remoto]]) });

    expect(updateLink).not.toHaveBeenCalled();
    expect(r.contactosActualizados).toBe(0);
  });

  it("si el empuje falla pero el contacto SÍ vino en el delta, la marca no puede avanzar", async () => {
    // La secuencia que dejaba a alguien trabado para siempre: alguien edita el contacto en
    // Google (el etag pasa de E0 a E1) y el padrón también cambió algo → la decisión es
    // PUSH/BOTH → `updateContact` usa el etag fresco E1 (bien) pero falla por algo transitorio
    // (un 429 es plausible). Si el `catch` no avisa que quedó algo sin aplicar, la corrida
    // avanza el `syncToken` igual. En la corrida siguiente el contacto ya no viene en el
    // delta —Google no lo tocó de nuevo—, se entra por la rama `vinculo && !remoto`, y ahí el
    // único etag disponible es el guardado, E0, que quedó viejo: Google rechaza la
    // actualización, y la vuelve a rechazar en cada corrida siguiente, porque sin una edición
    // nueva del lado de Google el contacto no vuelve a aparecer con un etag fresco.
    const remoto = contacto("342 5559999");
    listLinks.mockResolvedValue([
      vinculo({
        localFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "342 5559999" }),
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(remoto)),
      }),
    ]);
    const client = clienteFalso();
    client.updateContact.mockRejectedValue(new Error("429"));

    const r = await correr({ client, remotos: new Map([["people/c1", remoto]]) });

    expect(r.quedaronCambiosSinAplicar).toBe(true);
  });

  it("un contacto que no vino en el delta no corrige al socio, pero recibe lo que cambió el padrón", async () => {
    // Con syncToken, Google manda SOLO lo que cambió. Que un contacto no venga significa que
    // Google no lo tocó —no que lo borraron—, así que el padrón sigue mandando lo suyo.
    listLinks.mockResolvedValue([
      vinculo({ remoteFingerprint: fieldFingerprintsOf({ ...socio().values, phone: "viejo" }) }),
    ]);
    const client = clienteFalso();

    const r = await correr({ client, remotos: new Map() });

    expect(applyPull).not.toHaveBeenCalled();
    expect(client.createContact).not.toHaveBeenCalled();
    expect(client.updateContact).toHaveBeenCalledTimes(1);
    expect(r.contactosActualizados).toBe(1);
  });

  it("un contacto que no vino en el delta y que no cambió de ningún lado no se toca", async () => {
    listLinks.mockResolvedValue([vinculo()]);
    const client = clienteFalso();

    await correr({ client, remotos: new Map() });

    expect(client.updateContact).not.toHaveBeenCalled();
    expect(updateLink).not.toHaveBeenCalled();
  });

  it("un contacto borrado en Google no se recrea ni se vuelve a tocar", async () => {
    listLinks.mockResolvedValue([vinculo({ status: "REMOTE_DELETED" })]);
    const client = clienteFalso();

    await correr({ client, remotos: new Map() });

    expect(client.createContact).not.toHaveBeenCalled();
    expect(client.updateContact).not.toHaveBeenCalled();
    expect(applyPull).not.toHaveBeenCalled();
  });

  it("que falle un socio no frena a los demás", async () => {
    // Un mail inválido en una ficha no puede dejar sin sincronizar al resto del padrón.
    const client = clienteFalso();
    client.createContact
      .mockRejectedValueOnce(new Error("Google dijo que no"))
      .mockResolvedValueOnce({ resourceName: "people/c2", etag: "%e" });

    const r = await correr({
      source: fuente([socio({ sourceId: "m-1" }), socio({ sourceId: "m-2" })]),
      client,
    });

    expect(r.contactosCreados).toBe(1);
  });

  it("perder una carrera contra la Secretaría no es una falla: se saltea y queda pendiente", async () => {
    // `applyPull` lanza `MemberConcurrencyError` cuando alguien guardó al socio primero. No se
    // pisa su cambio: esa persona se saltea y la corrida siguiente la agarra.
    const remoto = contacto("342 5559999", {
      metadata: { sources: [{ updateTime: "2026-09-16T12:00:00Z" }] },
    });
    listLinks.mockResolvedValue([vinculo()]);
    applyPull.mockRejectedValue(new MemberConcurrencyError());

    const r = await correr({ remotos: new Map([["people/c1", remoto]]) });

    expect(r.sociosCorregidos).toBe(0);
    expect(updateLink).not.toHaveBeenCalled();
    // Y el aviso de que NO se puede avanzar el syncToken: si se avanzara, ese cambio de Google
    // no volvería a venir nunca y la corrección del celular se perdería en silencio.
    expect(r.quedaronCambiosSinAplicar).toBe(true);
  });

  it("un contacto creado a mano DENTRO del grupo se ignora: no da de alta un socio", async () => {
    // La etapa 1 no importa altas. Un socio necesita número, categoría y cuota, y eso no
    // sale de una agenda. El motor solo recorre las personas que le da la fuente, así que
    // un contacto sin persona detrás no tiene por dónde entrar — este test lo fija.
    const aMano: GooglePerson = {
      resourceName: "people/c77",
      names: [{ givenName: "Alguien", familyName: "Nuevo" }],
      clientData: [{ key: CLIENT_DATA_KEY, value: "members:m-inventado" }],
    };

    const r = await correr({
      source: fuente([]),
      remotos: new Map([["people/c77", aMano]]),
    });

    expect(applyPull).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
    expect(r).toMatchObject({ contactosCreados: 0, sociosCorregidos: 0 });
  });

  it("un contacto nuestro que quedó huérfano se adopta en vez de crear un duplicado", async () => {
    // Pasa cuando Google acepta la creación y la respuesta no llega: el contacto quedó hecho
    // y el vínculo no. Sin esto, cada corrida crearía otro contacto para el mismo socio.
    const huerfano = contacto("342 5550000", { resourceName: "people/c5", etag: "%e5" });
    const client = clienteFalso();

    const r = await correr({ client, remotos: new Map([["people/c5", huerfano]]) });

    expect(client.createContact).not.toHaveBeenCalled();
    expect(r.contactosCreados).toBe(0);
    expect(createLink).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w-1",
        sourceId: "m-1",
        resourceName: "people/c5",
        etag: "%e5",
        remoteFingerprint: fieldFingerprintsOf(readFieldValues(huerfano)),
      }),
    );
  });

  it("después de adoptar a un huérfano, la corrida siguiente empuja el padrón entero, sin comparar campo por campo", async () => {
    // Fija lo que el código REALMENTE hace tras una adopción, no lo que decía el comentario
    // viejo ("la corrida siguiente resuelve la diferencia, si la hay, con la atribución
    // completa"): la adopción no escribe nada en Google, así que este contacto no vuelve a
    // aparecer en el delta de la corrida siguiente. Se entra por la rama `vinculo && !remoto`,
    // que NO pasa por `decideForPerson` — si el padrón difiere de la huella remota que la
    // adopción guardó, empuja el registro ENTERO. Es el resultado correcto (gana el padrón),
    // pero sin ninguna atribución campo por campo.
    const huerfano = contacto("342 5550000", { resourceName: "people/c5", etag: "%e5" });
    const vinculoAdoptado = vinculo({
      resourceName: "people/c5",
      etag: "%e5",
      localFingerprint: fieldFingerprintsOf(socio().values),
      remoteFingerprint: fieldFingerprintsOf(readFieldValues(huerfano)),
    });

    // La corrida siguiente: el padrón corrigió el teléfono y el contacto adoptado no vino en
    // el delta —Google no lo tocó desde la adopción.
    listLinks.mockResolvedValue([vinculoAdoptado]);
    const client = clienteFalso();
    const socioConCambio = socio({ values: { ...socio().values, phone: "342 5551234" } });

    const r = await correr({ source: fuente([socioConCambio]), client, remotos: new Map() });

    expect(applyPull).not.toHaveBeenCalled();
    expect(client.updateContact).toHaveBeenCalledTimes(1);
    const cuerpo = client.updateContact.mock.calls[0][0].body;
    expect(cuerpo.phoneNumbers[0].value).toBe("342 5551234");
    expect(r.contactosActualizados).toBe(1);
  });

  it("si el mismo socio aparece en dos contactos, se adopta uno solo y siempre el mismo", async () => {
    // Nada se borra: el duplicado queda en la agenda. Lo que no puede pasar es que la elección
    // cambie de corrida en corrida, porque el socio saltaría de un contacto al otro.
    const uno = contacto("342 5550000", { resourceName: "people/c5", etag: "%e5" });
    const otro = contacto("342 5550000", { resourceName: "people/c7", etag: "%e7" });

    for (const orden of [
      [
        ["people/c7", otro],
        ["people/c5", uno],
      ],
      [
        ["people/c5", uno],
        ["people/c7", otro],
      ],
    ] as [string, GooglePerson][][]) {
      createLink.mockClear();
      await correr({ remotos: new Map(orden) });
      expect(createLink).toHaveBeenCalledTimes(1);
      expect(createLink.mock.calls[0][0]).toMatchObject({ resourceName: "people/c5" });
    }
  });

  it("el tope de escrituras corta la corrida y avisa que quedó gente sin mirar", async () => {
    const personas = Array.from({ length: MAX_WRITES_PER_RUN + 1 }, (_, i) =>
      socio({ sourceId: `m-${i}` }),
    );
    const client = clienteFalso();

    const r = await correr({ source: fuente(personas), client });

    expect(client.createContact).toHaveBeenCalledTimes(MAX_WRITES_PER_RUN);
    expect(r.contactosCreados).toBe(MAX_WRITES_PER_RUN);
    expect(r.quedaronCambiosSinAplicar).toBe(true);
  });
});
