import DesignReviewClient from "./DesignReviewClient";

export const dynamic = "force-dynamic";

export default async function DesignReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DesignReviewClient designId={id} />;
}
