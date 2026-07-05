/** Estado de ventas del álbum en formularios del dashboard (capabilities + face bulk legacy). */
export type AlbumSalesFormState = {
  inheritFromPhotographer: boolean;
  allowedCapabilities: string[];
  disabledCapabilities: string[];
  enableFaceBulkPurchase: boolean;
  faceBulkPriceInput: string;
};
