/**
 * Contrato del proveedor de datos públicos de maratones.
 * Las páginas consumen el servicio; el servicio delega en una implementación.
 */

import type { PublicMarathon } from "@/types/marathon";
import type {
  PublicMarathonCapabilities,
  PublicMarathonGallery,
  PublicMarathonResults,
  PublicRegistrationOffer,
} from "@/types/public";

export type PublicMarathonDataSource = {
  /** Ediciones anunciadas (excluye demo, draft, cancelled). */
  listListed(): Promise<PublicMarathon[]> | PublicMarathon[];

  /** Resuelve por slug si es routable (incluye demo técnica). */
  getBySlug(slug: string): Promise<PublicMarathon | null> | PublicMarathon | null;

  /** Slugs permitidos para SSG / build. */
  listRoutableSlugs(): Promise<string[]> | string[];

  getRegistrationOffer?(
    marathonId: string,
  ): Promise<PublicRegistrationOffer | null> | PublicRegistrationOffer | null;

  getCapabilities?(
    marathonId: string,
  ): Promise<PublicMarathonCapabilities | null> | PublicMarathonCapabilities | null;

  getResults?(
    marathonId: string,
  ): Promise<PublicMarathonResults | null> | PublicMarathonResults | null;

  getGallery?(
    marathonId: string,
  ): Promise<PublicMarathonGallery | null> | PublicMarathonGallery | null;
};
