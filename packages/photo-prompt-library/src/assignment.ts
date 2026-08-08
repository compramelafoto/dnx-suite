import type {
  AssignmentSnapshot,
  PhotoPromptInspirationType,
} from "./types";

export type LibraryItemForSnapshot = {
  id: string;
  version: number;
  title: string;
  description: string;
  inspirationType?: PhotoPromptInspirationType | null;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
  theme: { name: string };
  subtheme?: { name: string } | null;
};

/** Construye snapshot inmutable para ClickatonPrompt. */
export function buildAssignmentSnapshot(
  item: LibraryItemForSnapshot,
): AssignmentSnapshot {
  return {
    libraryItemId: item.id,
    libraryVersion: item.version,
    titleSnapshot: item.title,
    descriptionSnapshot: item.description,
    themeSnapshot: item.theme.name,
    subthemeSnapshot: item.subtheme?.name ?? null,
    inspirationSnapshot: {
      type: item.inspirationType ?? null,
      label: item.inspirationLabel ?? null,
      notes: item.inspirationNotes ?? null,
    },
  };
}

/** Campos Prisma a setear en ClickatonPrompt al asignar. */
export function snapshotToClickatonFields(snapshot: AssignmentSnapshot) {
  return {
    libraryItemId: snapshot.libraryItemId,
    libraryVersion: snapshot.libraryVersion,
    titleSnapshot: snapshot.titleSnapshot,
    descriptionSnapshot: snapshot.descriptionSnapshot,
    themeSnapshot: snapshot.themeSnapshot,
    subthemeSnapshot: snapshot.subthemeSnapshot,
    inspirationSnapshot: snapshot.inspirationSnapshot,
    title: snapshot.titleSnapshot,
    instructions: snapshot.descriptionSnapshot,
    shortDescription: snapshot.descriptionSnapshot.slice(0, 280),
    internalName: snapshot.titleSnapshot.slice(0, 120),
  };
}
