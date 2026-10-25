import { redirect } from "next/navigation";

/** La revisión de diseños se mudó al panel del fotógrafo (diseñador nuevo). */
export default async function LegacyDesignProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/fotografo/disenos/${encodeURIComponent(id)}`);
}
