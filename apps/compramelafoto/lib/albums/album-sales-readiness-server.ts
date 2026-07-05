import {
  ALBUM_SALES_NOT_READY_API_CODE,
  CHECKOUT_SALES_NOT_READY_MESSAGE,
  evaluateAlbumSalesReadiness,
  isAlbumSinglesPurchaseReady,
  type AlbumSalesReadinessInput,
} from "@/lib/albums/album-sales-readiness";

export async function isAlbumReadyToSellForCheckout(
  album: AlbumSalesReadinessInput & { userId: number }
): Promise<boolean> {
  return isAlbumSinglesPurchaseReady(album);
}

export function albumSalesNotReadyResponse() {
  return Response.json(
    {
      error: CHECKOUT_SALES_NOT_READY_MESSAGE,
      code: ALBUM_SALES_NOT_READY_API_CODE,
    },
    { status: 403 }
  );
}

export { evaluateAlbumSalesReadiness };
