import { describe, expect, it } from "vitest";
import { canCollaboratorDownloadOrder, digitalOrdersVisibilityWhere } from "@/lib/agencies/order-visibility";

describe("pedidos de álbumes de agencia", () => {
  it("el colaborador no ve pedidos de álbumes de agencia; el dueño sí", () => {
    expect(digitalOrdersVisibilityWhere(7)).toEqual({
      OR: [
        { album: { userId: 7 } },
        { album: { photos: { some: { userId: 7 } }, agencyAlbum: { is: null } } },
      ],
    });
  });
  it("descarga: el colaborador de un álbum de agencia no descarga", () => {
    expect(canCollaboratorDownloadOrder({ isCollaborator: true, isAgencyAlbum: true })).toBe(false);
    expect(canCollaboratorDownloadOrder({ isCollaborator: true, isAgencyAlbum: false })).toBe(true);
    expect(canCollaboratorDownloadOrder({ isCollaborator: false, isAgencyAlbum: false })).toBe(false);
  });
});
