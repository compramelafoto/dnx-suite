/**
 * Tipos + formato de texto (sin Prisma) para diagnóstico de álbum.
 * Importable desde componentes cliente.
 */

export type DiagnosticSeverity = "ok" | "info" | "warning" | "error";

export type DiagnosticItem = {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail?: string;
};

export type AlbumDiagnosticsExecutiveStatus =
  | "READY"
  | "READY_WITH_WARNINGS"
  | "BLOCKED"
  | "SUBALBUM_EVENT_CONTEXT"
  | "NEEDS_REVIEW";

export type AlbumDiagnosticsResult = {
  albumId: number;
  generatedAt: string;
  summary: {
    status: AlbumDiagnosticsExecutiveStatus;
    canAppearInPublicDirectory: boolean;
    canSellStandardCheckout: boolean;
    anonymousCanPassPublicGate: boolean;
    headline: string;
    primaryReasons: string[];
  };
  sections: {
    general: {
      title: string;
      items: DiagnosticItem[];
    };
    publication: {
      title: string;
      expectation:
        | "CAN_APPEAR_PUBLICLY"
        | "CANNOT_APPEAR_PUBLICLY"
        | "SHOULD_NOT_BY_DESIGN"
        | "DEPENDS_ON_EVENT_GALLERY";
      expectationLabel: string;
      items: DiagnosticItem[];
    };
    commercial: {
      title: string;
      items: DiagnosticItem[];
    };
    terms: {
      title: string;
      items: DiagnosticItem[];
    };
    payments: {
      title: string;
      items: DiagnosticItem[];
    };
    collaborative: {
      title: string;
      items: DiagnosticItem[];
    };
  };
  checks: DiagnosticItem[];
  technicalDetail: {
    album: {
      id: number;
      title: string;
      publicSlug: string;
      userId: number;
      creatorId: number | null;
      eventId: number | null;
      schoolId: number | null;
      type: string | null;
      isPublic: boolean;
      isHidden: boolean;
      deletedAt: string | null;
      createdAt: string;
      photosCount: number;
      isAlbumComplete: boolean;
      isAlbumPubliclyAccessible: boolean;
    };
    owner: {
      id: number;
      name: string | null;
      email: string | null;
      role: string;
      hasMpAccessToken: boolean;
      hasMpUserId: boolean;
      mpConnectedAt: string | null;
    };
    event: null | {
      id: number;
      title: string;
      shareSlug: string | null;
      creatorId: number;
      archivedAt: string | null;
      visibility: string;
      albumsInEventCount: number;
    };
    school: null | { id: number; name: string | null };
    flags: {
      hasActivePreventaPacks: boolean;
      visibleWindowExpired: boolean;
      firstPhotoDateIso: string | null;
    };
  };
};

export function formatDiagnosticsForCopy(data: AlbumDiagnosticsResult): string {
  const lines: string[] = [];
  lines.push(`Álbum #${data.albumId} — ${data.generatedAt}`);
  lines.push(`Estado: ${data.summary.headline}`);
  lines.push(
    `Directorio público álbumes: ${data.summary.canAppearInPublicDirectory ? "sí" : "no"} · Checkout estándar: ${data.summary.canSellStandardCheckout ? "sí" : "no"} · Puerta pública: ${data.summary.anonymousCanPassPublicGate ? "sí" : "no"}`
  );
  lines.push("Motivos:", ...data.summary.primaryReasons.map((r) => `- ${r}`));
  lines.push("");
  for (const c of data.checks) {
    lines.push(`[${c.severity.toUpperCase()}] ${c.title}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  return lines.join("\n");
}
