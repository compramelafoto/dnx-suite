import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_DATA_KEY } from "./constants";

vi.mock("@repo/db", () => ({ prisma: {} }));

// `./sources/members` importa `@repo/db/fotoffice-members`, que es OTRO especificador: el mock
// de `@repo/db` no lo cubre y sin éste el test se cae al importar.
vi.mock("@repo/db/fotoffice-members", () => ({
  searchMembers: vi.fn(),
  updateMember: vi.fn(),
  MemberConcurrencyError: class MemberConcurrencyError extends Error {},
}));

const getGoogleAccessToken = vi.fn();
vi.mock("@/lib/integrations/access-token", () => ({
  getGoogleAccessToken: (...a: unknown[]) => getGoogleAccessToken(...a),
}));

const readSyncCursor = vi.fn();
const writeSyncCursor = vi.fn();
vi.mock("@/lib/integrations/store", () => ({
  readSyncCursor: (...a: unknown[]) => readSyncCursor(...a),
  writeSyncCursor: (...a: unknown[]) => writeSyncCursor(...a),
}));

const listContactSyncSettings = vi.fn();
const recordSyncResult = vi.fn();
vi.mock("./settings", () => ({
  listContactSyncSettings: (...a: unknown[]) => listContactSyncSettings(...a),
  getContactSyncSetting: vi.fn().mockResolvedValue(null),
  recordSyncResult: (...a: unknown[]) => recordSyncResult(...a),
  saveGroupResourceName: vi.fn(),
}));

const listLinks = vi.fn();
const markRemoteDeleted = vi.fn();
vi.mock("./links", () => ({
  listLinks: (...a: unknown[]) => listLinks(...a),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  markRemoteDeleted: (...a: unknown[]) => markRemoteDeleted(...a),
}));

const getContactSource = vi.fn();
vi.mock("./sources", () => ({
  getContactSource: (...a: unknown[]) => getContactSource(...a),
  listContactSources: vi.fn(),
}));

const listChanges = vi.fn();
vi.mock("./client", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createContactsClient: () => ({
    ensureGroup: vi.fn().mockResolvedValue("contactGroups/socios"),
    listChanges: (...a: unknown[]) => listChanges(...a),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    setGroupMembership: vi.fn(),
  }),
}));

const { syncWorkspaceContacts } = await import("./sync");

const fuenteVacia = (over: Record<string, unknown> = {}) => ({
  moduleKey: "members",
  sourceType: "MEMBER",
  moduleLabel: "Socios",
  list: async () => [],
  pullableFields: ["email", "phone"] as const,
  applyPull: vi.fn(),
  ...over,
});

beforeEach(() => {
  getGoogleAccessToken.mockReset();
  readSyncCursor.mockReset().mockResolvedValue("t-1");
  writeSyncCursor.mockReset().mockResolvedValue(undefined);
  listContactSyncSettings.mockReset().mockResolvedValue([]);
  recordSyncResult.mockReset().mockResolvedValue(undefined);
  listLinks.mockReset().mockResolvedValue([]);
  markRemoteDeleted.mockReset().mockResolvedValue(undefined);
  getContactSource.mockReset().mockReturnValue(fuenteVacia());
  listChanges
    .mockReset()
    .mockResolvedValue({ people: [], nextPageToken: null, nextSyncToken: "t-2" });
});

describe("cuando Google no está disponible", () => {
  it("sin cuenta conectada devuelve el motivo y no escribe nada", async () => {
    // Una institución que no conectó su cuenta no es un error: es lo normal hasta que la
    // conecta. La corrida tiene que decirlo y seguir con las demás.
    getGoogleAccessToken.mockResolvedValue({ ok: false, reason: "NOT_CONNECTED" });
    const r = await syncWorkspaceContacts("w-1");
    expect(r.motivo).toBe("la institución no conectó su cuenta de Google");
    expect(r.contactosCreados).toBe(0);
    expect(listContactSyncSettings).not.toHaveBeenCalled();
  });

  it("con el permiso revocado avisa que hay que reconectar, no que falló", async () => {
    getGoogleAccessToken.mockResolvedValue({ ok: false, reason: "NEEDS_RECONSENT" });
    const r = await syncWorkspaceContacts("w-1");
    expect(r.motivo).toContain("volver a conectar");
  });

  it("con la cuenta conectada pero ningún interruptor encendido, no lee la agenda", async () => {
    // Leer la agenda entera para no hacer nada gasta cuota de la People API al pedo.
    getGoogleAccessToken.mockResolvedValue({ ok: true, accessToken: "t" });
    listContactSyncSettings.mockResolvedValue([{ moduleKey: "members", enabled: false }]);
    const r = await syncWorkspaceContacts("w-1");
    expect(r.motivo).toBe("ningún módulo tiene el interruptor encendido");
    expect(listChanges).not.toHaveBeenCalled();
  });

  it("si la agenda no se puede leer, devuelve el motivo y no lanza", async () => {
    getGoogleAccessToken.mockResolvedValue({ ok: true, accessToken: "t" });
    listContactSyncSettings.mockResolvedValue([{ moduleKey: "members", enabled: true }]);
    listChanges.mockRejectedValue(new Error("502"));
    const r = await syncWorkspaceContacts("w-1");
    expect(r.motivo).toBe("no se pudo leer la agenda de Google");
  });

  it("si el pedido del token de Google directamente RECHAZA (no que devuelva ok:false), la corrida entera no lanza", async () => {
    // Es la regla más fuerte del archivo: `syncWorkspaceContacts` "Nunca lanza", porque quien
    // la llama es un cron que recorre instituciones, y una que lance se lleva puestas a todas
    // las demás. Los demás tests de este describe ejercitan el camino NORMAL de
    // `getGoogleAccessToken` (devuelve `{ ok: false, reason }`), que es el `catch` de adentro
    // (`correrInstitucion`) — ninguno prueba qué pasa si la promesa se RECHAZA de verdad, que
    // es lo que agarra el `catch` de AFUERA (`syncWorkspaceContacts`).
    getGoogleAccessToken.mockRejectedValue(new Error("ECONNRESET"));
    await expect(syncWorkspaceContacts("w-1")).resolves.toMatchObject({
      motivo: "no se pudo completar la corrida",
      contactosCreados: 0,
      quedaronCambiosSinAplicar: false,
    });
  });
});

describe("la marca de 'dame solo lo que cambió'", () => {
  beforeEach(() => {
    getGoogleAccessToken.mockResolvedValue({ ok: true, accessToken: "t" });
    listContactSyncSettings.mockResolvedValue([
      { moduleKey: "members", enabled: true, googleGroupResourceName: "contactGroups/socios" },
    ]);
  });

  it("se guarda recién cuando la corrida aplicó todo lo que Google le trajo", async () => {
    await syncWorkspaceContacts("w-1");
    expect(writeSyncCursor).toHaveBeenCalledWith("w-1", "google-contacts", "t-2");
  });

  it("NO se guarda si quedó algo sin aplicar: ese cambio tiene que volver a venir", async () => {
    // Avanzar la marca es decirle a Google "ya lo tengo". Si no se aplicó, ese cambio no
    // vuelve a venir nunca más y la corrección hecha en el celular se pierde en silencio.
    getContactSource.mockReturnValue(
      fuenteVacia({
        list: async () => {
          throw new Error("la base no contestó");
        },
      }),
    );

    const r = await syncWorkspaceContacts("w-1");

    expect(writeSyncCursor).not.toHaveBeenCalled();
    expect(r.quedaronCambiosSinAplicar).toBe(true);
    expect(recordSyncResult).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("un contacto borrado en Google se anota, y el socio queda intacto", async () => {
    listChanges.mockResolvedValue({
      people: [
        {
          resourceName: "people/c9",
          clientData: [{ key: CLIENT_DATA_KEY, value: "members:m-1" }],
          metadata: { deleted: true },
        },
      ],
      nextPageToken: null,
      nextSyncToken: "t-2",
    });

    await syncWorkspaceContacts("w-1");

    expect(markRemoteDeleted).toHaveBeenCalledWith("w-1", "people/c9");
  });
});
