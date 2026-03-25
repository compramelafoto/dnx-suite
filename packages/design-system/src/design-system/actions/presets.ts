/**
 * Presets de acciones semánticas.
 * Uso: <Button {...saveAction} onClick={...}>Guardar</Button>
 * O: <IconButton icon={deleteAction.icon} variant={deleteAction.variant} aria-label="Eliminar" />
 */

import type { IconName } from "../icons";

export type ActionPreset = {
  variant: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  icon: IconName;
};

export const deleteAction: ActionPreset = { variant: "destructive", icon: "delete" };
export const copyAction: ActionPreset = { variant: "secondary", icon: "copy" };
export const saveAction: ActionPreset = { variant: "primary", icon: "save" };
export const cancelAction: ActionPreset = { variant: "outline", icon: "close" };
export const disableAction: ActionPreset = { variant: "secondary", icon: "disable" };
export const editAction: ActionPreset = { variant: "outline", icon: "edit" };
export const shareAction: ActionPreset = { variant: "outline", icon: "share" };
export const downloadAction: ActionPreset = { variant: "primary", icon: "download" };
export const uploadAction: ActionPreset = { variant: "primary", icon: "upload" };
