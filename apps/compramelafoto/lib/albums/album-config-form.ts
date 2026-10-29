/**
 * Estado del formulario "Configuración" de un álbum.
 *
 * La pantalla guarda todo junto con el botón "Guardar configuración", que vive
 * al final de la página. Comparando lo que hay en pantalla contra lo último
 * guardado podemos avisarle al fotógrafo que tiene cambios pendientes en vez de
 * dejar que se pierdan al recargar.
 */
export type AlbumConfigFormSnapshot = {
  title: string;
  location: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  isPublic: boolean;
  hiddenPhotosEnabled: boolean;
  hiddenSelfieRetentionDays: string;
  showComingSoonMessage: boolean;
  scanProtectionEnabled: boolean;
  /** Ventana de escaneo también en las miniaturas de la galería. */
  scanProtectionThumbnailsEnabled: boolean;
  /**
   * El interruptor de la búsqueda por dorsal.
   *
   * `null` es "no lo configuré": decide el tipo de álbum. Entra en el aviso de cambios
   * sin guardar como cualquier otro campo — apagarlo y recargar sin guardar tiene que
   * avisar igual que cambiar el título, porque cuesta plata.
   */
  textSearchEnabled: boolean | null;
};

function normalize(snapshot: AlbumConfigFormSnapshot): AlbumConfigFormSnapshot {
  return {
    ...snapshot,
    title: snapshot.title.trim(),
    location: snapshot.location.trim(),
    eventDate: snapshot.eventDate.trim(),
    eventStartTime: snapshot.eventStartTime.trim(),
    eventEndTime: snapshot.eventEndTime.trim(),
    hiddenSelfieRetentionDays: snapshot.hiddenSelfieRetentionDays.trim(),
  };
}

export function hasUnsavedAlbumConfigChanges(
  saved: AlbumConfigFormSnapshot | null,
  current: AlbumConfigFormSnapshot,
  /**
   * Sólo avisamos después de que el fotógrafo tocó algo. Al cargar, algunos
   * campos se normalizan (la fecha del evento se rehidrata) y pueden no
   * coincidir carácter por carácter con lo guardado: avisar ahí sería un aviso
   * falso apenas se abre la pantalla.
   */
  touched: boolean = true
): boolean {
  if (!saved || !touched) return false;

  const a = normalize(saved);
  const b = normalize(current);

  return (
    a.title !== b.title ||
    a.location !== b.location ||
    a.eventDate !== b.eventDate ||
    a.eventStartTime !== b.eventStartTime ||
    a.eventEndTime !== b.eventEndTime ||
    a.isPublic !== b.isPublic ||
    a.hiddenPhotosEnabled !== b.hiddenPhotosEnabled ||
    a.hiddenSelfieRetentionDays !== b.hiddenSelfieRetentionDays ||
    a.showComingSoonMessage !== b.showComingSoonMessage ||
    a.scanProtectionEnabled !== b.scanProtectionEnabled ||
    a.scanProtectionThumbnailsEnabled !== b.scanProtectionThumbnailsEnabled
  );
}
