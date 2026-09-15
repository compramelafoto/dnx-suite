import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Iniciar sesión no puede fabricar una institución.
 *
 * El 2026-09-14 había dos instituciones fantasma en producción: "Emeveph" y "Julio Libardi",
 * las dos vacías —cero socios, cero módulos— y las dos de socios reales de SFPR. El de
 * Libardi explica el mecanismo completo: en el padrón figura con `jalibardi@hotmail.com`,
 * pero entró con `julio.libardi@gmail.com`. El reconocimiento del socio es por email exacto,
 * no coincidió, y el camino por defecto de quien "no se reconoce" era crearle un negocio con
 * él de dueño.
 *
 * El reconocimiento por email siempre va a fallar para alguien: con 159 socios, que dos
 * entren con otra dirección es lo esperable. Por eso el arreglo no es afinar la coincidencia
 * —eso es una mejora, no una garantía— sino cortar la consecuencia: a quien no se reconoce se
 * le PREGUNTA a qué vino. Crear una institución pasa a ser un acto deliberado, nunca el
 * efecto colateral de haber iniciado sesión.
 */

const {
  userFindUniqueMock,
  workspaceMembershipFindManyMock,
  membershipFindFirstMock,
  workspaceCreateMock,
  brandingFindUniqueMock,
  brandingCreateMock,
  membershipCountMock,
  legacyCountMock,
  memberFindFirstMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  workspaceMembershipFindManyMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  workspaceCreateMock: vi.fn(),
  brandingFindUniqueMock: vi.fn(),
  brandingCreateMock: vi.fn(),
  membershipCountMock: vi.fn(async () => 0),
  legacyCountMock: vi.fn(async () => 0),
  memberFindFirstMock: vi.fn(async () => null),
}));

vi.mock("@/lib/portal/profile-choice", () => ({ readProfileChoice: vi.fn(async () => null) }));
vi.mock("@/lib/portal/profiles", async () => {
  const actual = await vi.importActual<typeof import("../portal/profiles")>("../portal/profiles");
  return { ...actual, listUserProfiles: vi.fn(async () => []) };
});
vi.mock("@/lib/portal/claim", () => ({ findClaimableMembership: async () => null }));
vi.mock("@/lib/members/invitation-continuity-resolve", () => ({
  resolveInvitationContinuityPath: vi.fn(async () => null),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    workspaceMembership: { findMany: workspaceMembershipFindManyMock, count: membershipCountMock },
    membership: { findFirst: membershipFindFirstMock, count: legacyCountMock },
    member: { findFirst: memberFindFirstMock },
    workspace: { create: workspaceCreateMock },
    fotofficeWorkspaceBranding: {
      findUnique: brandingFindUniqueMock,
      create: brandingCreateMock,
    },
  },
}));

const { resolveFotofficePostLoginDestination } = await import("../post-login");
const { WELCOME_PATH } = await import("./welcome");

/** Alguien que FotoOffice no conoce: sin membresías, sin ficha de socio, sin invitación. */
function unDesconocido(id: number) {
  userFindUniqueMock.mockResolvedValueOnce({
    id,
    email: "julio.libardi@gmail.com",
    name: "Julio Libardi",
    role: "USER",
    globalRole: "USER",
  });
  workspaceMembershipFindManyMock.mockResolvedValue([]);
  membershipFindFirstMock.mockResolvedValue(null);
  // El camino viejo llegaba hasta acá y creaba de verdad. Se deja respondiendo para que, si
  // alguien lo reabre, el test falle por el destino —que es lo que se quiere leer— y no por
  // un mock a medias.
  workspaceCreateMock.mockResolvedValue({ id: "ws-fantasma" });
}

describe("post-login — a quien no se reconoce se le pregunta, no se le crea nada", () => {
  beforeEach(() => {
    userFindUniqueMock.mockReset();
    workspaceMembershipFindManyMock.mockReset();
    membershipFindFirstMock.mockReset();
    workspaceCreateMock.mockReset();
    brandingFindUniqueMock.mockReset();
    brandingCreateMock.mockReset();
  });

  it("el socio que entra con otro email va a la bienvenida, no a un negocio propio", async () => {
    unDesconocido(834);

    const dest = await resolveFotofficePostLoginDestination({ userId: 834 });

    expect(dest).toEqual({ path: WELCOME_PATH, workspaceId: null });
  });

  it("no crea el workspace: es el caso de Libardi, y ahí es donde nacía el fantasma", async () => {
    unDesconocido(834);

    await resolveFotofficePostLoginDestination({ userId: 834 });

    expect(workspaceCreateMock).not.toHaveBeenCalled();
    expect(brandingCreateMock).not.toHaveBeenCalled();
  });

  it("un `next` del navegador no alcanza para saltearse la pregunta", async () => {
    // Sin esto, un enlace a `/workspace` guardado en favoritos volvería a crear la institución
    // por la puerta de atrás: el destino se respeta solo cuando ya hay dónde entrar.
    unDesconocido(834);

    const dest = await resolveFotofficePostLoginDestination({
      userId: 834,
      next: "/workspace",
    });

    expect(dest.path).toBe(WELCOME_PATH);
    expect(workspaceCreateMock).not.toHaveBeenCalled();
  });
});

/**
 * La barrera: un solo lugar del código puede crear una institución.
 *
 * El arreglo de arriba tapa el agujero por donde se colaron los dos fantasmas, pero no impide
 * que mañana alguien abra otro: hay ocho rutas que históricamente llamaban a la vieja función
 * "buscá o creá", y basta con que una sola vuelva para reponer el defecto en silencio.
 *
 * Esto no se puede verificar renderizando. Se verifica sobre el código fuente, igual que ya
 * hacen `no-phantom-workspace`, `preview-isolation` y `sender-isolation`.
 */
describe("barrera — crear una institución es un acto explícito y único", () => {
  const raizApp = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

  /** Se mira el CÓDIGO, no los comentarios: la prosa nombra justamente lo que no se hace. */
  function codigo(archivo: string): string {
    return readFileSync(archivo, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  function fuentes(dir: string, acc: string[] = []): string[] {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada === ".next") continue;
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) fuentes(ruta, acc);
      else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) acc.push(ruta);
    }
    return acc;
  }

  /**
   * Los dos únicos archivos con permiso: donde se define, y la acción que la persona dispara
   * a propósito desde la bienvenida o el selector de perfil.
   */
  const PERMITIDOS = new Set([
    join(raizApp, "lib", "ensure-workspace.ts"),
    join(raizApp, "app", "actions", "profile-choice.ts"),
  ]);

  const archivos = [...fuentes(join(raizApp, "app")), ...fuentes(join(raizApp, "lib"))];

  it("ningún otro archivo llama a la creación de workspaces", () => {
    const infractores = archivos
      .filter((f) => !PERMITIDOS.has(f))
      .filter((f) => /createFotofficeWorkspaceForUser\s*\(/.test(codigo(f)))
      .map((f) => relative(raizApp, f));

    expect(infractores).toEqual([]);
  });

  it("la vieja función que mezclaba buscar con crear ya no existe en ninguna parte", () => {
    const sobrevivientes = archivos
      .filter((f) => /ensureFotofficeWorkspaceForUser/.test(codigo(f)))
      .map((f) => relative(raizApp, f));

    expect(sobrevivientes).toEqual([]);
  });
});
