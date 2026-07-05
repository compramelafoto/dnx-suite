import type { Prisma } from "@/lib/prisma";
import {
  albumPackComponentsInclude,
  deriveAlbumPackTypeFromComponents,
  mapDbComponentsToComposition,
  serializeAlbumPackComponentsForApi,
} from "@/lib/album-packs/album-pack-components-persistence";
import { deriveAlbumPackFulfillmentKind } from "@/lib/album-packs/resolve-album-pack-order-lines";

export const albumPackDashboardInclude = {
  template: {
    select: { id: true, name: true, albumId: true },
  },
  templateV2: {
    select: { id: true, name: true },
  },
  components: albumPackComponentsInclude,
} satisfies Prisma.AlbumPackInclude;

export type AlbumPackWithComponents = Prisma.AlbumPackGetPayload<{
  include: typeof albumPackDashboardInclude;
}>;

export function serializeAlbumPackForDashboardApi(pack: AlbumPackWithComponents) {
  const components = serializeAlbumPackComponentsForApi(pack.components);
  const compositionComponents = mapDbComponentsToComposition(pack.components);
  const compositionFulfillmentKind = deriveAlbumPackFulfillmentKind(compositionComponents);

  return {
    ...pack,
    components,
    compositionFulfillmentKind,
  };
}

export { deriveAlbumPackTypeFromComponents };
