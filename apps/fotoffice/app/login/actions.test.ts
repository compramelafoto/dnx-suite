import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El `next` del formulario tiene que llegar a la resolución del destino.
 *
 * El panel de login compartido ya ponía `next` en dos lados: un campo oculto del formulario y
 * el enlace de "Continuar con Google". El enlace lo usaba; el formulario no — la acción
 * resolvía el destino sin mirarlo. Consecuencia: entrar con Google respetaba a dónde ibas y
 * entrar con contraseña te dejaba en la portada, en silencio.
 *
 * Eso vuelve inútil la puerta de cada institución (`/w/sfpr/entrar`), que es exactamente un
 * `next` viajando por el formulario.
 *
 * Acá no se valida qué `next` es aceptable: de eso se ocupa
 * `resolveFotofficePostLoginDestination`, que ya distingue una ruta interna de un intento de
 * llevarte a otro sitio y tiene sus propios tests. Lo único que se afirma es que el dato
 * llega hasta ahí.
 */

const { destinationMock, verifyMock, sessionMock, userUpdateMock, cookieSetMock } = vi.hoisted(
  () => ({
    destinationMock: vi.fn(),
    verifyMock: vi.fn(),
    sessionMock: vi.fn(),
    userUpdateMock: vi.fn(),
    cookieSetMock: vi.fn(),
  }),
);

/**
 * `redirect` corta la ejecución lanzando. Se imita para poder afirmar a dónde mandó.
 *
 * Lleva `digest` porque es lo que la acción mira para distinguir "me redirigieron" de "algo
 * explotó": sin eso, su `catch` trataría el redirect como una falla al guardar la sesión.
 */
class RedirectSignal extends Error {
  readonly digest: string;
  constructor(readonly to: string) {
    super(`redirect:${to}`);
    this.digest = `NEXT_REDIRECT;push;${to};307;`;
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSetMock }) }));
vi.mock("@repo/db", () => ({ prisma: { user: { update: userUpdateMock } } }));
vi.mock("@/lib/auth", () => ({ createFotofficeSessionForUser: sessionMock }));
vi.mock("@repo/auth", () => ({ verifyUserPassword: verifyMock }));
vi.mock("@/lib/post-login", () => ({
  resolveFotofficePostLoginDestination: destinationMock,
}));

const { fotofficeLoginAction } = await import("./actions");

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

async function entrar(campos: Record<string, string>): Promise<string> {
  try {
    await fotofficeLoginAction(undefined, formulario(campos));
  } catch (e) {
    if (e instanceof RedirectSignal) return e.to;
    throw e;
  }
  throw new Error("La acción no redirigió.");
}

describe("fotofficeLoginAction", () => {
  beforeEach(() => {
    verifyMock.mockReset().mockResolvedValue({ ok: true, user: { id: 7 } });
    sessionMock.mockReset().mockResolvedValue(undefined);
    userUpdateMock.mockReset().mockResolvedValue({});
    cookieSetMock.mockReset();
    destinationMock.mockReset().mockResolvedValue({ path: "/workspace", workspaceId: null });
  });

  it("le pasa el `next` del formulario a quien resuelve el destino", async () => {
    await entrar({
      email: "socio@example.com",
      password: "x",
      next: "/w/sfpr/entrar",
    });

    expect(destinationMock).toHaveBeenCalledWith({ userId: 7, next: "/w/sfpr/entrar" });
  });

  it("sin `next` no inventa ninguno", async () => {
    await entrar({ email: "socio@example.com", password: "x" });

    expect(destinationMock).toHaveBeenCalledWith({ userId: 7, next: null });
  });

  it("va al destino que le indicaron", async () => {
    destinationMock.mockResolvedValue({ path: "/portal", workspaceId: null });

    await expect(entrar({ email: "socio@example.com", password: "x" })).resolves.toBe("/portal");
  });
});
