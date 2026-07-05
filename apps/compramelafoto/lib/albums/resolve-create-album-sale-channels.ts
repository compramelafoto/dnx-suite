/** Defaults de canales comerciales al crear álbum (Etapa 5: ventas OFF salvo envío explícito). */
export function resolveCreateAlbumSaleChannels(body: {
  enableDigitalPhotos?: unknown;
  enablePrintedPhotos?: unknown;
}): { enableDigital: boolean; enablePrinted: boolean } {
  return {
    enableDigital:
      body.enableDigitalPhotos !== undefined && body.enableDigitalPhotos !== null
        ? Boolean(body.enableDigitalPhotos)
        : false,
    enablePrinted:
      body.enablePrintedPhotos !== undefined && body.enablePrintedPhotos !== null
        ? Boolean(body.enablePrintedPhotos)
        : false,
  };
}
