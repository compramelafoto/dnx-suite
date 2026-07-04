import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

type UploadAuthUser = {
  id: number;
  role: Role;
};

export async function ensureMpConnected(user: UploadAuthUser) {
  if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { mpConnectedAt: true, mpAccessToken: true, mpUserId: true },
    });
    const mpConnected = !!(lab?.mpConnectedAt && lab?.mpAccessToken && lab?.mpUserId);
    if (!mpConnected) {
      return { ok: false, error: "Debés conectar Mercado Pago para subir fotos." };
    }
  } else {
    const photographer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpAccessToken: true },
    });
    if (!photographer?.mpAccessToken) {
      return { ok: false, error: "Debés conectar Mercado Pago para subir fotos." };
    }
  }

  return { ok: true, error: null };
}

export async function ensureAlbumUploadAccess(albumId: number, userId: number) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, isPublic: true, isHidden: true },
  });

  if (!album) {
    return { ok: false, error: "Álbum no encontrado", status: 404 };
  }

  if (album.userId !== userId) {
    if (!album.isPublic || album.isHidden) {
      return {
        ok: false,
        error: "Este álbum no permite colaboración. Solo el creador puede agregar fotos.",
        status: 403,
      };
    }
  }

  return { ok: true, error: null, status: 200 };
}
