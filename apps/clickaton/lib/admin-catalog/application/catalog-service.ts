import type { AdminCatalogAuthorization } from "../auth/admin-catalog-auth";
import {
  CatalogEditionMismatchError,
  CatalogImmutableFieldError,
  CatalogNotFoundError,
  CatalogStateError,
  CatalogStockError,
  CatalogDuplicateCodeError,
  CatalogDuplicateSkuError,
} from "../domain/errors";
import type { ClickatonAdminCatalogRepository } from "../domain/repository";
import type {
  AvailabilityRecord,
  CatalogActor,
  ProductFilters,
  ProductListItem,
  ProductRecord,
  ProductVariantRecord,
  TicketTypeFilters,
  TicketTypeItemInput,
  TicketTypeRecord,
  VariantStockView,
} from "../domain/types";
import {
  parseProductCreate,
  parseProductUpdate,
  parseStockAdjustment,
  parseTicketTypeCreate,
  parseTicketTypeItems,
  parseTicketTypeUpdate,
  parseVariantCreate,
  parseVariantUpdate,
  type TicketTypeCreateInput,
} from "../validation/schemas";
import type { CatalogLogger } from "./catalog-logger";

const BLOCKED_EDITION_STATUSES = new Set(["CANCELLED", "COMPLETED"]);

export function createCatalogService(deps: {
  repo: ClickatonAdminCatalogRepository;
  auth: AdminCatalogAuthorization;
  logger: CatalogLogger;
}) {
  const { repo, auth, logger } = deps;

  async function assertEditionWritable(editionId: string) {
    const edition = await repo.getEdition(editionId);
    if (!edition) throw new CatalogNotFoundError("Edición", editionId);
    if (BLOCKED_EDITION_STATUSES.has(edition.status)) {
      throw new CatalogStateError(`La edición está ${edition.status}; no admite catálogo nuevo.`);
    }
    return edition;
  }

  async function assertVenue(editionId: string, venueId: string | null) {
    if (!venueId) return;
    const venue = await repo.getVenue(venueId);
    if (!venue) throw new CatalogNotFoundError("Sede", venueId);
    if (venue.editionId !== editionId) throw new CatalogEditionMismatchError();
  }

  return {
    async listTicketTypes(actor: CatalogActor, filters: TicketTypeFilters) {
      auth.assertCapability(actor, "catalog.read");
      return repo.listTicketTypes(filters);
    },

    async getTicketType(actor: CatalogActor, id: string) {
      auth.assertCapability(actor, "catalog.read");
      const row = await repo.getTicketType(id);
      if (!row) throw new CatalogNotFoundError("Entrada", id);
      return row;
    },

    async createTicketType(actor: CatalogActor, raw: TicketTypeCreateInput, requestId?: string) {
      auth.assertCapability(actor, "catalog.ticket.mutate");
      const data = parseTicketTypeCreate(raw);
      await assertEditionWritable(data.editionId);
      await assertVenue(data.editionId, data.venueId);
      if (await repo.ticketCodeExists(data.editionId, data.code)) {
        throw new CatalogDuplicateCodeError("edición", data.code);
      }
      if (data.items.length) {
        await repo.assertCompositionItems(data.editionId, data.items);
      }
      const created = await repo.createTicketType(data);
      logger.emit({
        actor,
        action: "catalog.ticket.created",
        entity: "ticket_type",
        entityId: created.id,
        editionId: created.editionId,
        requestId,
        changedFields: ["*"],
      });
      return created;
    },

    async updateTicketType(
      actor: CatalogActor,
      id: string,
      raw: Record<string, unknown>,
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.ticket.mutate");
      const existing = await repo.getTicketType(id);
      if (!existing) throw new CatalogNotFoundError("Entrada", id);
      const usage = await repo.getRegistrationUsage(id);
      const patch = parseTicketTypeUpdate(raw);

      if (usage.hasConfirmed) {
        const blocked = [
          "priceAmount",
          "currency",
          "venueId",
          "code",
          "editionId",
        ].filter((f) => f in patch);
        if (blocked.length) throw new CatalogImmutableFieldError(blocked);
      } else if (usage.hasAny) {
        const softBlocked = ["code", "venueId", "currency"].filter((f) => f in patch);
        if (softBlocked.length) throw new CatalogImmutableFieldError(softBlocked);
      }

      if (typeof patch.code === "string" && patch.code !== existing.code) {
        if (await repo.ticketCodeExists(existing.editionId, patch.code, id)) {
          throw new CatalogDuplicateCodeError("edición", patch.code);
        }
      }
      if ("venueId" in patch) {
        await assertVenue(existing.editionId, (patch.venueId as string | null) ?? null);
      }

      const updated = await repo.updateTicketType(id, patch as never);
      logger.emit({
        actor,
        action: "catalog.ticket.updated",
        entity: "ticket_type",
        entityId: id,
        editionId: existing.editionId,
        requestId,
        changedFields: Object.keys(patch),
      });
      return updated;
    },

    async duplicateTicketType(
      actor: CatalogActor,
      input: {
        sourceId: string;
        code: string;
        name?: string;
        venueId?: string | null;
        requestId?: string;
      },
    ) {
      auth.assertCapability(actor, "catalog.ticket.mutate");
      const source = await repo.getTicketType(input.sourceId);
      if (!source) throw new CatalogNotFoundError("Entrada", input.sourceId);
      await assertEditionWritable(source.editionId);
      const code = parseTicketTypeCreate({
        editionId: source.editionId,
        name: input.name ?? `${source.name} (copia)`,
        code: input.code,
        priceAmount: source.priceAmount,
      }).code;
      if (await repo.ticketCodeExists(source.editionId, code)) {
        throw new CatalogDuplicateCodeError("edición", code);
      }
      const venueId = input.venueId === undefined ? source.venueId : input.venueId;
      await assertVenue(source.editionId, venueId);
      const dup = await repo.duplicateTicketType({
        sourceId: source.id,
        code,
        name: input.name ?? `${source.name} (copia)`,
        venueId,
        isActive: false,
      });
      logger.emit({
        actor,
        action: "catalog.ticket.duplicated",
        entity: "ticket_type",
        entityId: dup.id,
        editionId: dup.editionId,
        requestId: input.requestId,
        metadata: { sourceId: source.id },
      });
      return dup;
    },

    async setTicketTypeActive(
      actor: CatalogActor,
      id: string,
      isActive: boolean,
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.activate");
      const existing = await repo.getTicketType(id);
      if (!existing) throw new CatalogNotFoundError("Entrada", id);
      if (isActive) {
        await assertEditionWritable(existing.editionId);
        await assertVenue(existing.editionId, existing.venueId);
      }
      const updated = await repo.setTicketTypeActive(id, isActive);
      logger.emit({
        actor,
        action: isActive ? "catalog.ticket.activated" : "catalog.ticket.deactivated",
        entity: "ticket_type",
        entityId: id,
        editionId: existing.editionId,
        requestId,
      });
      return updated;
    },

    async replaceTicketTypeItems(
      actor: CatalogActor,
      id: string,
      rawItems: unknown,
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.composition.mutate");
      const existing = await repo.getTicketType(id);
      if (!existing) throw new CatalogNotFoundError("Entrada", id);
      const usage = await repo.getRegistrationUsage(id);
      if (usage.hasConfirmed) {
        throw new CatalogImmutableFieldError(["composition"]);
      }
      // draft/pending: allow replace with warning via log only
      const items = parseTicketTypeItems(rawItems);
      await repo.assertCompositionItems(existing.editionId, items);
      const updated = await repo.replaceTicketTypeItems(id, items);
      logger.emit({
        actor,
        action: "catalog.ticket.composition_replaced",
        entity: "ticket_type",
        entityId: id,
        editionId: existing.editionId,
        requestId,
        metadata: { itemCount: items.length, hadPending: usage.hasAny },
      });
      return updated;
    },

    async getCatalogAvailability(
      actor: CatalogActor,
      editionId: string,
      ticketTypeIds?: string[],
    ): Promise<AvailabilityRecord[]> {
      auth.assertCapability(actor, "catalog.availability.read");
      const ed = await repo.getEdition(editionId);
      if (!ed) throw new CatalogNotFoundError("Edición", editionId);
      return repo.getCatalogAvailability(editionId, ticketTypeIds);
    },

    async listProducts(actor: CatalogActor, filters: ProductFilters): Promise<ProductListItem[]> {
      auth.assertCapability(actor, "catalog.read");
      return repo.listProducts(filters);
    },

    async getProduct(actor: CatalogActor, id: string): Promise<ProductRecord> {
      auth.assertCapability(actor, "catalog.read");
      const row = await repo.getProduct(id);
      if (!row) throw new CatalogNotFoundError("Producto", id);
      return row;
    },

    async createProduct(
      actor: CatalogActor,
      raw: Parameters<typeof parseProductCreate>[0],
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.product.mutate");
      const data = parseProductCreate(raw);
      await assertEditionWritable(data.editionId);
      if (await repo.productCodeExists(data.editionId, data.code)) {
        throw new CatalogDuplicateCodeError("edición", data.code);
      }
      const created = await repo.createProduct(data);
      logger.emit({
        actor,
        action: "catalog.product.created",
        entity: "product",
        entityId: created.id,
        editionId: created.editionId,
        requestId,
      });
      return created;
    },

    async updateProduct(
      actor: CatalogActor,
      id: string,
      raw: Record<string, unknown>,
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.product.mutate");
      const existing = await repo.getProduct(id);
      if (!existing) throw new CatalogNotFoundError("Producto", id);
      const patch = parseProductUpdate(raw);
      if (typeof patch.code === "string" && patch.code !== existing.code) {
        if (await repo.productCodeExists(existing.editionId, patch.code, id)) {
          throw new CatalogDuplicateCodeError("edición", patch.code);
        }
      }
      const updated = await repo.updateProduct(id, patch as never);
      logger.emit({
        actor,
        action: "catalog.product.updated",
        entity: "product",
        entityId: id,
        editionId: existing.editionId,
        requestId,
        changedFields: Object.keys(patch),
      });
      return updated;
    },

    async setProductActive(actor: CatalogActor, id: string, isActive: boolean, requestId?: string) {
      auth.assertCapability(actor, "catalog.activate");
      const existing = await repo.getProduct(id);
      if (!existing) throw new CatalogNotFoundError("Producto", id);
      const updated = await repo.setProductActive(id, isActive);
      logger.emit({
        actor,
        action: isActive ? "catalog.product.activated" : "catalog.product.deactivated",
        entity: "product",
        entityId: id,
        editionId: existing.editionId,
        requestId,
      });
      return updated;
    },

    async createProductVariant(
      actor: CatalogActor,
      raw: Parameters<typeof parseVariantCreate>[0],
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.variant.mutate");
      const data = parseVariantCreate(raw);
      const product = await repo.getProduct(data.productId);
      if (!product) throw new CatalogNotFoundError("Producto", data.productId);
      if (await repo.skuExists(data.sku)) throw new CatalogDuplicateSkuError(data.sku);
      const created = await repo.createVariant(data);
      logger.emit({
        actor,
        action: "catalog.variant.created",
        entity: "variant",
        entityId: created.id,
        editionId: product.editionId,
        requestId,
      });
      return created;
    },

    async updateProductVariant(
      actor: CatalogActor,
      id: string,
      raw: Record<string, unknown>,
      requestId?: string,
    ) {
      auth.assertCapability(actor, "catalog.variant.mutate");
      const existing = await repo.getVariant(id);
      if (!existing) throw new CatalogNotFoundError("Variante", id);
      if ("stock" in raw) {
        throw new CatalogStateError("Usá adjustVariantStock para modificar stock.");
      }
      const patch = parseVariantUpdate(raw);
      if (typeof patch.sku === "string" && patch.sku !== existing.sku) {
        if (await repo.skuExists(patch.sku, id)) throw new CatalogDuplicateSkuError(patch.sku);
      }
      const product = await repo.getProduct(existing.productId);
      const updated = await repo.updateVariant(id, patch as never);
      logger.emit({
        actor,
        action: "catalog.variant.updated",
        entity: "variant",
        entityId: id,
        editionId: product?.editionId,
        requestId,
        changedFields: Object.keys(patch),
      });
      return updated;
    },

    async setVariantActive(actor: CatalogActor, id: string, isActive: boolean, requestId?: string) {
      auth.assertCapability(actor, "catalog.activate");
      const existing = await repo.getVariant(id);
      if (!existing) throw new CatalogNotFoundError("Variante", id);
      const product = await repo.getProduct(existing.productId);
      const updated = await repo.setVariantActive(id, isActive);
      logger.emit({
        actor,
        action: isActive ? "catalog.variant.activated" : "catalog.variant.deactivated",
        entity: "variant",
        entityId: id,
        editionId: product?.editionId,
        requestId,
      });
      return updated;
    },

    async adjustVariantStock(
      actor: CatalogActor,
      raw: Parameters<typeof parseStockAdjustment>[0],
    ): Promise<ProductVariantRecord> {
      auth.assertCapability(actor, "catalog.variant.mutate");
      const adj = parseStockAdjustment(raw);
      const existing = await repo.getVariant(adj.variantId);
      if (!existing) throw new CatalogNotFoundError("Variante", adj.variantId);
      const newStock =
        adj.mode === "absolute" ? adj.value : existing.stock + adj.value;
      if (newStock < 0) {
        throw new CatalogStockError("El stock no puede ser negativo.");
      }
      if (newStock < existing.reservedStock) {
        throw new CatalogStockError(
          `Stock (${newStock}) no puede ser menor que reservedStock (${existing.reservedStock}).`,
          { newStock, reservedStock: existing.reservedStock },
        );
      }
      const updated = await repo.setVariantStock(adj.variantId, newStock);
      const product = await repo.getProduct(existing.productId);
      logger.emit({
        actor,
        action: "catalog.variant.stock_adjusted",
        entity: "variant",
        entityId: adj.variantId,
        editionId: product?.editionId,
        requestId: adj.requestId,
        reason: adj.reason,
        metadata: { previous: existing.stock, next: newStock },
      });
      return updated;
    },

    async getVariantStockView(actor: CatalogActor, id: string): Promise<VariantStockView> {
      auth.assertCapability(actor, "catalog.read");
      const view = await repo.getVariantStockView(id);
      if (!view) throw new CatalogNotFoundError("Variante", id);
      return view;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;

export type { TicketTypeItemInput, TicketTypeRecord };
