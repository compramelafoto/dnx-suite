/** Include compartido para lectura de productos del catálogo. */
export const catalogProductInclude = {
  category: { select: { id: true, name: true } },
  images: { select: { publicUrl: true, role: true }, orderBy: { id: "asc" as const } },
  components: { orderBy: { sortOrder: "asc" as const } },
};
